// Destroy: the team at its worst as one action and one batch, the other way from Team at its best (`best`). On the
// senior team of the club the human manager has, whose tactic he picks: every player at morale 1, happiness and playing
// time happiness -100, no energy, 35% match sharpness and jadedness 1000, cohesion 1 and the tactic known at its least,
// as the squad and the probe read them, nobody's value made better than it was (a sharpness below 35% stays), one batch
// in the change log, a second press with nothing left to write, then one undo of the batch putting every player back. On
// the senior team of the best known club no human manages, Min tactics skipped and named while the other steps still
// run, undone. Then the Squad tab of the human manager's club: Team at its best, More actions with the seven single
// actions and Batch traits, and the red Destroy; Batch traits' dialog from the menu, and Escape giving focus back to More
// actions; Destroy's question, Cancel writing nothing, Destroy there, the line under the buttons, and its Undo.
import { SHOWN, VIS, sleep } from "../lib/app.mjs";
import { humanClubs, topClubs } from "../lib/witness.mjs";

export const name = "destroy";
export const writes = true;

/** What Destroy writes, as the probe names the fields: each the most a value goes down to (jadedness: up to). */
const WORST = {
  morale: 1,
  "contract.happiness": -100,
  "contract.playing_time_happiness": -100,
  condition: 0,
  match_sharpness: 3500,
  jadedness: 1000,
};
/** Cohesion with the club at its least (`COHESION_RANGE`). */
const WORST_COHESION = 1;
/** The most a player knows the tactic after Min tactics: 10 for each option, the screen's least, and 0 for a shape. */
const MOST_TACTICS = 5;

/** The players of the senior team of the club `uid`, as its squad lists them. */
const senior = async (app, uid) => (await app.must("club_squads", { uid }))[0].players;

/** What a squad row holds of what Destroy changes. */
const row = (p) => JSON.stringify([p.morale, p.condition, p.matchSharpness, p.jadedness, p.cohesion, p.tactics, p.trains]);

/** The players of `before` whose rows in `after` hold something else, as "name: before -> after". */
function moved(before, after) {
  const now = new Map(after.map((p) => [p.uid, p]));
  return before
    .filter((p) => row(p) !== row(now.get(p.uid) ?? {}))
    .map((p) => `${p.name}: ${row(p)} -> ${row(now.get(p.uid) ?? {})}`);
}

/**
 * The players of `after` Destroy left above what it writes: a value it lowers that is still higher (a sharpness below
 * 35% stays, as it was), jadedness still lower, cohesion for those who had one, and the tactic for those who play for
 * the team where it is read.
 */
function short(before, after) {
  const was = new Map(before.map((p) => [p.uid, p]));
  return after.filter((p) => {
    const old = was.get(p.uid);
    return (
      p.morale !== WORST.morale ||
      p.condition !== WORST.condition ||
      p.matchSharpness !== Math.min(WORST.match_sharpness, old?.matchSharpness ?? WORST.match_sharpness) ||
      p.jadedness !== Math.max(WORST.jadedness, old?.jadedness ?? WORST.jadedness) ||
      (old?.cohesion != null && p.cohesion !== WORST_COHESION) ||
      (old?.tactics != null && p.playsHere && p.tactics > MOST_TACTICS)
    );
  });
}

/** The players of `after` with a value better than it was in `before`: what Destroy must never do. */
function bettered(before, after) {
  const now = new Map(after.map((p) => [p.uid, p]));
  return before.filter((p) => {
    const q = now.get(p.uid);
    return (
      q != null &&
      (q.morale > p.morale ||
        q.condition > p.condition ||
        q.matchSharpness > p.matchSharpness ||
        q.jadedness < p.jadedness ||
        (p.cohesion != null && q.cohesion > p.cohesion) ||
        (p.tactics != null && q.tactics != null && q.tactics > p.tactics))
    );
  });
}

/** The `tactics` and `cohesion` lines of the probe's `health`. */
const checks = (probe) =>
  probe
    .run(["health"])
    .split(/\r?\n/)
    .filter((line) => /\b(tactics|cohesion)\b/.test(line))
    .map((line) => line.trim());

/** "1 change", "12 changes", as the line under the buttons counts them. */
const changes = (count) => (count === 0 ? "No changes" : count === 1 ? "1 change" : `${count.toLocaleString("en")} changes`);

export async function run({ app, report, probe }) {
  const [club] = await humanClubs(app);
  if (club == null) {
    report.skip("Destroy", "the human manager has no club on this save");
    return;
  }
  const before = await senior(app, club);
  const cohesive = before.filter((p) => p.cohesion != null);
  const tactical = before.filter((p) => p.tactics != null);
  const lowSharpness = before.filter((p) => p.matchSharpness < WORST.match_sharpness);
  report.note(
    `witness: club ${club}'s senior team, ${before.length} players: ${cohesive.length} with a cohesion, ` +
      `${tactical.length} with a tactic read, ${lowSharpness.length} below 35% sharpness`,
  );
  const sample = before.slice(0, 3);
  const probed = () => sample.map((p) => probe.get("player", p.uid, Object.keys(WORST)));
  const probedBefore = probed();
  const healthBefore = checks(probe);

  const done = await app.must("team_action", { club, team: 0, action: "destroy" });
  const skipped = Object.fromEntries(done.skipped.map((step) => [step.action, step.reason.code]));
  const said = JSON.stringify(skipped);
  report.check(
    "it runs every step: Min cohesion where a cohesion is read and Min tactics where the tactic is",
    !("demoralize" in skipped) &&
      !("exhaust" in skipped) &&
      (cohesive.length === 0 || !("minCohesion" in skipped)) &&
      (tactical.length === 0 || !("minTactics" in skipped)),
    said,
  );
  report.check("it writes without a refusal", done.failed.length === 0, JSON.stringify(done.failed.slice(0, 3)));
  const after = await senior(app, club);
  const left = short(before, after);
  report.check(
    "every player is then at morale 1, no energy, 35% sharpness, jadedness 1000, cohesion 1 and the tactic at its least",
    done.applied > 0 && left.length === 0,
    `${done.applied} written${left.length ? `; short: ${left.slice(0, 3).map((p) => `${p.name} ${row(p)}`).join(", ")}` : ""}`,
  );
  const better = bettered(before, after);
  report.check(
    "and nobody's value is made better than it was",
    better.length === 0,
    better.slice(0, 3).map((p) => p.name).join(", "),
  );
  const probedAfter = probed();
  report.check(
    "as the probe reads the first three, happiness and playing time happiness at -100 too",
    probedAfter.every((read, i) =>
      Object.entries(WORST).every(([field, value]) => {
        const was = probedBefore[i][field];
        if (typeof was !== "number") return true;
        const worst = field === "jadedness" ? Math.max(value, was) : Math.min(value, was);
        return read[field] === worst;
      }),
    ),
    JSON.stringify(probedAfter[0]),
  );
  const logged = (await app.must("change_log")).filter((change) => change.batch === done.batch);
  report.check(
    "the change log keeps every change as one batch",
    logged.length === done.applied,
    `${logged.length} of ${done.applied}: ${[...new Set(logged.map((change) => change.field))].join(", ")}`,
  );
  const healthAfter = checks(probe);
  report.check(
    "the records and histories still check out",
    healthAfter.every((line) => !/^fail\b/i.test(line)),
    healthAfter.join("; "),
  );

  const again = await app.must("team_action", { club, team: 0, action: "destroy" });
  report.check(
    "a second press has nothing left to write",
    again.applied === 0 && again.failed.length === 0,
    JSON.stringify({ applied: again.applied, skipped: again.skipped.map((step) => step.action) }),
  );
  if (again.applied > 0) await app.must("undo_batch", { batch: again.batch });

  const undone = await app.must("undo_batch", { batch: done.batch });
  report.check(
    "one undo of the batch takes every change back",
    undone.undone === done.applied && undone.failed.length === 0,
    `${undone.undone} of ${done.applied}; ${JSON.stringify(undone.failed.slice(0, 3))}`,
  );
  const back = moved(before, await senior(app, club));
  report.check(
    "and puts every player back where he was, as the squad and the probe read them",
    back.length === 0 && JSON.stringify(probed()) === JSON.stringify(probedBefore),
    back.slice(0, 3).join("; "),
  );
  report.check(
    "and they check out as before",
    JSON.stringify(checks(probe)) === JSON.stringify(healthBefore),
    checks(probe).join("; "),
  );

  // Where no human picks the tactic, Min tactics is skipped and named, and the other steps still run.
  const [other] = await topClubs(app, 1);
  const theirs = await senior(app, other.uid);
  const elsewhere = await app.must("team_action", { club: other.uid, team: 0, action: "destroy" });
  const unpicked = elsewhere.skipped.find((step) => step.action === "minTactics");
  report.check(
    `on ${other.name}, whose tactic no human picks, Min tactics is skipped and named`,
    unpicked?.reason.code === "team.noTactics",
    JSON.stringify(elsewhere.skipped.map((step) => `${step.action}: ${step.reason.code}`)),
  );
  const theirsAfter = short(theirs, await senior(app, other.uid));
  report.check(
    "while the other steps still run",
    elsewhere.failed.length === 0 && theirsAfter.length === 0,
    `${elsewhere.applied} written${theirsAfter.length ? `; short: ${theirsAfter.map((p) => p.name).join(", ")}` : ""}`,
  );
  if (elsewhere.applied > 0) await app.must("undo_batch", { batch: elsewhere.batch });
  const theirsBack = moved(theirs, await senior(app, other.uid));
  report.check(`and their undo puts ${other.name}'s players back`, theirsBack.length === 0, theirsBack.slice(0, 3).join("; "));

  // The Squad tab: its three buttons, the menu, Destroy's question, Cancel, Destroy, and the Undo under the buttons.
  const human = (await app.must("search_staff", { query: "", limit: 20 })).rows.find((m) => m.isHuman && m.clubUid === club);
  await app.openClub(human.club, club);
  await app.click(
    `[...document.querySelectorAll(".profile-tabs [role=tab]")].filter(${SHOWN}).find((t) => t.textContent.trim() === "Squad")`,
    "the Squad tab",
  );
  const tab = `${VIS}(".squad-tab")`;
  const buttons = `[...(${tab}?.querySelectorAll(".squad-buttons button") ?? [])]`;
  const destroy = `${buttons}.find((b) => b.textContent === "Destroy")`;
  await app.waitFor(`${destroy} && !${destroy}.disabled && !${destroy}.hasAttribute("aria-disabled")`, "Destroy", 30000);
  const names = await app.js(`${buttons}.map((b) => b.textContent)`);
  report.check(
    "the Squad tab has Team at its best, More actions and a red Destroy, in that order",
    JSON.stringify(names) === JSON.stringify(["Team at its best", "More actions", "Destroy"]) &&
      (await app.js(`getComputedStyle(${destroy}).backgroundColor !== getComputedStyle(${buttons}[0]).backgroundColor`)),
    names.join(" | "),
  );
  await app.click(`${buttons}[1]`, "More actions");
  const items = await app.waitFor(
    `(() => { const m = document.querySelector(".squad-actions-menu"); return m && [...m.querySelectorAll("[role=menuitem]")].map((i) => i.textContent); })()`,
    "the More actions menu",
  );
  report.check(
    "More actions lists the seven single actions, then Batch traits",
    items.length === 8 && items[0].startsWith("Heal all") && items[6] === "Max tactics" && items[7] === "Batch traits",
    items.join(" | "),
  );
  await app.press("Escape");
  report.check(
    "and Escape closes it",
    await app.js(`!document.querySelector(".squad-actions-menu")`),
  );

  // Batch traits (#237) opens its dialog from the menu; closing it gives focus back to More actions.
  await app.click(`${buttons}[1]`, "More actions");
  const traitsItem = `[...(document.querySelector(".squad-actions-menu")?.querySelectorAll("[role=menuitem]") ?? [])].find((i) => i.textContent === "Batch traits")`;
  await app.waitFor(traitsItem, "Batch traits in the menu");
  report.check("Batch traits says it opens a dialog", await app.js(`${traitsItem}.getAttribute("aria-haspopup") === "dialog"`));
  await app.click(traitsItem, "Batch traits");
  const traitsDialog = `document.querySelector(".batch-traits-dialog")`;
  await app.waitFor(traitsDialog, "the Batch traits dialog");
  report.check(
    "it opens the Batch traits dialog in place of the menu, with the 64 traits and focus on Cancel",
    await app.js(
      `!document.querySelector(".squad-actions-menu") && ${traitsDialog}.querySelectorAll("input[type=checkbox]").length === 64 && document.activeElement?.textContent === "Cancel"`,
    ),
  );
  await app.press("Escape");
  await app.waitFor(`!${traitsDialog}`, "the Batch traits dialog to close");
  report.check("Escape closes it and gives focus back to More actions", await app.js(`document.activeElement === ${buttons}[1]`));

  const logLength = (await app.must("change_log")).length;
  await app.click(destroy, "Destroy");
  const dialog = `document.querySelector(".destroy-dialog")`;
  await app.waitFor(`${dialog}`, "Destroy's question");
  const asked = await app.js(`${dialog}.innerText`);
  report.check(
    "Destroy asks first, naming the club and saying it is the user's own",
    asked.includes(human.club) && asked.includes("This is a team of your own club.") &&
      (await app.js(`${dialog}.getAttribute("role") === "alertdialog" && document.activeElement?.textContent === "Cancel"`)),
    asked.split("\n").slice(0, 3).join(" | "),
  );
  await app.shot("destroy-question");
  await app.click(`[...${dialog}.querySelectorAll("button")].find((b) => b.textContent === "Cancel")`, "Cancel");
  await sleep(300);
  report.check(
    "Cancel writes nothing",
    (await app.js(`!${dialog}`)) && (await app.must("change_log")).length === logLength,
  );

  await app.click(destroy, "Destroy");
  await app.waitFor(`${dialog}`, "Destroy's question again");
  await app.click(`${dialog}.querySelector("button.destroy")`, "Destroy in the question");
  const result = `${tab}.querySelector(".squad-result")`;
  const undo = `${result}?.querySelector("button")`;
  await app.waitFor(
    `${result}?.textContent.includes("written") && ${undo} && !${undo}.hasAttribute("aria-disabled")`,
    "the line under the buttons",
    60000,
  );
  const line = await app.js(`${result}.querySelector("p")?.textContent`);
  const pressed = short(before, await senior(app, club));
  report.check(
    "confirmed there, it takes the team to its worst, and the line counts the changes",
    line.startsWith(`${changes(done.applied)} written`) && pressed.length === 0,
    `${line}${pressed.length ? `; short: ${pressed.map((p) => p.name).join(", ")}` : ""}`,
  );
  await app.shot("destroy-pressed");
  await sleep(300);
  await app.click(undo, "Undo");
  await app.waitFor(`${result}?.textContent.includes("Undid")`, "the undo", 60000);
  const restored = moved(before, await senior(app, club));
  report.check("Undo on that line puts every player back", restored.length === 0, restored.slice(0, 3).join("; "));
}
