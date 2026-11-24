// The Squad calculator tab of a club's profile: for a formation, the eleven starters, a replacement for each place, and
// the players to send to the reserve team or the under-19s. It only reads the squads the Squad tab reads (see
// `lineup.ts` for how it chooses) and never writes to the game.

import { useMemo, useState } from "react";
import { Ability } from "./Ability";
import { formatNumber } from "./format";
import {
  buildLineup,
  clubPlayers,
  DEFAULT_FORMATION,
  FORMATION_NAMES,
  type Destination,
  type FormationName,
  type Pick,
  type Placement,
} from "./lineup";
import { lineupText as text } from "./lineupText";
import { positionLabel, profileText, squadText, teamLabel } from "./labels";
import type { PanelIds } from "./ProfileParts";
import { useSquads } from "./SquadTab";
import type { SquadPlayer } from "./types";

interface LineupTabProps {
  clubUid: number;
  /** Changes when the game data is read again, so the calculation is too. */
  version: number;
  panel: PanelIds;
}

const average = (value: number | null) =>
  value === null ? "–" : formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const DESTINATIONS: readonly Destination[] = ["u19", "reserve", "rotation"];

export function LineupTab({ clubUid, version, panel }: LineupTabProps) {
  const loaded = useSquads(clubUid, version);
  const [formation, setFormation] = useState<FormationName>(DEFAULT_FORMATION);
  const [includeUnavailable, setIncludeUnavailable] = useState(false);

  const teams = loaded?.details;
  const players = useMemo(() => (teams ? clubPlayers(teams) : []), [teams]);
  const lineup = useMemo(
    () => buildLineup(players, { formation, includeUnavailable }),
    [players, formation, includeUnavailable],
  );
  // The team each player plays for now, by label.
  const playsFor = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams ?? []) {
      for (const player of team.players) {
        if (player.playsHere && !map.has(player.uid)) {
          map.set(player.uid, teamLabel(team));
        }
      }
    }
    return map;
  }, [teams]);

  return (
    <div className="lineup" role="tabpanel" id={panel.id} aria-labelledby={panel.labelledBy}>
      {loaded === null ? (
        <p className="muted">{text.loading}</p>
      ) : loaded.error !== undefined ? (
        <p className="error">{loaded.error}</p>
      ) : players.length === 0 ? (
        <p className="muted">{text.empty}</p>
      ) : (
        <>
          <p className="muted">{text.intro}</p>
          <div className="lineup-controls">
            <div className="squad-teams" role="group" aria-label={text.formation}>
              {FORMATION_NAMES.map((name) => (
                <button key={name} type="button" aria-pressed={name === formation} onClick={() => setFormation(name)}>
                  {name}
                </button>
              ))}
            </div>
            <label className="lineup-check">
              <input
                type="checkbox"
                checked={includeUnavailable}
                onChange={(event) => setIncludeUnavailable(event.target.checked)}
              />
              {text.includeUnavailable}
            </label>
          </div>

          <PicksTable title={text.starters} picks={lineup.starters} average={lineup.startersAverage} playsFor={playsFor} />
          <PicksTable
            title={text.replacements}
            picks={lineup.replacements}
            average={lineup.replacementsAverage}
            playsFor={playsFor}
          />
          {DESTINATIONS.map((destination) => {
            const group = lineup.placements.filter((placement) => placement.destination === destination);
            return group.length === 0 ? null : (
              <PlacementTable
                key={destination}
                title={text.groups[destination]}
                placements={group}
                playsFor={playsFor}
              />
            );
          })}
          {lineup.unavailable.length > 0 && (
            <section className="lineup-section">
              <h3>
                {text.unavailable} <span className="muted">({lineup.unavailable.length})</span>
              </h3>
              <ul className="lineup-unavailable">
                {lineup.unavailable.map(({ player, reason }) => (
                  <li key={player.uid}>
                    {player.name} <span className="muted">· {text.unavailableReasons[reason]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <details className="lineup-rules">
            <summary>{text.rulesTitle}</summary>
            <ul>
              {text.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function PlayerCells({ player, playsFor }: { player: SquadPlayer; playsFor: ReadonlyMap<number, string> }) {
  return (
    <>
      <td className="col-name" title={player.fullName ?? player.name}>
        {player.name}
      </td>
      <td className="num">{player.age ?? profileText.none}</td>
      <td className="num">
        <Ability value={player.currentAbility} />
      </td>
      <td className="num">
        <Ability value={player.potentialAbility} />
      </td>
      <td>{playsFor.get(player.uid) ?? <span className="muted">{profileText.none}</span>}</td>
    </>
  );
}

function Header({ withPlace }: { withPlace: boolean }) {
  return (
    <thead>
      <tr>
        {withPlace && <th>{text.place}</th>}
        <th className="col-name">{text.player}</th>
        <th className="num">{squadText.columns.age}</th>
        <th className="num">{squadText.columns.currentAbility}</th>
        <th className="num">{squadText.columns.potentialAbility}</th>
        <th>{text.now}</th>
      </tr>
    </thead>
  );
}

function PicksTable({
  title,
  picks,
  average: mean,
  playsFor,
}: {
  title: string;
  picks: readonly Pick[];
  average: number | null;
  playsFor: ReadonlyMap<number, string>;
}) {
  return (
    <section className="lineup-section">
      <h3>
        {title} <span className="muted">· {text.average(average(mean))}</span>
      </h3>
      <div className="squad-table-wrap">
        <table className="grid squad-grid" aria-label={title}>
          <Header withPlace />
          <tbody>
            {picks.map((pick) => (
              <tr key={pick.slot.id}>
                <td>
                  {positionLabel(pick.slot.position)}
                  {pick.fit !== "main" && pick.player && (
                    <span className={`tag ${pick.fit === "out" ? "injured" : ""}`}> {text.fit[pick.fit]}</span>
                  )}
                </td>
                {pick.player ? (
                  <PlayerCells player={pick.player} playsFor={playsFor} />
                ) : (
                  <td colSpan={5} className="muted">
                    {text.noPlayer}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlacementTable({
  title,
  placements,
  playsFor,
}: {
  title: string;
  placements: readonly Placement[];
  playsFor: ReadonlyMap<number, string>;
}) {
  return (
    <section className="lineup-section">
      <h3>
        {title} <span className="muted">({placements.length})</span>
      </h3>
      <div className="squad-table-wrap">
        <table className="grid squad-grid" aria-label={title}>
          <thead>
            <tr>
              <th className="col-name">{text.player}</th>
              <th>{text.place}</th>
              <th className="num">{squadText.columns.age}</th>
              <th className="num">{squadText.columns.currentAbility}</th>
              <th className="num">{squadText.columns.potentialAbility}</th>
              <th>{text.now}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {placements.map(({ player, reason }) => (
              <tr key={player.uid}>
                <td className="col-name">{player.name}</td>
                <td>{player.positions[0] ? positionLabel(player.positions[0]) : profileText.none}</td>
                <td className="num">{player.age ?? profileText.none}</td>
                <td className="num">
                  <Ability value={player.currentAbility} />
                </td>
                <td className="num">
                  <Ability value={player.potentialAbility} />
                </td>
                <td>{playsFor.get(player.uid) ?? profileText.none}</td>
                <td className="muted">{text.reasons[reason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
