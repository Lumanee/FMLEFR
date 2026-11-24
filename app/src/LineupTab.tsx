// The Squad calculator tab of a club's profile, laid out like a team sheet: for a formation, the eleven starters on a
// pitch, the match-day bench (as many seats as the competition allows, each one changeable by hand to any player of the
// club), and the players to send to the reserve team or the under-19s. It only reads the squads the Squad tab reads (see
// `lineup.ts` for how it chooses) and never writes to the game.

import { useMemo, useState, type CSSProperties } from "react";
import { Ability } from "./Ability";
import { formatNumber } from "./format";
import {
  bestFormation,
  buildLineup,
  clubPlayers,
  DEFAULT_BENCH_SIZE,
  FORMATION_NAMES,
  MAX_BENCH_SIZE,
  MIN_BENCH_SIZE,
  type BenchSeat,
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

const CHOICE_KEY = "fmlibre.lineupFormation";

const BENCH_KEY = "fmlibre.lineupBenchSize";

/** The bench size chosen last time. */
function readBenchSize(): number {
  try {
    const saved = Number(localStorage.getItem(BENCH_KEY));
    return Number.isInteger(saved) && saved >= MIN_BENCH_SIZE && saved <= MAX_BENCH_SIZE ? saved : DEFAULT_BENCH_SIZE;
  } catch {
    return DEFAULT_BENCH_SIZE;
  }
}

/** The formation chosen last time, or auto. */
function readChoice(): FormationName | "auto" {
  try {
    const saved = localStorage.getItem(CHOICE_KEY);
    return FORMATION_NAMES.includes(saved as FormationName) ? (saved as FormationName) : "auto";
  } catch {
    return "auto";
  }
}

/** The line of the pitch a position is on, for the colour of its card. */
function lineOf(position: string): "gk" | "def" | "mid" | "att" {
  if (position === "gk") {
    return "gk";
  }
  if (["dl", "dc", "dr", "sw", "wbl", "wbr"].includes(position)) {
    return "def";
  }
  return ["dm", "ml", "mc", "mr"].includes(position) ? "mid" : "att";
}

/** A short form of a name for a card: the surname alone, cut at the card's width by the style. */
const shortName = (name: string) => name;

/** One eleven on an upright pitch, each player at his place of the formation, with his position, name and ability. */
function Pitch({ title, picks, average: mean }: { title: string; picks: readonly Pick[]; average: number | null }) {
  return (
    <section className="lineup-pitch-box">
      <h3>
        {title} <span className="muted">· {text.average(average(mean))}</span>
      </h3>
      <div className="lineup-pitch" role="group" aria-label={title}>
        <div className="lineup-pitch-lines" aria-hidden="true" />
        {picks.map((pick) => (
          <div
            key={pick.slot.id}
            className={`lineup-card ${lineOf(pick.slot.position)}${pick.fit === "out" ? " off" : ""}`}
            style={{ left: `${pick.slot.x}%`, top: `${pick.slot.y}%` } as CSSProperties}
            title={pick.player ? `${pick.player.name} · ${text.fitTitle(pick.fit)}` : text.noPlayer}
          >
            <span className="lineup-card-pos">{positionLabel(pick.slot.position)}</span>
            <span className="lineup-card-name">{pick.player ? shortName(pick.player.name) : "—"}</span>
            <span className="lineup-card-ca">
              {pick.player ? pick.player.currentAbility : ""}
              {pick.fit !== "main" && pick.player ? " *" : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const DESTINATIONS: readonly Destination[] = ["reserve", "u19"];

export function LineupTab({ clubUid, version, panel }: LineupTabProps) {
  const loaded = useSquads(clubUid, version);
  // The formation asked for, or "auto": the one that gives this squad the best eleven. Kept for the next club.
  const [choice, setChoice] = useState<FormationName | "auto">(readChoice);
  const [includeUnavailable, setIncludeUnavailable] = useState(false);
  // The seats of the bench: how many, and the player chosen by hand for each (null: left to the calculator).
  const [benchSize, setBenchSize] = useState(readBenchSize);
  const [benchChoices, setBenchChoices] = useState<(number | null)[]>([]);

  const teams = loaded?.details;
  const players = useMemo(() => (teams ? clubPlayers(teams) : []), [teams]);
  const formation = useMemo(
    () => (choice === "auto" ? bestFormation(players, includeUnavailable) : choice),
    [choice, players, includeUnavailable],
  );
  const lineup = useMemo(
    () => buildLineup(players, { formation, includeUnavailable, benchSize, benchChoices }),
    [players, formation, includeUnavailable, benchSize, benchChoices],
  );
  const changeBenchSize = (next: number) => {
    const size = Math.min(MAX_BENCH_SIZE, Math.max(MIN_BENCH_SIZE, next));
    setBenchSize(size);
    try {
      localStorage.setItem(BENCH_KEY, String(size));
    } catch {
      // A convenience only.
    }
  };
  const chooseSeat = (seat: number, uid: number | null) =>
    setBenchChoices((choices) => {
      const next = [...choices];
      while (next.length <= seat) {
        next.push(null);
      }
      next[seat] = uid;
      return next;
    });
  const pick = (next: FormationName | "auto") => {
    setChoice(next);
    try {
      localStorage.setItem(CHOICE_KEY, next);
    } catch {
      // The choice is only a convenience: without storage it is the next club's default again.
    }
  };
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
              <button type="button" aria-pressed={choice === "auto"} title={text.autoTitle} onClick={() => pick("auto")}>
                {choice === "auto" ? text.autoChosen(formation) : text.auto}
              </button>
              {FORMATION_NAMES.map((name) => (
                <button key={name} type="button" aria-pressed={name === choice} onClick={() => pick(name)}>
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
            <label className="lineup-check" title={text.benchSizeTitle}>
              {text.benchSize}
              <input
                type="number"
                className="lineup-bench-size"
                min={MIN_BENCH_SIZE}
                max={MAX_BENCH_SIZE}
                value={benchSize}
                onChange={(event) => {
                  const value = Math.floor(Number(event.target.value));
                  if (Number.isFinite(value)) {
                    changeBenchSize(value);
                  }
                }}
              />
            </label>
          </div>

          <section className="lineup-sheet" aria-label={text.sheetTitle}>
            <Pitch title={text.starters} picks={lineup.starters} average={lineup.startersAverage} />
            <BenchPanel
              seats={lineup.bench}
              onChoose={chooseSeat}
              players={players}
              starters={lineup.starters}
              playsFor={playsFor}
            />
          </section>
          {lineup.offBench.length > 0 && (
            <PicksTable
              title={`${text.offBench} · ${text.average(average(lineup.replacementsAverage))}`}
              picks={lineup.offBench}
              average={null}
              playsFor={playsFor}
              hideAverage
            />
          )}
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

/** The bench of the team sheet: a seat per substitute, each a list of the whole club to pick from. */
function BenchPanel({
  seats,
  onChoose,
  players,
  starters,
  playsFor,
}: {
  seats: readonly BenchSeat[];
  onChoose: (seat: number, uid: number | null) => void;
  players: readonly SquadPlayer[];
  starters: readonly Pick[];
  playsFor: ReadonlyMap<number, string>;
}) {
  // Whoever starts is not offered; the others are grouped by the team they play for now.
  const groups = useMemo(() => {
    const started = new Set(starters.flatMap((pick) => (pick.player ? [pick.player.uid] : [])));
    const byTeam = new Map<string, SquadPlayer[]>();
    for (const player of players) {
      if (!started.has(player.uid)) {
        const team = playsFor.get(player.uid) ?? profileText.none;
        byTeam.set(team, [...(byTeam.get(team) ?? []), player]);
      }
    }
    return [...byTeam.entries()].map(
      ([team, list]) => [team, [...list].sort((a, b) => b.currentAbility - a.currentAbility)] as const,
    );
  }, [players, playsFor, starters]);
  const taken = new Set(seats.flatMap((seat) => (seat.player ? [seat.player.uid] : [])));
  return (
    <section className="lineup-bench-box">
      <h3>{text.benchTitle(seats.length)}</h3>
      <ol className="lineup-bench">
        {seats.map((seat, index) => (
          <li key={index} className={`lineup-seat${seat.manual ? " manual" : ""}`}>
            <span className="lineup-seat-n">{text.seat(index + 1)}</span>
            <select
              aria-label={text.seat(index + 1)}
              value={seat.manual && seat.player ? String(seat.player.uid) : ""}
              onChange={(event) => onChoose(index, event.target.value === "" ? null : Number(event.target.value))}
            >
              <option value="">
                {seat.player && !seat.manual
                  ? `${text.auto} · ${seat.player.name}`
                  : text.autoSeat}
              </option>
              {groups.map(([team, list]) => (
                <optgroup key={team} label={team}>
                  {list.map((player) => (
                    <option
                      key={player.uid}
                      value={player.uid}
                      disabled={taken.has(player.uid) && player.uid !== seat.player?.uid}
                    >
                      {player.name} · {player.positions[0] ? positionLabel(player.positions[0]) : "–"} · {player.currentAbility}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="lineup-seat-info muted">
              {seat.player ? (
                <>
                  {seat.player.positions[0] ? positionLabel(seat.player.positions[0]) : ""} · {seat.player.currentAbility}
                  {seat.covers ? ` · ${text.covers(positionLabel(seat.covers))}` : ""}
                  {seat.manual ? ` · ${text.manual}` : ""}
                </>
              ) : (
                text.noPlayer
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
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
  hideAverage = false,
}: {
  title: string;
  picks: readonly Pick[];
  average: number | null;
  playsFor: ReadonlyMap<number, string>;
  hideAverage?: boolean;
}) {
  return (
    <section className="lineup-section">
      <h3>
        {title}
        {!hideAverage && <span className="muted"> · {text.average(average(mean))}</span>}
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
