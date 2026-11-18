// The clubs' finances and the club list's filters. The clubs of the leagues being played keep their finances, which
// look real and read as the probe reads them (a finance record laid out otherwise leaves every club's finances unread,
// and no check before a write fails for it). The filters: the nation a club is from, the league its first team plays
// in this season and its reputation. The best known clubs have a nation and a league (where the layout misplaced them
// they would have none); each filter keeps to what it asks, through the commands and in the list; a mass edit plans
// for the clubs the list shows. Writes nothing: the mass edit is only planned.
import { SHOWN, VIS } from "../lib/app.mjs";
import { humanClubs } from "../lib/witness.mjs";

export const name = "clubs";
export const writes = false;

/** More than the clubs of any nation, so that a page holds them all. */
const ALL = 100000;

/** A name without accents, in lower case, as the filters compare names. */
const fold = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const BAR = `${VIS}(".club-filter-bar")`;
const ROWS = `[...document.querySelectorAll(".club-grid tbody tr")].filter(${SHOWN})`;

/**
 * The finances of the user's clubs and of the best known men's clubs: those of the leagues being played keep them.
 * The update of 17 November 2026 moved corporate facilities in the finance record, after which no club's finances
 * were read on the new builds until their profiles said where.
 */
async function finances({ app, report, probe }) {
  const human = await humanClubs(app);
  const best = (await app.must("search_clubs", { query: "", limit: 40, filter: { women: false } })).rows;
  const uids = [...new Set([...human, ...best.map((club) => club.uid)])];
  const details = [];
  for (const uid of uids) details.push(await app.must("club_details", { uid }));
  const kept = details.filter((club) => club.finances !== null);
  report.check("clubs of the leagues being played keep their finances", kept.length > 0,
    `${kept.length} of ${uids.length}: ${kept.slice(0, 4).map((club) => club.name).join(", ")}`);
  const mine = details.filter((club) => human.includes(club.uid));
  if (mine.length > 0) {
    report.check("the user's club keeps its finances", mine.every((club) => club.finances !== null),
      mine.map((club) => `${club.name}: ${club.finances ? "kept" : "none"}`).join(", "));
  }
  if (kept.length === 0) return;
  const real = kept.filter(({ finances: f, facilities }) =>
    facilities.corporate >= 1 && facilities.corporate <= 20 && f.ticketPrice >= 1 && f.ticketPrice <= 1000 &&
      f.transferBudget >= -1 && f.wageBudget >= 0 && f.totalWageBudget >= 0);
  report.check("their corporate facilities, budgets and ticket prices look real", real.length === kept.length,
    `${real.length} of ${kept.length}`);
  const [club] = kept;
  const fields = ["finance.balance", "finance.transfer_budget", "finance.wage_budget", "facilities.corporate"];
  const seen = probe.get("club", club.uid, fields);
  const shown = [club.finances.balance, club.finances.transferBudget, club.finances.wageBudget, club.facilities.corporate];
  report.check(`the probe reads ${club.name}'s finances as the app does`,
    fields.every((field, at) => seen[field] === shown[at]), JSON.stringify(seen));
}

export async function run({ app, report, probe }) {
  await finances({ app, report, probe });

  // The best known men's clubs all have a nation, and nearly all a league this season, of a nation.
  const top = (await app.must("search_clubs", { query: "", limit: 200, filter: { women: false } })).rows;
  const withNation = top.filter((club) => club.nation && club.nationUid != null).length;
  const withLeague = top.filter((club) => club.league && club.leagueUid != null && club.leagueNation).length;
  report.check("the best known men's clubs have a nation", withNation === top.length, `${withNation} of ${top.length}`);
  report.check("nearly all of them a league this season, and its nation", withLeague >= top.length * 0.9,
    `${withLeague} of ${top.length}`);
  const club = top.find((c) => c.nation && c.leagueUid != null);
  if (!club) {
    report.skip("the filters", "no club with a nation and a league");
    return;
  }
  report.note(`${club.name}: ${club.nation}; ${club.league}, a league of ${club.leagueNation}`);

  // Each filter through the command the list asks.
  const byNation = await app.must("search_clubs", { query: "", limit: ALL, filter: { nation: club.nation } });
  report.check(`the nation filter keeps the clubs of ${club.nation}`,
    byNation.total > 0 && byNation.rows.every((c) => c.nation && fold(c.nation).includes(fold(club.nation))),
    `${byNation.total} clubs`);
  const leagues = await app.must("club_leagues", { filter: { nation: club.nation } });
  const league = leagues.find((l) => l.uid === club.leagueUid);
  report.check(`the leagues of ${club.nation}'s clubs include ${club.league}`, !!league,
    leagues.slice(0, 5).map((l) => l.name).join(", "));
  const byLeague = await app.must("search_clubs", {
    query: "",
    limit: ALL,
    filter: { nation: club.nation, leagueUid: club.leagueUid },
  });
  report.check("the league filter keeps the clubs of that league, as many as the league select says",
    byLeague.rows.every((c) => c.leagueUid === club.leagueUid) && byLeague.total === league?.clubs,
    `${byLeague.total} clubs (the select: ${league?.clubs})`);
  const [min, max] = [Math.max(0, club.reputation - 500), Math.min(10000, club.reputation + 500)];
  const byReputation = await app.must("search_clubs", { query: "", limit: ALL, filter: { minReputation: min, maxReputation: max } });
  report.check(`the reputation filter keeps the clubs from ${min} to ${max}`,
    byReputation.total > 0 && byReputation.rows.every((c) => c.reputation !== null && c.reputation >= min && c.reputation <= max),
    `${byReputation.total} clubs`);

  // The same in the list: the nation typed, then the league picked from the select.
  await app.openTab("Clubs");
  // An earlier test may have searched for one club (see `openClub`).
  await app.waitFor(`${VIS}(".search input")`, "the clubs' search");
  await app.setInput(`${VIS}(".search input")`, "");
  await app.waitFor(BAR, "the club list's filters");
  if (await app.js(`${BAR}.querySelector(".filter-toggle").getAttribute("aria-expanded") !== "true"`)) {
    await app.click(`${BAR}.querySelector(".filter-toggle")`, "Filters");
  }
  await app.waitFor(`!!${BAR}.querySelector(".league-select")`, "the inputs");
  await app.setInput(`${BAR}.querySelector("input[type=text]")`, club.nation);
  const option = JSON.stringify(String(club.leagueUid));
  await app.waitFor(`[...${BAR}.querySelectorAll(".league-select option")].some((o) => o.value === ${option})`,
    `${club.league} among the leagues offered`);
  await app.setInput(`${BAR}.querySelector(".league-select")`, String(club.leagueUid));
  const shown = Math.min(byLeague.total, 200);
  await app.waitFor(`${ROWS}.length === ${shown} && ${ROWS}.every((tr) => tr.querySelector(".col-league")?.title === ${JSON.stringify(club.league)})`,
    `the ${shown} clubs of ${club.league}`, 20000);
  report.check("the list shows that league's clubs of that nation", true, `${shown} rows`);
  const count = await app.js(`${BAR}.querySelector(".filter-count")?.textContent`);
  report.check("the filter button counts two filters", count === "2", String(count));
  await app.shot("clubs");

  // A mass edit over the list plans for the clubs it shows, every match and not only the rows on screen.
  const plan = await app.must("plan_mass_edit", {
    entity: "club",
    query: "",
    filters: { clubFilter: { nation: club.nation, leagueUid: club.leagueUid } },
    operations: [{ field: "reputation", operation: { op: "add", amount: 1 } }],
  });
  report.check("a mass edit over the filtered list plans for those clubs", plan.targets === byLeague.total,
    `${plan.targets} of ${byLeague.total}`);

  await app.click(`${BAR}.querySelector(".filter-clear")`, "Clear");
  const log = await app.must("change_log");
  report.check("nothing was written", log.length === 0, `${log.length} changes`);
}
