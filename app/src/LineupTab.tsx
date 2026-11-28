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
  type Fit,
  type FormationName,
  type Pick,
} from "./lineup";
import { lineupText as text } from "./lineupText";
import { positionLabel, profileText, squadText, teamLabel } from "./labels";
import type { PanelIds } from "./ProfileParts";
import { useBestRoles } from "./useBestRoles";
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
const shortName = (name: string) => name.split(" ").slice(-1)[0] ?? name;

/** The "level for the tactic" as stars: how well he knows the tactic (0–100) over five stars, in halves. */
function Stars({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="muted">–</span>;
  }
  const halves = Math.round(Math.min(100, Math.max(0, value)) / 10);
  return (
    <span className="lineup-stars" style={{ "--fill": `${halves * 10}%` } as CSSProperties} title={`${Math.round(value)} / 100`}>
      ★★★★★
    </span>
  );
}

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
              {pick.player ? <Stars value={pick.player.tactics} /> : null}
              {pick.fit !== "main" && pick.player ? " *" : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** What the game says about his availability, as the Status column of the game's squad screen. */
function status(player: SquadPlayer): { label: string; className: string } {
  if (player.loan === "out") {
    return { label: text.status.loan, className: "loan" };
  }
  if (player.injuries > 0) {
    return { label: text.status.injured, className: "injured" };
  }
  if (player.bans > 0) {
    return { label: text.status.banned, className: "banned" };
  }
  return { label: text.status.fit, className: "fit" };
}

/** A bar for energy, 0–10000 as stored. */
function Bar({ value }: { value: number }) {
  const percent = Math.min(100, Math.max(0, value / 100));
  return (
    <span className="lineup-bar" title={`${Math.round(percent)} %`}>
      <span style={{ width: `${percent}%` }} />
    </span>
  );
}

interface Row {
  key: string;
  /** The first cell: the place of a starter, "R1" of a substitute, or where one who is left out goes. */
  sel: string;
  kind: "start" | "bench" | "rest";
  player: SquadPlayer | null;
  fit?: Fit;
  seat?: number;
  manual?: boolean;
  note?: string;
}

export function LineupTab({ clubUid, version, panel }: LineupTabProps) {
  const loaded = useSquads(clubUid, version);
  const [choice, setChoice] = useState<FormationName | "auto">(readChoice);
  const [includeUnavailable, setIncludeUnavailable] = useState(false);
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
      // The choice is only a convenience.
    }
  };
  const { roles: bestRoles, done: rolesDone } = useBestRoles(
    useMemo(() => players.map((player) => player.uid), [players]),
    version,
  );
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

  // Whoever starts is not offered for the bench; the others are grouped by the team they play for now.
  const groups = useMemo(() => {
    const started = new Set(lineup.starters.flatMap((p) => (p.player ? [p.player.uid] : [])));
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
  }, [players, playsFor, lineup.starters]);

  // The one table: starters, the bench seats, then everyone else with where he goes.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = lineup.starters.map((p) => ({
      key: p.slot.id,
      sel: positionLabel(p.slot.position),
      kind: "start",
      player: p.player,
      fit: p.fit,
    }));
    lineup.bench.forEach((seat, index) =>
      out.push({
        key: `r${index}`,
        sel: `R${index + 1}`,
        kind: "bench",
        player: seat.player,
        seat: index,
        manual: seat.manual,
        note: seat.covers ? text.covers(positionLabel(seat.covers)) : undefined,
      }),
    );
    const benched = new Set(lineup.bench.flatMap((seat) => (seat.player ? [seat.player.uid] : [])));
    for (const p of lineup.offBench) {
      if (p.player && !benched.has(p.player.uid)) {
        out.push({ key: `o${p.player.uid}`, sel: text.mainLeft, kind: "rest", player: p.player });
      }
    }
    for (const { player, destination, reason } of lineup.placements) {
      out.push({
        key: `p${player.uid}`,
        sel: text.groupShort[destination],
        kind: "rest",
        player,
        note: text.reasons[reason],
      });
    }
    for (const { player, reason } of lineup.unavailable) {
      out.push({ key: `u${player.uid}`, sel: text.unavailable, kind: "rest", player, note: text.unavailableReasons[reason] });
    }
    return out;
  }, [lineup]);

  const taken = new Set(lineup.bench.flatMap((seat) => (seat.player ? [seat.player.uid] : [])));

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
            <div className="lineup-left">
              <Pitch title={text.starters} picks={lineup.starters} average={lineup.startersAverage} />
              <section className="lineup-subs">
                <h3>
                  {text.subsTitle} <span className="muted">{lineup.bench.filter((s) => s.player).length} / {lineup.bench.length}</span>
                </h3>
                <ol>
                  {lineup.bench.map((seat, index) => (
                    <li key={index} className={seat.manual ? "manual" : ""}>
                      <b>R{index + 1}</b>
                      <span className="lineup-subs-name">{seat.player ? seat.player.name : "—"}</span>
                      <span className="muted">
                        {seat.player?.positions[0] ? positionLabel(seat.player.positions[0]) : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <div className="squad-table-wrap lineup-table-wrap">
              <table className="grid squad-grid lineup-table" aria-label={text.tableTitle}>
                <thead>
                  <tr>
                    <th>{text.sel}</th>
                    <th className="col-name">{text.player}</th>
                    <th title={text.tacticTitle}>{text.tactic}</th>
                    <th title={text.rolesTitle}>{text.roles}</th>
                    <th>{text.statusHead}</th>
                    <th title={text.conditionTitle}>{text.condition}</th>
                    <th>{text.morale}</th>
                    <th className="num" title={text.cohesionTitle}>{text.cohesion}</th>
                    <th className="num">{squadText.columns.age}</th>
                    <th className="num">{squadText.columns.currentAbility}</th>
                    <th className="num">{squadText.columns.potentialAbility}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const player = row.player;
                    const state = player ? status(player) : null;
                    return (
                      <tr key={row.key} className={`lineup-row ${row.kind}${state && state.className !== "fit" ? ` ${state.className}` : ""}`}>
                        <td className="lineup-sel">
                          <span className="lineup-sel-box">{row.sel}</span>
                        </td>
                        <td className="col-name" title={player?.fullName ?? player?.name}>
                          {row.kind === "bench" ? (
                            <select
                              aria-label={text.seat((row.seat ?? 0) + 1)}
                              value={row.manual && player ? String(player.uid) : ""}
                              onChange={(event) =>
                                chooseSeat(row.seat ?? 0, event.target.value === "" ? null : Number(event.target.value))
                              }
                            >
                              <option value="">
                                {player && !row.manual ? `${text.auto} · ${player.name}` : text.autoSeat}
                              </option>
                              {groups.map(([team, list]) => (
                                <optgroup key={team} label={team}>
                                  {list.map((candidate) => (
                                    <option
                                      key={candidate.uid}
                                      value={candidate.uid}
                                      disabled={taken.has(candidate.uid) && candidate.uid !== player?.uid}
                                    >
                                      {candidate.name} · {candidate.positions[0] ? positionLabel(candidate.positions[0]) : "–"} · {candidate.currentAbility}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          ) : player ? (
                            <>
                              {player.name}
                              {row.fit && row.fit !== "main" && (
                                <span className={`tag ${row.fit === "out" ? "injured" : ""}`}>{text.fit[row.fit]}</span>
                              )}
                            </>
                          ) : (
                            <span className="muted">{text.noPlayer}</span>
                          )}
                          {row.note && <div className="muted lineup-note">{row.note}</div>}
                        </td>
                        {player && state ? (
                          <>
                            <td>
                              <Stars value={player.tactics} />
                            </td>
                            <td className="lineup-roles">
                              <div className="lineup-roles-list">
                              {(bestRoles.get(player.uid) ?? []).map((entry) => (
                                <span key={entry.position} className="lineup-role" title={`${positionLabel(entry.position)} ${entry.rating}/20`}>
                                  <b>{positionLabel(entry.position)}</b> {entry.role} <i>{entry.fit.toFixed(1)}</i>
                                </span>
                              ))}
                              {!rolesDone && !bestRoles.has(player.uid) && <span className="muted">{text.rolesReading}</span>}
                              {rolesDone && (bestRoles.get(player.uid) ?? []).length === 0 && (
                                <span className="muted">{player.positions.slice(0, 3).map(positionLabel).join(", ") || profileText.none}</span>
                              )}
                            </div>
                            </td>
                            <td>
                              <span className={`lineup-status ${state.className}`}>{state.label}</span>
                            </td>
                            <td>
                              <Bar value={player.condition} />
                            </td>
                            <td>{profileText.morale(player.morale)}</td>
                            <td className="num">{player.cohesion ?? profileText.none}</td>
                            <td className="num">{player.age ?? profileText.none}</td>
                            <td className="num">
                              <Ability value={player.currentAbility} />
                            </td>
                            <td className="num">
                              <Ability value={player.potentialAbility} />
                            </td>
                          </>
                        ) : (
                          <td colSpan={9} />
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <details className="lineup-rules">
            <summary>{text.rulesTitle}</summary>
            <p className="muted">{text.intro}</p>
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
