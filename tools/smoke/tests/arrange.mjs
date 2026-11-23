// A transfer arranged for the game to make on its next day: a player of one of the best known clubs, to the next one,
// for a fee. The plan names the clubs, the fee, the next day and the contract; arranging it logs a change of his club
// with that day, while he stays at his club until then (the probe reads him there); a second one for him, or moving him
// now, is refused while the first stands (`arrange.underWay`); the undo takes it back, after which he can be planned
// again. The game itself is not moved on: what it does on the day is checked in the game (see
// docs/recon/fm27-transfers.md).
import { clubPlayers, topClubs } from "../lib/witness.mjs";

export const name = "arrange";
export const writes = true;

/** The club the probe reads the player at. */
const probedClub = (probe, uid) => probe.run(["player", uid]).match(/^\s+club\s+(.*)$/m)?.[1]?.trim() ?? "?";

/** The day after `date` ({year, month, day}), as a number like 20261019. */
function nextDay(date) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return next.getUTCFullYear() * 10000 + (next.getUTCMonth() + 1) * 100 + next.getUTCDate();
}

export async function run({ app, report, probe }) {
  const connection = await app.must("current_connection");
  if (!connection.arrangesTransfers) {
    report.skip("arranges a transfer for the game to make", "this build or system does not arrange transfers");
    return;
  }
  const [from, to] = await topClubs(app, 2);
  const fee = 7_777_777;
  // The first of the club's players the app agrees to arrange a transfer for, past its best three.
  let found = null;
  const refusals = new Set();
  for (const player of (await clubPlayers(app, from, 20)).slice(3)) {
    const plan = await app.invoke("plan_arranged_transfer", { uid: player.uid, club: to.uid, terms: {}, fee });
    if (plan.ok) {
      found = { player, plan: plan.value };
      break;
    }
    refusals.add(plan.error.code);
  }
  if (!found) {
    report.check("finds a player the app agrees to arrange a transfer for", false, [...refusals].join(", "));
    return;
  }
  const { player, plan } = found;
  report.note(`witness: ${player.name} (${player.uid}), ${from.name} → ${to.name}, £${fee}`);
  const tomorrow = nextDay(connection.gameDate);
  report.check(
    "the plan names the clubs, the fee and the game's next day",
    plan.from.uid === from.uid && plan.to.uid === to.uid && plan.fee === fee && plan.moveDay === tomorrow,
    `${plan.from.name} → ${plan.to.name}, £${plan.fee}, on ${plan.moveDay} (next day ${tomorrow})`,
  );
  // His contract keeps its end, given no other.
  const ends = player.contractExpires;
  const ownEnd = ends ? ends.year * 10000 + ends.month * 100 + ends.day : 0;
  report.check(
    "and the contract he is to have, which keeps the end of his own",
    plan.contract.wage > 0 && (ownEnd > tomorrow ? plan.contract.expires === ownEnd : plan.contract.expires > tomorrow),
    `${JSON.stringify(plan.contract)}, his own ends ${ownEnd}`,
  );

  const arranged = await app.must("arrange_transfer", { uid: player.uid, club: to.uid, terms: {}, fee });
  report.check(
    "arranges it, logged as a change of his club on that day",
    arranged.field === "club" &&
      arranged.moved?.from === from.name &&
      arranged.moved?.to === to.name &&
      arranged.moved?.fee === fee &&
      arranged.moved?.arranged === tomorrow,
    JSON.stringify(arranged.moved),
  );
  const club = probedClub(probe, player.uid);
  report.check("he is still at his club until the day", club.startsWith(from.name.slice(0, 20)), club);
  const again = await app.invoke("plan_arranged_transfer", { uid: player.uid, club: to.uid, terms: {}, fee });
  report.check(
    "a second transfer for him is refused while the first stands",
    !again.ok && again.error.code === "arrange.underWay",
    again.ok ? "planned" : again.error.code,
  );
  const now = await app.invoke("plan_club_move", { uid: player.uid, club: to.uid, terms: {} });
  report.check(
    "and so is moving him now",
    !now.ok && now.error.code === "arrange.underWay",
    now.ok ? "planned" : now.error.code,
  );
  const log = await app.must("change_log");
  report.check("the change log lists it", log.some((change) => change.id === arranged.id && change.moved?.arranged === tomorrow));

  await app.must("undo_change", { id: arranged.id });
  const after = await app.invoke("plan_arranged_transfer", { uid: player.uid, club: to.uid, terms: {}, fee });
  report.check("the undo takes it back: he can be planned again", after.ok, after.ok ? "" : after.error.code);
  report.check("and he is still at his club", probedClub(probe, player.uid).startsWith(from.name.slice(0, 20)));
}
