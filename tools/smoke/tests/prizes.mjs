// A club's league prize money (#123), in the Overview of its profile, under its finances: what the league its first
// team plays in pays this season, by final position and per match, as the app reads it in one pass over the game's
// memory, against the probe's `prizes`, which reads it on its own; the group in the club's profile with the league's
// name, every place and the amounts per match, its Change amounts button turning them into inputs (Cancel, nothing is
// saved: the change itself is in the `edit` test), and Read again; a club whose league pays nothing saying so. Writes
// nothing. On a build whose profile does not turn the prize money on, the group's note saying why.
import { VIS } from "../lib/app.mjs";
import { humanClubs, topClubs } from "../lib/witness.mjs";

export const name = "prizes";
export const writes = false;

const PROFILE = `${VIS}(".profile:not(.popup)")`;
const GROUP = `${PROFILE}?.querySelector("section.league-prizes")`;

const amount = (text) => Number(text.replaceAll(",", ""));

/**
 * What `fmlibre-probe prizes UID` prints for one competition: each group of alike settings with its places and what it
 * pays per match, as "places|win|draw|loss" keys, as `stageKey` makes them of the app's.
 */
export function probeStages(probe, uid) {
  const groups = [];
  for (const line of probe.run(["prizes", uid]).split(/\r?\n/)) {
    if (line.includes(`(UID ${uid}`) && !line.startsWith(" ")) {
      groups.push({ places: [], match: null });
    } else if (groups.length && /^\s+\d+\.\s/.test(line)) {
      for (const [, , pounds] of line.matchAll(/(\d+)\.\s+([\d,]+)/g)) groups.at(-1).places.push(amount(pounds));
    } else if (groups.length && line.trim().startsWith("per match:")) {
      const m = line.match(/win ([\d,]+), draw ([\d,]+), loss ([\d,]+)/);
      groups.at(-1).match = m ? [amount(m[1]), amount(m[2]), amount(m[3])] : null;
    }
  }
  return groups.map((g) => [g.places.join(" "), ...(g.match ?? [])].join("|"));
}

export const stageKey = (stage) => [stage.byPosition.join(" "), stage.win, stage.draw, stage.loss].join("|");

/**
 * The first club whose league pays something, of the human managers' clubs and then the best known men's clubs, with
 * what its league pays (`league_prizes`), and the first whose league pays nothing; or why the build shows none.
 */
export async function leagueWitnesses(app, count = 120) {
  const clubs = (await app.must("search_clubs", { query: "", limit: count, filter: { women: false } })).rows;
  const human = await humanClubs(app);
  const ordered = [...clubs.filter((c) => human.includes(c.uid)), ...(await topClubs(app, count))];
  let paying = null;
  let nothing = null;
  for (const club of ordered) {
    const view = await app.must("league_prizes", { club: club.uid, again: false });
    if (view.unavailable) return { unavailable: view.unavailable, club };
    if (view.league && !paying) paying = { club, league: view.league };
    if (!view.league && club.leagueUid != null && !nothing) nothing = { club };
    if (paying && nothing) break;
  }
  return { paying, nothing };
}

/** Opens `club`'s profile and waits for its league prize money group to be read. */
async function openGroup(app, club) {
  await app.openClub(club.name, club.uid);
  await app.waitFor(`${GROUP} && ${GROUP}.getAttribute("aria-busy") === "false"`, `${club.name}'s league prize money`, 120000);
}

export async function run({ app, report, probe }) {
  const started = Date.now();
  const found = await leagueWitnesses(app);
  if (found.unavailable) {
    await openGroup(app, found.club);
    const note = await app.js(`${GROUP}.querySelector("p.note")?.textContent`);
    report.check("the group says why it shows no prize money", /editor/.test(note ?? ""), `${found.unavailable}: ${note}`);
    report.skip("the league prize money", `this build shows none (${found.unavailable})`);
    return;
  }
  if (!found.paying) {
    report.skip("the league prize money", "no league of the best known clubs pays anything this season");
    return;
  }
  const { club, league } = found.paying;
  const first = league.stages[0];
  report.note(`witness: ${club.name} (${club.uid}) in ${league.name} (${league.uid}): ${league.stages.length} stages, ` +
    `the first ${first.byPosition.length} places, win ${first.win}, draw ${first.draw}, loss ${first.loss}; ` +
    `read in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  report.check("its league is the club's", league.uid === club.leagueUid, `${league.uid} / ${club.leagueUid}`);
  report.check("every stage listed pays something", league.stages.length > 0 &&
    league.stages.every((s) => s.win + s.draw + s.loss + s.byPosition.reduce((a, b) => a + b, 0) > 0));
  const seen = probeStages(probe, league.uid).sort();
  const shown = league.stages.map(stageKey).sort();
  report.check(`the app reads what the probe reads of ${league.name}`,
    seen.length > 0 && JSON.stringify([...new Set(seen)]) === JSON.stringify([...new Set(shown)]),
    `probe: ${seen.map((s) => s.slice(0, 60)).join(" / ")}`);

  // The group in the club's profile.
  await openGroup(app, club);
  const note = await app.js(`${GROUP}.querySelector("p.note")?.textContent`);
  report.check("the group names the league", note?.includes(league.name), note);
  const stages = await app.js(`[...${GROUP}.querySelectorAll(".league-stage")].map((s) => ({
    places: s.querySelectorAll("dl.prize-places .stat").length,
    perMatch: [...s.querySelectorAll("dl.stats:not(.prize-places) dd")].map((dd) => dd.textContent),
  }))`);
  report.check("it shows each stage with every place it pays",
    JSON.stringify(stages.map((s) => s.places)) === JSON.stringify(league.stages.map((s) => s.byPosition.length)),
    JSON.stringify(stages.map((s) => s.places)));
  const digits = (text) => text.replace(/\D/g, "");
  const paid = league.stages.map((s) => (s.win + s.draw + s.loss > 0 ? [s.win, s.draw, s.loss].map(String) : []));
  report.check("and what it pays per win, draw and loss, in pounds",
    JSON.stringify(stages.map((s) => s.perMatch.map(digits))) === JSON.stringify(paid), JSON.stringify(stages.map((s) => s.perMatch)));
  await app.shot("prizes-club");

  // Change amounts turns them into inputs, with the note that the change is the league's; Cancel leaves them.
  const change = `[...${GROUP}.querySelectorAll(".prize-actions button")].find((b) => b.textContent === "Change amounts")`;
  if (await app.js(`!!${change} && !${change}.disabled`)) {
    await app.click(change, "Change amounts");
    await app.waitFor(`${GROUP}.querySelector("input.prize-input")`, "the amounts' inputs");
    const inputs = await app.js(`${GROUP}.querySelectorAll(".league-stage")[0].querySelectorAll("input.prize-input").length`);
    report.check("Change amounts offers every amount of the stage", inputs === 3 + first.byPosition.length, `${inputs} inputs`);
    const everyClub = await app.js(`${GROUP}.querySelector(".prize-edit .move-note")?.textContent`);
    report.check("with the note that it is the league's, for every club in it", everyClub?.includes(league.name) &&
      /every club/.test(everyClub), everyClub);
    await app.shot("prizes-inputs");
    await app.click(`[...${GROUP}.querySelectorAll(".prize-edit button")].find((b) => b.textContent === "Cancel")`, "Cancel");
    await app.waitFor(`!${GROUP}.querySelector("input.prize-input")`, "the amounts shown again");
  } else {
    report.skip("Change amounts", "the game cannot be written to");
  }

  // Read again reads them anew.
  const again = `[...${GROUP}.querySelectorAll("button")].find((b) => b.textContent === "Read again")`;
  await app.click(again, "Read again");
  await app.waitFor(`${GROUP}.getAttribute("aria-busy") === "false" && ${again} && !${again}.disabled && ` +
    `${GROUP}.querySelectorAll(".league-stage").length === ${league.stages.length}`, "the amounts read again", 120000);
  report.check("Read again shows them again", true);

  // A club whose league pays nothing.
  if (found.nothing) {
    await openGroup(app, found.nothing.club);
    const none = await app.js(`${GROUP}.querySelector("p.note")?.textContent`);
    report.check(`${found.nothing.club.name}'s league pays nothing, and the group says so`, /pays no prize money/.test(none ?? ""),
      none);
  } else {
    report.skip("a league that pays nothing", "every league of the best known clubs pays something");
  }
  await app.press("Escape");
}
