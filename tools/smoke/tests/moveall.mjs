// Moving a club's whole staff (#170): the club itself and a women's club refused as a whole for a men's club's staff,
// with nothing written; the staff of one of the best known clubs moved to the next as one batch, as the probe reads it
// (those the plan says stay still at the old club, every other one at the new club in the same job, the clubs'
// managers where they were), and the batch undone, every one back. Then the same through the app: the club's Staff
// tab, Move all staff, its dialog (the search first, Cancel changing nothing; then the club picked, who moves and who
// stays, Move all), the line under the buttons, and Undo there bringing them all back.
import { SHOWN, VIS, sleep } from "../lib/app.mjs";
import { topClubs } from "../lib/witness.mjs";
import { idsOf, probedAt, probedManager } from "./release.mjs";

export const name = "moveall";
export const writes = true;

/** The manager's job code. */
const MANAGER = 16;

/** Why one stays when the rest move: as for a release (see release.mjs), or a place at the new club that is taken. */
const STAYS = [
  "staff.you",
  "staff.job",
  "move.playerCoach",
  "staff.role",
  "staff.managerTaken",
  "staff.directorTaken",
  "staff.yourClub",
];

export async function run({ app, report, probe }) {
  const [from, to] = await topClubs(app, 2);
  if (!to) {
    report.skip("moves a whole staff", "fewer than two men's clubs no human manages");
    return;
  }
  report.note(`from ${from.name} (${from.uid}) to ${to.name} (${to.uid})`);
  await refusals(app, report, from);
  await moveAll(app, report, probe, from, to);
  await throughTheApp(app, report, probe, from, to);
}

/** The club itself, and a women's club for a men's club's staff: each refused as a whole, with nothing written. */
async function refusals(app, report, from) {
  const plan = await app.invoke("plan_club_staff_move", { club: from.uid, to: from.uid });
  report.check("the club itself refused", !plan.ok && plan.error.code === "move.sameClub", plan.ok ? "planned" : plan.error.code);
  const move = await app.invoke("move_club_staff", { club: from.uid, to: from.uid });
  report.check("and moving to it refused", !move.ok && move.error.code === "move.sameClub", move.ok ? JSON.stringify(move.value) : move.error.code);
  const women = (await app.must("search_clubs", { query: "", limit: 1, filter: { women: true } })).rows[0];
  if (women) {
    const r = await app.invoke("plan_club_staff_move", { club: from.uid, to: women.uid });
    report.check(`a women's club refused (${women.name})`, !r.ok && r.error.code === "move.menAndWomen", r.ok ? "planned" : r.error.code);
  } else {
    report.skip("a women's club refused", "no women's club in this save");
  }
}

/** The whole staff of `from` moved to `to` as one batch, as the probe reads it, and the batch undone. */
async function moveAll(app, report, probe, from, to) {
  const rows = await app.must("plan_club_staff_move", { club: from.uid, to: to.uid });
  const moving = rows.filter((r) => r.stays === null);
  const staying = rows.filter((r) => r.stays !== null);
  report.check(
    "the plan lists the club's staff, most of them moving",
    moving.length > 0 && rows.every((r) => r.clubUid === from.uid),
    `${rows.length} staff, ${moving.length} move, ${staying.length} stay: ${staying.map((r) => `${r.name} ${r.stays.code}`).slice(0, 6).join(", ")}`,
  );
  report.check("those who stay are the board and the like, or a place at the new club taken", staying.every((r) => STAYS.includes(r.stays.code)), staying.map((r) => r.stays.code).join(", "));
  // The plan takes the senior team's manager first: a youth team's manager never gets the new club's place before him.
  const managers = rows.filter((r) => r.job === MANAGER);
  report.check("no more than one manager moves", managers.filter((r) => r.stays === null).length <= 1, managers.map((r) => `${r.name} ${r.stays?.code ?? "moves"}`).join(", "));
  const ids = idsOf(rows);
  report.check("the probe reads every one of them at the club", probedAt(probe, app.folder, from.name, ids).length === ids.length, `${ids.length} staff`);
  const managerFrom = probedManager(probe, from.uid);
  const managerTo = probedManager(probe, to.uid);

  const done = await app.must("move_club_staff", { club: from.uid, to: to.uid });
  report.check("moves every one the plan moves, as one batch", done.applied === moving.length && done.failed.length === 0, JSON.stringify({ applied: done.applied, failed: done.failed.slice(0, 3) }));
  const left = probedAt(probe, app.folder, from.name, ids);
  report.check("the probe reads only those who stay at the old club", JSON.stringify(left) === JSON.stringify(idsOf(staying)), `${left.length} left`);
  const joined = probedAt(probe, app.folder, to.name, ids);
  report.check("and every other one at the new club", JSON.stringify(joined) === JSON.stringify(idsOf(moving)), `${joined.length} joined`);
  const there = (await app.must("club_staff", { club: to.uid })).filter((r) => moving.some((m) => m.uid === r.uid));
  const sameJob = there.every((r) => r.job === moving.find((m) => m.uid === r.uid).job);
  report.check("each in the job he had", there.length === moving.length && sameJob, `${there.length} listed at ${to.name}`);
  if (!moving.some((r) => r.job === MANAGER)) {
    const now = [probedManager(probe, from.uid), probedManager(probe, to.uid)];
    report.check("the clubs' managers where they were", now[0] === managerFrom && now[1] === managerTo, now.join(" / "));
  }
  const logged = (await app.must("change_log")).filter((c) => c.batch === done.batch);
  report.check(
    "logged as one batch of club changes to the new club",
    logged.length === done.applied && logged.every((c) => c.field === "club" && c.old === from.uid && c.new === to.uid),
    `${logged.length} logged`,
  );

  const undone = await app.must("undo_batch", { batch: done.batch });
  report.check("the batch undone", undone.undone === done.applied && undone.failed.length === 0, JSON.stringify(undone).slice(0, 200));
  report.check("every one back at the old club", JSON.stringify(probedAt(probe, app.folder, from.name, ids)) === JSON.stringify(ids), "");
  report.check("none left at the new club", probedAt(probe, app.folder, to.name, ids).length === 0, "");
  const back = [probedManager(probe, from.uid), probedManager(probe, to.uid)];
  report.check("the managers in their places", back[0] === managerFrom && back[1] === managerTo, back.join(" / "));
}

/**
 * Through the app: the club's Staff tab, Move all staff, its dialog (the search, Cancel, then the club picked and Move
 * all), the line under the buttons and the Undo there.
 */
async function throughTheApp(app, report, probe, from, to) {
  await app.openClub(from.name, from.uid);
  const tab = `[...document.querySelectorAll(".profile-tabs [role=tab]")].filter(${SHOWN}).find((t) => t.textContent.trim() === "Staff")`;
  await app.click(tab, "the Staff tab");
  const staffTab = `${VIS}(".club-staff-tab")`;
  await app.waitFor(`${staffTab}?.querySelector("table.club-staff-grid tbody tr")`, "the club's staff", 30000);
  const moveAll = `[...${staffTab}.querySelectorAll(".squad-buttons button")].find((b) => b.textContent === "Move all staff")`;
  report.check("Move all staff beside Release all staff", await app.js(`!!${moveAll} && !${moveAll}.disabled`), "");
  const ids = idsOf(await app.must("club_staff", { club: from.uid }));

  await app.click(moveAll, "Move all staff");
  const ask = `document.querySelector(".modal[role=dialog]")`;
  const search = `${ask}?.querySelector(".club-search input")`;
  await app.waitFor(search, "the dialog's search for a club");
  const first = await app.js(`({ plan: ${ask}.querySelector(".move-plan").textContent, waits: ${ask}.querySelector(".modal-foot .primary").disabled, focused: document.activeElement === ${search} })`);
  report.check("the dialog asks for the club first, with focus in its search and Move all waiting", first.plan.startsWith("Choose the club") && first.waits && first.focused, JSON.stringify(first));
  await app.shot("move-all-search");
  await app.click(`[...${ask}.querySelectorAll(".modal-foot button")].find((b) => b.textContent === "Cancel")`, "Cancel");
  await app.waitFor(`!${ask}`, "the dialog to close");
  report.check("Cancel changes nothing", JSON.stringify(probedAt(probe, app.folder, from.name, ids)) === JSON.stringify(ids), "");

  await app.click(moveAll, "Move all staff");
  await app.waitFor(search, "the dialog again");
  await app.setInput(search, from.name);
  await sleep(800);
  const offered = await app.js(`[...${ask}.querySelectorAll(".move-results .move-option")].map((o) => o.textContent)`);
  report.check("the search leaves out the club itself", !offered.some((text) => text.startsWith(from.name)), offered.slice(0, 3).join(" | "));
  await app.setInput(search, to.name);
  const option = `[...${ask}.querySelectorAll(".move-results .move-option")].find((o) => o.textContent.includes(${JSON.stringify(to.name)}))`;
  await app.waitFor(option, `${to.name} in the search`);
  await app.click(option, to.name);
  await app.waitFor(`${ask}.querySelector(".move-plan.ok")`, "who moves there", 30000);
  const planned = await app.must("plan_club_staff_move", { club: from.uid, to: to.uid });
  const moving = planned.filter((r) => r.stays === null);
  const said = await app.js(`${ask}.querySelector(".move-plan").textContent`);
  report.check("the dialog says how many move there", said === `${moving.length} members of staff move to ${to.name}` || said === `1 member of staff moves to ${to.name}`, said);
  const asked = await app.js(`${ask}.textContent`);
  report.check("and who leaves and who stays", asked.includes(`${moving.length} leave the club`) && (moving.length === planned.length || asked.includes(`${planned.length - moving.length} stay`)), asked.slice(0, 200));
  await app.shot("move-all-dialog");
  await app.click(`${ask}.querySelector(".modal-foot .primary")`, "Move all");
  await app.waitFor(`!${ask}`, "the dialog to close", 60000);

  const result = `${staffTab}.querySelector(".squad-result")`;
  await app.waitFor(`${result}?.textContent.includes("moved to") && !${staffTab}.querySelector(".squad-buttons button[aria-disabled=true]")`, "the line under the buttons", 60000);
  const line = await app.js(`${result}.textContent`);
  report.check("the line under the buttons says how many moved, and where", line.includes(`${moving.length} member`) && line.includes(`moved to ${to.name}`), line);
  report.check("the probe reads them at the new club", JSON.stringify(probedAt(probe, app.folder, to.name, ids)) === JSON.stringify(idsOf(moving)), "");
  await app.shot("move-all-done");
  await sleep(300);
  await app.click(`${result}.querySelector("button")`, "Undo");
  await app.waitFor(`${result}?.textContent.includes("Undid")`, "the undo", 60000);
  const back = probedAt(probe, app.folder, from.name, ids);
  report.check("Undo under the buttons brings them all back", JSON.stringify(back) === JSON.stringify(ids), await app.js(`${result}.textContent`));
}
