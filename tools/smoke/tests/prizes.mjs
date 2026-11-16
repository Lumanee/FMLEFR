// The Prize money tab (#123): the competitions whose stages pay prize money, as the app reads them in one pass over
// the game's memory, against the probe's `prizes`, which reads them on its own; the tab's list and its search, a
// competition's profile with every place it pays, and Read again. Writes nothing. On a build whose profile does not
// turn the prize money on, the tab's note saying why.
import { SHOWN, VIS } from "../lib/app.mjs";

export const name = "prizes";
export const writes = false;

const ROWS = `[...document.querySelectorAll("table.prize-grid tbody tr")].filter(${SHOWN})`;
const PROFILE = `${VIS}(".profile:not(.popup)")`;

const amount = (text) => Number(text.replaceAll(",", ""));

/**
 * What `fmlibre-probe prizes UID` prints for one competition: each group of alike settings with its places and what it
 * pays per match, as "list|win|draw|loss" keys.
 */
function probeStages(probe, uid) {
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

const appStage = (stage) => [stage.byPosition.join(" "), stage.win, stage.draw, stage.loss].join("|");

export async function run({ app, report, probe }) {
  const started = Date.now();
  const view = await app.must("prize_money");
  if (view.unavailable) {
    await app.openTab("Prize money");
    const note = await app.waitFor(`${VIS}(".prize-unavailable h2")?.textContent`, "the tab's note", 60000);
    report.check("the tab says why it shows no prize money", /not available/.test(note), `${view.unavailable}: ${note}`);
    report.skip("the prize money", `this build shows none (${view.unavailable})`);
    return;
  }
  const competitions = view.competitions;
  report.check("competitions pay prize money", competitions.length > 0,
    `${competitions.length} competitions, read in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  const named = competitions.filter((c) => c.uid > 0 && c.name && c.stages.length > 0).length;
  report.check("each has a UID, a name and a stage that pays", named === competitions.length, `${named} of ${competitions.length}`);
  const paying = competitions.every((c) => c.stages.every((s) => s.win + s.draw + s.loss + s.byPosition.reduce((a, b) => a + b, 0) > 0));
  report.check("every stage listed pays something", paying);

  // The competition that pays the most places, against the probe.
  const longest = (c) => Math.max(...c.stages.map((s) => s.byPosition.length));
  const competition = [...competitions].sort((a, b) => longest(b) - longest(a) || a.uid - b.uid)[0];
  const first = competition.stages[0];
  report.note(`witness: ${competition.name} (${competition.uid}), ${competition.nation ?? "international"}: ` +
    `${competition.stages.length} stages, the first ${first.byPosition.length} places, ` +
    `win ${first.win}, draw ${first.draw}, loss ${first.loss}`);
  const seen = probeStages(probe, competition.uid).sort();
  const shown = competition.stages.map(appStage).sort();
  report.check(`the app reads what the probe reads of ${competition.name}`,
    seen.length > 0 && JSON.stringify([...new Set(seen)]) === JSON.stringify([...new Set(shown)]),
    `probe: ${seen.map((s) => s.slice(0, 40)).join(" / ")}`);

  // The tab: the list, the competition found by its UID, its profile with every place.
  await app.openTab("Prize money");
  await app.waitFor(`${ROWS}.length === ${competitions.length}`, `the ${competitions.length} competitions`, 60000);
  report.check("the tab lists them", true, `${competitions.length} rows`);
  await app.setInput(`${VIS}(".search input")`, String(competition.uid));
  const row = `${ROWS}.find((tr) => tr.querySelector(".col-uid")?.textContent.trim() === ${JSON.stringify(String(competition.uid))})`;
  await app.waitFor(`${ROWS}.length === 1 && ${row}`, `${competition.name} alone`);
  const places = await app.js(`${row}.querySelectorAll("td.num")[0].textContent.trim()`);
  const counted = first.byPosition.length > 0 ? Number(places) === first.byPosition.length : !/^\d+$/.test(places);
  report.check("its row counts the places of its first stage", counted, places);
  await app.click(row, `the row of ${competition.name}`);
  await app.waitFor(`${PROFILE}?.querySelector("h2")?.textContent.includes(${JSON.stringify(competition.name)})`,
    `${competition.name}'s profile`);
  const listed = await app.js(`[...${PROFILE}.querySelectorAll("dl.prize-places")].map((dl) => dl.querySelectorAll("dt").length)`);
  report.check("its profile lists every place of every stage",
    JSON.stringify(listed) === JSON.stringify(competition.stages.map((s) => s.byPosition.length).filter((n) => n > 0)),
    JSON.stringify(listed));
  await app.shot("prizes-profile");

  // Read again reads them anew and keeps the list.
  const again = `[...document.querySelectorAll(".workspace:not(.inactive) .toolbar button")].find((b) => b.textContent === "Read again")`;
  await app.setInput(`${VIS}(".search input")`, "");
  await app.click(again, "Read again");
  await app.waitFor(`!${again}.disabled && ${ROWS}.length === ${competitions.length}`, "the list read again", 60000);
  report.check("Read again lists them again", true);
  await app.press("Escape");
}
