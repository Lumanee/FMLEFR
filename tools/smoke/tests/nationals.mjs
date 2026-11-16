// The National teams tab (#169): every nation's men's and women's team, read from the two arrays of containers the
// build profile places, with the reputation of each senior team and the players the game lists for it, as the probe
// reads them; the tab's list, its search and its filter, a team's profile with its squad, a player opened from it, and
// Edit offering the reputation (nothing is applied: the edit itself is in the `edit` test). Writes nothing. On a build
// whose profile places no national teams, the tab's note saying why.
import { SHOWN, VIS } from "../lib/app.mjs";

export const name = "nationals";
export const writes = false;

/** More than the game's 502 containers. */
const ALL = 1000;

const ROWS = `[...document.querySelectorAll("table.national-grid tbody tr")].filter(${SHOWN})`;
const PROFILE = `${VIS}(".profile:not(.popup)")`;
const POPUP = `document.querySelector(".modal-backdrop .profile.popup")`;

/**
 * What `fmlibre-probe national-teams UID --squad` reads of one team: its row, and its squad's UIDs in their order. A row
 * ends with the reputation (5 wide, blank for none) and the players (7 wide), two spaces apart.
 */
function probeTeam(probe, uid) {
  const lines = probe.run(["national-teams", uid, "--squad", "--limit", "1"]).split(/\r?\n/);
  const read = lines.find((line) => line.startsWith("Read "))?.match(/^Read (\d+) national teams/);
  const row = lines.find((line) => Number(line.trim().split(/\s+/)[0]) === uid && !line.startsWith("Read"));
  const start = lines.findIndex((line) => line.startsWith("Senior team of"));
  const squad = start < 0 ? [] : lines.slice(start + 1).map((line) => line.match(/^\s+(\d+)\s{2}/)).filter(Boolean);
  const reputation = row?.slice(-14, -9).trim();
  return {
    teams: read ? Number(read[1]) : null,
    reputation: reputation ? Number(reputation) : null,
    players: row ? Number(row.slice(-7).trim()) : null,
    squad: squad.map((m) => Number(m[1])),
  };
}

export async function run({ app, report, probe }) {
  const status = await app.must("national_status");
  if (!status.available) {
    // The tab says why, and nothing else.
    await app.openTab("National teams");
    const note = await app.waitFor(`${VIS}(".national-unavailable h2")?.textContent`, "the tab's note");
    report.check("the tab says why it shows no national teams", /not available/.test(note), `${status.reason}: ${note}`);
    report.skip("the national teams", `this build has none to read (${status.reason})`);
    return;
  }

  // Every container, men's and women's, through the command the list asks.
  const all = await app.must("search_national_teams", { query: "", limit: ALL });
  const men = all.rows.filter((team) => !team.women);
  const women = all.rows.filter((team) => team.women);
  report.check("the list holds the men's and the women's teams of the nations", all.total === status.teams &&
    all.rows.length === all.total && men.length >= 200 && women.length >= 200,
    `${all.total} teams: ${men.length} men's, ${women.length} women's`);
  const withReputation = all.rows.filter((team) => team.reputation !== null).length;
  report.check("nearly every team has a senior team with a reputation", withReputation >= all.total * 0.95,
    `${withReputation} of ${all.total}`);
  const coded = men.filter((team) => /^[A-Z]{3}$/.test(team.code ?? "")).length;
  report.check("the nations have their three-letter codes", coded >= men.length * 0.95, `${coded} of ${men.length}`);
  const onlyWomen = await app.must("search_national_teams", { query: "", limit: ALL, women: true });
  const onlyMen = await app.must("search_national_teams", { query: "", limit: ALL, women: false });
  report.check("the filter keeps to the men's or the women's teams",
    onlyWomen.total === women.length && onlyWomen.rows.every((team) => team.women) &&
      onlyMen.total === men.length && onlyMen.rows.every((team) => !team.women),
    `${onlyMen.total} men's, ${onlyWomen.total} women's`);

  // The best known men's team that lists players, against the probe.
  const team = men.find((t) => t.players > 0 && t.code);
  if (!team) {
    report.skip("a national team's squad", "no men's team lists players");
    return;
  }
  report.note(`witness: ${team.name} (${team.code}, ${team.uid}), reputation ${team.reputation}, ${team.players} players`);
  const seen = probeTeam(probe, team.uid);
  report.check("the probe reads as many teams", seen.teams === all.total, `${seen.teams}`);
  report.check("the probe reads the same reputation and number of players",
    seen.reputation === team.reputation && seen.players === team.players, JSON.stringify(seen));
  const byCode = await app.must("search_national_teams", { query: team.code, limit: 10 });
  report.check(`${team.code} finds ${team.name}`, byCode.rows.some((t) => t.uid === team.uid),
    byCode.rows.map((t) => t.name).join(", "));
  const profile = await app.must("national_squad", { uid: team.uid });
  const squad = profile.squad.players.map((player) => player.uid);
  report.check("its squad is the players the probe reads, in the game's order",
    squad.length === team.players && JSON.stringify(squad) === JSON.stringify(seen.squad),
    `${squad.length} players: ${profile.squad.players.slice(0, 4).map((p) => p.name).join(", ")}`);
  const fields = await app.must("edit_fields", { entity: "nationalTeam" });
  report.check("its reputation is the one field to edit", fields.length === 1 && fields[0].key === "reputation",
    fields.map((field) => field.key).join(", "));

  // The same in the tab: found by its code, its profile and its squad, a player opened over it.
  await app.openTab("National teams");
  await app.waitFor(`${VIS}(".search input")`, "the search");
  await app.setInput(`${VIS}(".search input")`, team.code);
  const row = `${ROWS}.find((tr) => tr.querySelector(".col-uid")?.textContent.trim() === ${JSON.stringify(String(team.uid))})`;
  await app.waitFor(row, `the row of ${team.name}`);
  await app.click(row, `the row of ${team.name}`);
  await app.waitFor(`${PROFILE} && ${PROFILE}.getAttribute("aria-busy") === "false"`, "the team's profile", 30000);
  const names = `[...${PROFILE}.querySelectorAll("table.squad-grid tbody button.name-link")]`;
  await app.waitFor(`${names}.length === ${squad.length}`, `the ${squad.length} names of the squad`);
  const shownNames = await app.js(`${names}.map((b) => b.textContent)`);
  report.check("the profile lists the squad in the game's order",
    JSON.stringify(shownNames) === JSON.stringify(profile.squad.players.map((p) => p.name)), shownNames.slice(0, 4).join(", "));
  const heading = await app.js(`${PROFILE}.querySelector(".squad-count")?.textContent`);
  report.check("the heading counts them", heading?.includes(String(squad.length)), heading);
  await app.shot("nationals-profile");

  await app.click(`${names}[0]`, `${shownNames[0]}'s name`);
  await app.waitFor(`${POPUP}?.getAttribute("aria-busy") === "false"`, "his profile over the squad", 30000);
  const popupName = await app.js(`${POPUP}.querySelector("h2")?.textContent`);
  report.check("a name opens the player's profile", popupName?.includes(shownNames[0]), popupName);
  await app.press("Escape");
  await app.waitFor(`!${POPUP}`, "his profile closed");

  // Edit offers the reputation, and Cancel leaves it as it was.
  const edit = `${PROFILE}.querySelector("button.edit-toggle")`;
  if (await app.js(`!!${edit}`)) {
    await app.click(edit, "Edit");
    const input = `${PROFILE}.querySelector('.edit-input[data-field="reputation"]')`;
    await app.waitFor(input, "the reputation input");
    report.check("Edit offers the reputation as it is", Number(await app.js(`${input}.value`)) === team.reputation,
      await app.js(`${input}.value`));
    await app.click(edit, "Cancel");
    await app.waitFor(`!${PROFILE}.classList.contains("editing")`, "the profile out of Edit");
  } else {
    report.skip("Edit", "the profile has no Edit button: the game cannot be written to");
  }
  await app.setInput(`${VIS}(".search input")`, "");
  await app.press("Escape");
}
