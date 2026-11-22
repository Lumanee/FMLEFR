// Team at its best (#227): Heal all, Inspire all, Refresh all, Max cohesion and Max tactics as one action and one
// batch. On the senior team of the club the human manager has, whose tactic he picks (see `tactics`): every player
// healed, at morale 20 with no reasons to be unhappy, at full energy and sharpness and rested, at the best cohesion and
// knowing the tactic at its best, as the squad and the probe read them, one batch in the change log, a second press with
// nothing left to do but Heal all skipped, then one undo of the batch putting every player back. On the senior team of
// the best known club no human manages, Max tactics skipped and named while the other steps still run, undone. Then the
// button in the human manager's club's Squad tab, the line under the buttons, and its Undo.
import { SHOWN, VIS, sleep } from "../lib/app.mjs";
import { humanClubs, topClubs } from "../lib/witness.mjs";

export const name = "best";
export const writes = true;

/** What the button sets, as `read_values` and the probe name the fields. */
const SETS = { condition: 10000, match_sharpness: 10000, jadedness: -500, morale: 20, "contract.unhappiness": 0 };
/** Cohesion with the club at its best (`COHESION_RANGE`). */
const BEST_COHESION = 100;

/** The players of the senior team of the club `uid`, as its squad lists them. */
const senior = async (app, uid) => (await app.must("club_squads", { uid }))[0].players;

/** What a squad row holds of what the button changes. */
const row = (p) => JSON.stringify([p.injuries, p.morale, p.condition, p.matchSharpness, p.jadedness, p.cohesion, p.tactics, p.trains]);

/** The players of `before` whose rows in `after` hold something else, as "name: before -> after". */
function moved(before, after) {
  const now = new Map(after.map((p) => [p.uid, p]));
  return before
    .filter((p) => row(p) !== row(now.get(p.uid) ?? {}))
    .map((p) => `${p.name}: ${row(p)} -> ${row(now.get(p.uid) ?? {})}`);
}

/**
 * The players of `after` the button left short of what it sets: cohesion for those who had one in `before`, and the
 * tactic for those who play for the team and train, as Max tactics does.
 */
function short(before, after) {
  const was = new Map(before.map((p) => [p.uid, p]));
  return after.filter(
    (p) =>
      p.injuries > 0 ||
      p.morale !== SETS.morale ||
      p.condition !== SETS.condition ||
      p.matchSharpness !== SETS.match_sharpness ||
      p.jadedness !== SETS.jadedness ||
      (was.get(p.uid)?.cohesion != null && p.cohesion !== BEST_COHESION) ||
      (p.tactics != null && p.playsHere && p.trains && p.tactics !== 100),
  );
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
    report.skip("Team at its best", "the human manager has no club on this save");
    return;
  }
  const before = await senior(app, club);
  const injured = before.filter((p) => p.injuries > 0);
  const cohesive = before.filter((p) => p.cohesion != null);
  const tactical = before.filter((p) => p.tactics != null);
  report.note(
    `witness: club ${club}'s senior team, ${before.length} players: ${injured.length} injured, ` +
      `${cohesive.length} with a cohesion, ${tactical.length} with a tactic read`,
  );
  const sample = before.slice(0, 3);
  const probed = () => sample.map((p) => probe.get("player", p.uid, Object.keys(SETS)));
  const probedBefore = probed();
  const healthBefore = checks(probe);

  const done = await app.must("team_action", { club, team: 0, action: "atItsBest" });
  const skipped = Object.fromEntries(done.skipped.map((step) => [step.action, step.reason.code]));
  const said = JSON.stringify(skipped);
  report.check(
    injured.length === 0 ? "it skips Heal all, nobody being injured, and says why" : "it heals the injured, skipping nothing",
    injured.length === 0 ? skipped.heal === "team.nobodyInjured" : !("heal" in skipped),
    said,
  );
  report.check(
    "it runs Inspire all and Refresh all, Max cohesion where a cohesion is read and Max tactics where the tactic is",
    !("inspire" in skipped) &&
      !("refresh" in skipped) &&
      (cohesive.length === 0 || !("maxCohesion" in skipped)) &&
      (tactical.length === 0 || !("maxTactics" in skipped)),
    said,
  );
  report.check("it writes without a refusal", done.failed.length === 0, JSON.stringify(done.failed.slice(0, 3)));
  const after = await senior(app, club);
  const left = short(before, after);
  report.check(
    "every player is then healed, inspired, refreshed, at the best cohesion and knowing the tactic at its best",
    done.applied > 0 && left.length === 0,
    `${done.applied} written${left.length ? `; short: ${left.map((p) => `${p.name} ${row(p)}`).join(", ")}` : ""}`,
  );
  const probedAfter = probed();
  report.check(
    "as the probe reads the first three",
    probedAfter.every((read, i) =>
      Object.entries(SETS).every(([field, value]) => typeof probedBefore[i][field] !== "number" || read[field] === value),
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

  const again = await app.must("team_action", { club, team: 0, action: "atItsBest" });
  report.check(
    "a second press has nothing left to write, and skips Heal all",
    again.applied === 0 && again.failed.length === 0 && again.skipped.some((step) => step.action === "heal" && step.reason.code === "team.nobodyInjured"),
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

  // Where no human picks the tactic, Max tactics is skipped and named, and the other steps still run.
  const [other] = await topClubs(app, 1);
  const theirs = await senior(app, other.uid);
  const elsewhere = await app.must("team_action", { club: other.uid, team: 0, action: "atItsBest" });
  const unpicked = elsewhere.skipped.find((step) => step.action === "maxTactics");
  report.check(
    `on ${other.name}, whose tactic no human picks, Max tactics is skipped and named`,
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

  // The button in the Squad tab, the line under the buttons, and Undo there.
  const human = (await app.must("search_staff", { query: "", limit: 20 })).rows.find((m) => m.isHuman && m.clubUid === club);
  await app.openClub(human.club, club);
  await app.click(
    `[...document.querySelectorAll(".profile-tabs [role=tab]")].filter(${SHOWN}).find((t) => t.textContent.trim() === "Squad")`,
    "the Squad tab",
  );
  const tab = `${VIS}(".squad-tab")`;
  const buttons = `[...(${tab}?.querySelectorAll(".squad-buttons button") ?? [])]`;
  const best = `${buttons}.find((b) => b.textContent === "Team at its best")`;
  await app.waitFor(`${best} && !${best}.disabled && !${best}.hasAttribute("aria-disabled")`, "Team at its best", 30000);
  const title = await app.js(`${best}.title`);
  report.check(
    "the Squad tab has Team at its best after the other buttons, its hover text naming the five steps",
    (await app.js(`${buttons}.at(-1) === ${best}`)) &&
      title.startsWith("Heal all, Inspire all, Refresh all, Max cohesion and Max tactics in one press"),
    title.slice(0, 90),
  );
  await app.click(best, "Team at its best");
  const result = `${tab}.querySelector(".squad-result")`;
  const undo = `${result}?.querySelector("button")`;
  await app.waitFor(
    `${result}?.textContent.includes("written") && ${undo} && !${undo}.hasAttribute("aria-disabled")`,
    "the line under the buttons",
    60000,
  );
  const line = await app.js(`${result}.querySelector("p")?.textContent`);
  const problems = await app.js(`[...${result}.querySelectorAll(".edit-problems li")].map((li) => li.textContent)`);
  const pressed = short(before, await senior(app, club));
  report.check(
    "pressed there, it brings the team to its best, and the line counts the changes",
    line.startsWith(`${changes(done.applied)} written`) && pressed.length === 0,
    `${line}${pressed.length ? `; short: ${pressed.map((p) => p.name).join(", ")}` : ""}`,
  );
  report.check(
    injured.length === 0 ? "and names Heal all as skipped, and why" : "and names no step as skipped",
    injured.length === 0
      ? problems.length === 1 && problems[0] === "Heal all skipped: Nobody in this team is injured."
      : problems.length === 0,
    problems.join(" | "),
  );
  await app.shot("best-pressed");
  await sleep(300);
  await app.click(undo, "Undo");
  await app.waitFor(`${result}?.textContent.includes("Undid")`, "the undo", 60000);
  const restored = moved(before, await senior(app, club));
  report.check("Undo on that line puts every player back", restored.length === 0, restored.slice(0, 3).join("; "));
}
