// Editing a player: fields written through the app's commands, read back by the probe, and undone from the change
// log; his city of birth set to another city of his nation and back, and refused a nation in its place; the squad
// numbers of two players of one team, where the undo that would give both one number is refused; a national team's
// reputation and one of its youth teams', where the build has national teams; one amount of a league's prize money,
// where the build shows it; then one attribute through his profile's Edit mode, undone from the Changes tab.
import { SHOWN, VIS } from "../lib/app.mjs";
import { clubPlayers, topClubs } from "../lib/witness.mjs";
import { leagueWitnesses, openGroup, probeStages, stageKey } from "./prizes.mjs";

export const name = "edit";
export const writes = true;

const FIELDS = ["attribute.finishing", "attribute.passing", "contract.wage"];
const NUMBER = "contract.squad_number";

export async function run({ app, report, probe }) {
  const [, club] = await topClubs(app, 2);
  const [player] = await clubPlayers(app, club, 1);
  const uid = player.uid;
  report.note(`witness: ${player.name} (${uid}) of ${club.name}`);
  const before = await app.must("read_values", { entity: "player", uid });
  const seen = probe.get("player", uid, FIELDS);
  report.check("the probe reads what the app reads", FIELDS.every((field) => seen[field] === before[field]), JSON.stringify(seen));

  const nudge = (value, step, top) => (value + step <= top ? value + step : value - step);
  const edits = [
    { field: "attribute.finishing", value: nudge(before["attribute.finishing"], 5, 100) },
    { field: "attribute.passing", value: nudge(before["attribute.passing"], 5, 100) },
    { field: "contract.wage", value: before["contract.wage"] + 1000 },
  ];
  const applied = await app.must("apply_edits", { entity: "player", uid, edits });
  report.check("applies three edits", applied.applied.length === 3 && applied.failed.length === 0, JSON.stringify(applied.failed));
  const written = probe.get("player", uid, FIELDS);
  report.check("the probe reads the new values", edits.every((edit) => written[edit.field] === edit.value), JSON.stringify(written));

  for (const change of [...applied.applied].reverse()) {
    const undone = await app.must("undo_change", { id: change.id });
    report.check(`undoes ${change.field}`, undone.undoneAt != null);
  }
  const twice = await app.invoke("undo_change", { id: applied.applied[0].id });
  report.check("refuses to undo twice", !twice.ok);
  const restored = probe.get("player", uid, FIELDS);
  report.check("the probe reads the old values again", FIELDS.every((field) => restored[field] === seen[field]), JSON.stringify(restored));

  await cityOfBirth({ app, report, probe, club });
  await squadNumbers({ app, report, probe, club });
  await nationalReputation({ app, report, probe });
  await leaguePrizeMoney({ app, report, probe });

  // The same through his profile.
  await app.openTab("Players");
  await app.setInput(`${VIS}(".search input")`, String(uid));
  const rows = `[...document.querySelectorAll("table.grid tbody tr")].filter(${SHOWN})`;
  await app.waitFor(`${rows}.length === 1 && ${rows}[0].textContent.includes(${JSON.stringify(player.name)})`, "his row");
  await app.click(`${rows}[0]`, "his row");
  const profile = `${VIS}(".profile:not(.popup)")`;
  await app.waitFor(`${profile} && ${profile}.getAttribute("aria-busy") === "false"`, "his profile", 30000);
  await app.click(`${profile}.querySelector("button.edit-toggle")`, "Edit");
  const input = `${profile}.querySelector('.edit-input[data-field="attribute.finishing"]')`;
  await app.waitFor(input, "the Finishing input");
  const shown = Number(await app.js(`${input}.value`));
  await app.setInput(input, shown < 20 ? shown + 1 : shown - 1);
  await app.waitFor(`${profile}.querySelector(".edit-count.pending")`, "one change to apply");
  await app.click(`${profile}.querySelector(".edit-footer button.primary")`, "Apply");
  await app.waitFor(`!${profile}.classList.contains("editing") && ${profile}.querySelector(".edit-report")?.textContent`, "the report");
  const viaProfile = probe.get("player", uid, ["attribute.finishing"])["attribute.finishing"];
  report.check("Edit mode writes the attribute", viaProfile !== seen["attribute.finishing"], `${seen["attribute.finishing"]} → ${viaProfile}`);
  await app.shot("edit-applied");

  await app.openTab("Changes");
  const undo = `document.querySelector("table.changes-grid tbody tr td.col-status button")`;
  await app.waitFor(undo, "the change in the Changes tab");
  await app.click(undo, "Undo");
  await app.waitFor(`/Undone/.test(document.querySelector("table.changes-grid tbody tr td.col-status")?.textContent ?? "")`, "Undone");
  const back = probe.get("player", uid, ["attribute.finishing"])["attribute.finishing"];
  report.check("the Changes tab undoes it", back === seen["attribute.finishing"], `back to ${back}`);
  await app.openTab("Players");
  await app.press("Escape");
}

/** The city of birth of one of `club`'s players: set to another city of his nation, refused a nation, and undone. */
async function cityOfBirth({ app, report, probe, club }) {
  const cities = await app.must("birth_cities");
  let found = null;
  for (const player of await clubPlayers(app, club, 20)) {
    const values = await app.must("read_values", { entity: "player", uid: player.uid });
    const current = cities.find((city) => city.address === values.city_of_birth);
    const other = current && cities.find((city) => city.nationUid === current.nationUid && city.address !== current.address);
    if (other) {
      found = { player, values, current, other };
      break;
    }
  }
  if (found === null) {
    report.skip("the city of birth", `no player of ${club.name} was born in a city another city of his nation is offered beside`);
    return;
  }
  const { player, values, current, other } = found;
  const uid = player.uid;
  report.note(`city of birth: ${player.name} (${uid}), ${current.name} → ${other.name}`);
  const set = await app.must("apply_edits", { entity: "player", uid, edits: [{ field: "city_of_birth", value: other.address }] });
  report.check(
    "sets his city of birth to another city of his nation",
    set.applied.length === 1 && set.failed.length === 0,
    JSON.stringify(set.failed),
  );
  const written = probe.get("player", uid, ["city_of_birth"]).city_of_birth;
  report.check("the probe reads the new city", written === other.address, `${written}`);
  const nation = await app.must("apply_edits", { entity: "player", uid, edits: [{ field: "city_of_birth", value: values.nation }] });
  report.check(
    "refuses a nation as his city of birth",
    nation.applied.length === 0 && nation.failed[0]?.error.code === "edit.unsupported",
    nation.failed[0]?.error.code ?? "written",
  );
  for (const change of set.applied) {
    await app.must("undo_change", { id: change.id });
  }
  const back = probe.get("player", uid, ["city_of_birth"]).city_of_birth;
  report.check("undoing it puts his city back", back === current.address, `${back}`);
}

/**
 * The squad numbers of two players of one team of `club`: the first goes to a number nobody wears, the second takes the
 * number the first left, and the first's undo, which would put that number back beside the second, is refused with
 * nothing written (`edit.taken`, naming the second). The second's undo and then the first's go through, and the probe
 * reads both numbers as they were.
 */
async function squadNumbers({ app, report, probe, club }) {
  const [senior] = await app.must("club_squads", { uid: club.uid });
  const team = senior.players.filter((player) => player.playsHere);
  const numbers = new Map();
  for (const player of team) {
    numbers.set(player.uid, (await app.must("read_values", { entity: "player", uid: player.uid }))[NUMBER]);
  }
  // Numbers of their own: one player of the team wears each, as the game's own data has it for nearly every team.
  const wearing = (number) => [...numbers.values()].filter((worn) => worn === number).length;
  const [first, second] = team.filter((player) => numbers.get(player.uid) <= 99 && wearing(numbers.get(player.uid)) === 1);
  const free = Array.from({ length: 99 }, (_, i) => i + 1).find((number) => wearing(number) === 0);
  if (second === undefined || free === undefined) {
    report.skip("the squad numbers", `${club.name}'s first team has no two players with a number of their own to change`);
    return;
  }
  const [was, took] = [numbers.get(first.uid), numbers.get(second.uid)];
  report.note(`squad numbers: ${first.name} (${first.uid}) ${was} → ${free}, then ${second.name} (${second.uid}) ${took} → ${was}`);
  const edit = (player, value) =>
    app.must("apply_edits", { entity: "player", uid: player.uid, edits: [{ field: NUMBER, value }] });
  const read = (player) => probe.get("player", player.uid, [NUMBER])[NUMBER];
  const numbersNow = () => `${first.name} ${read(first)}, ${second.name} ${read(second)}`;

  const gone = await edit(first, free);
  const given = await edit(second, was);
  const written = [gone, given].every((edited) => edited.applied.length === 1 && edited.failed.length === 0);
  report.check(
    "gives one player a free number and his team-mate the number he left",
    written,
    JSON.stringify([gone.failed, given.failed]),
  );
  if (!written) return;
  report.check("the probe reads the new numbers", read(first) === free && read(second) === was, numbersNow());

  const [goneId, givenId] = [gone.applied[0].id, given.applied[0].id];
  const refused = await app.invoke("undo_change", { id: goneId });
  report.check(
    "refuses to put the first player's number back while his team-mate wears it",
    !refused.ok && refused.error.code === "edit.taken" && refused.error.params?.uid === String(second.uid),
    JSON.stringify(refused),
  );
  report.check("the refusal names him", refused.error?.params?.name === second.name, JSON.stringify(refused.error?.params));
  const log = await app.must("change_log");
  report.check(
    "nothing was written, and his change is still there to undo",
    read(first) === free && read(second) === was && log.find((change) => change.id === goneId)?.undoneAt == null,
    numbersNow(),
  );

  const undoneGiven = await app.invoke("undo_change", { id: givenId });
  const undoneGone = await app.invoke("undo_change", { id: goneId });
  report.check(
    "undoes the team-mate's change, and then the first player's",
    undoneGiven.ok && undoneGone.ok,
    JSON.stringify([undoneGiven.error, undoneGone.error]),
  );
  report.check("the probe reads both numbers as they were", read(first) === was && read(second) === took, numbersNow());
}

/**
 * The reputation of the best known national team's senior team, where the build has national teams (#169): written
 * through the app's command, read back by the probe and in the list's row, and undone; then that of one of its youth
 * teams (#210), the under-21s where it has them, read back by the probe and in its profile, and undone.
 */
async function nationalReputation({ app, report, probe }) {
  const status = await app.must("national_status");
  if (!status.available) {
    report.skip("a national team's reputation", `this build has no national teams to read (${status.reason})`);
    return;
  }
  const [team] = (await app.must("search_national_teams", { query: "", limit: 1 })).rows;
  const label = `${team.name}${team.women ? " (women)" : ""}`;
  const read = () => probe.get("national-team", team.uid, ["reputation"]).reputation;
  const row = async () =>
    (await app.must("search_national_teams", { query: String(team.uid), limit: 5 })).rows.find((t) => t.uid === team.uid);
  const before = (await app.must("read_values", { entity: "nationalTeam", uid: team.uid })).reputation;
  report.check(`the probe reads ${label}'s reputation as the app does`, read() === before && team.reputation === before,
    `${before}`);
  const value = before < 10000 ? before + 1 : before - 1;
  const applied = await app.must("apply_edits", {
    entity: "nationalTeam",
    uid: team.uid,
    edits: [{ field: "reputation", value }],
  });
  report.check("writes a national team's reputation", applied.applied.length === 1 && applied.failed.length === 0,
    JSON.stringify(applied.failed));
  if (applied.applied.length !== 1) return;
  report.check("the probe reads the new reputation, and the list's row shows it", read() === value &&
    (await row())?.reputation === value, `${before} → ${value}`);
  const logged = (await app.must("change_log")).find((change) => change.id === applied.applied[0].id);
  report.check("the change log names the national team", logged?.entity === "nationalTeam" && logged?.name === team.name,
    JSON.stringify({ entity: logged?.entity, name: logged?.name }));
  await app.must("undo_change", { id: applied.applied[0].id });
  report.check("the undo puts it back", read() === before && (await row())?.reputation === before, `${read()}`);

  // One of its youth teams, by its kind (#210): the under-21s where it has them.
  const { teams } = await app.must("national_squad", { uid: team.uid });
  const youth = teams.find((side) => side.kind === 10) ?? teams.find((side) => side.kind !== 0);
  if (!youth) {
    report.skip("a national youth team's reputation", `${label} has no youth team`);
    return;
  }
  const field = `team.${youth.kind}.reputation`;
  const readYouth = () => probe.get("national-team", team.uid, [field])[field];
  const shownYouth = async () =>
    (await app.must("national_squad", { uid: team.uid, kind: youth.kind })).teams.find((side) => side.kind === youth.kind)
      ?.reputation;
  const was = (await app.must("read_values", { entity: "nationalTeam", uid: team.uid }))[field];
  report.check(`the probe reads ${label}'s ${field} as the app does`, readYouth() === was && youth.reputation === was,
    `${was}`);
  const to = was < 10000 ? was + 1 : was - 1;
  const done = await app.must("apply_edits", { entity: "nationalTeam", uid: team.uid, edits: [{ field, value: to }] });
  report.check(`writes ${field}`, done.applied.length === 1 && done.failed.length === 0, JSON.stringify(done.failed));
  if (done.applied.length !== 1) return;
  report.check("the probe reads it, the profile shows it, and the senior team's stays",
    readYouth() === to && (await shownYouth()) === to && read() === before, `${was} → ${to}`);
  const youthLogged = (await app.must("change_log")).find((change) => change.id === done.applied[0].id);
  report.check("the change log names the national team and the field",
    youthLogged?.entity === "nationalTeam" && youthLogged?.name === team.name && youthLogged?.field === field,
    JSON.stringify({ entity: youthLogged?.entity, name: youthLogged?.name, field: youthLogged?.field }));
  await app.must("undo_change", { id: done.applied[0].id });
  report.check("the undo puts the youth team's back", readYouth() === was && (await shownYouth()) === was, `${readYouth()}`);
}

/**
 * What a league pays (#123), where the build shows it: one amount of its first stage (per win, or else for the first
 * place) set through the app's command for every club in it, read back by the probe in each settings of the stage and
 * in what the app keeps, logged as a change of the club with the league, and undone; then the same amount through the
 * group's Change amounts and Save in the club's profile, and undone.
 */
async function leaguePrizeMoney({ app, report, probe }) {
  const found = await leagueWitnesses(app);
  if (found.unavailable || !found.paying) {
    report.skip("a league's prize money", found.unavailable ? `this build shows none (${found.unavailable})`
      : "no league of the best known clubs pays anything this season");
    return;
  }
  const { club, league } = found.paying;
  const stage = league.stages[0];
  const [kind, was] = stage.win > 0 ? ["win", stage.win] : ["place", stage.byPosition[0]];
  const field = kind === "win" ? "prize.win" : "prize.place.1";
  const input = (pounds) => (kind === "win" ? { kind, pounds } : { kind, place: 1, pounds });
  const as = (pounds) => stageKey(kind === "win" ? { ...stage, win: pounds } : { ...stage, byPosition: [pounds, ...stage.byPosition.slice(1)] });
  // Whether the probe reads the stage paying `pounds` in each of its settings: none of them pays another of the amounts.
  const reads = (pounds) => {
    const seen = probeStages(probe, league.uid);
    return [was, was + 1, was + 2].every((amount) => seen.includes(as(amount)) === (amount === pounds));
  };
  const kept = async () => (await app.must("league_prizes", { club: club.uid, again: false })).league?.stages[0];
  report.note(`witness: ${league.name} (${league.uid}) through ${club.name}, ${field} ${was}`);
  report.check(`the probe reads ${league.name}'s ${field} as the app does`, reads(was), `${was}`);

  const to = was + 1;
  const set = await app.must("set_league_prizes", { club: club.uid, stage: 0, amounts: [input(to)] });
  report.check(`sets ${field} of ${league.name}`, set.changes.length === 1 && set.league?.stages[0] != null &&
    stageKey(set.league.stages[0]) === as(to), JSON.stringify(set.changes.map((c) => c.field)));
  if (set.changes.length !== 1) return;
  report.check("the probe reads it in each settings of the stage, and the app keeps it", reads(to) &&
    stageKey(await kept()) === as(to), `${was} → ${to}`);
  const logged = (await app.must("change_log")).find((change) => change.id === set.changes[0].id);
  report.check("the change log keeps it as a change of the club, with the league",
    logged?.entity === "club" && logged?.uid === club.uid && logged?.field === field && logged?.prize?.leagueUid === league.uid &&
      logged?.prize?.settings === stage.count,
    JSON.stringify({ entity: logged?.entity, field: logged?.field, prize: logged?.prize }));
  await app.must("undo_change", { id: set.changes[0].id });
  report.check("the undo puts it back", reads(was) && stageKey(await kept()) === as(was), `${to} → ${was}`);

  // The same through the group in the club's profile: Change amounts, the amount typed, Save.
  const group = `${VIS}(".profile:not(.popup)")?.querySelector("section.league-prizes")`;
  await openGroup(app, club);
  const change = `[...${group}.querySelectorAll(".prize-actions button")].find((b) => b.textContent === "Change amounts")`;
  await app.waitFor(`${change} && !${change}.disabled`, "Change amounts");
  await app.click(change, "Change amounts");
  const label = kind === "win" ? "Per win" : "1.";
  const box = `${group}.querySelectorAll(".league-stage")[0].querySelector('input.prize-input[aria-label="${label}"]')`;
  await app.waitFor(box, `the ${label} input`);
  await app.setInput(box, String(was + 2));
  const save = `[...${group}.querySelectorAll(".prize-edit button")].find((b) => b.textContent === "Save amounts")`;
  await app.waitFor(`${save} && !${save}.disabled`, "Save amounts");
  await app.click(save, "Save amounts");
  await app.waitFor(`!${group}.querySelector("input.prize-input")`, "the amounts saved", 30000);
  const shown = await app.js(`${group}.querySelectorAll(".league-stage")[0].textContent`);
  report.check("Save writes the amount typed, and the group shows it", reads(was + 2) &&
    shown.replace(/\D/g, "").includes(String(was + 2)), `${was} → ${was + 2}`);
  const saved = (await app.must("change_log")).find((change) => change.undoneAt == null && change.entity === "club" &&
    change.uid === club.uid && change.field === field);
  if (saved) await app.must("undo_change", { id: saved.id });
  report.check("its undo puts it back", saved != null && reads(was), `${was + 2} → ${was}`);
  await app.press("Escape");
}
