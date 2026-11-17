// A club's league prize money, in its finances: what the league its first team plays in pays this season, by final
// position and per win, draw and loss, in each stage that pays something (#123); and, while the game can be written
// to, changing it. The editor finds the amounts in one pass over the game's memory, which takes a few seconds, the first
// time a club's finances show them; after that it keeps them, with its own changes. A change is the league's, for
// every club in it, and lasts the season: the game sets the next one up with its own amounts again.

import { useContext, useEffect, useId, useState, type CSSProperties } from "react";
import { call } from "./api";
import { toPounds, toShown } from "./currency";
import { describeError, formatMoney, formatNumber } from "./format";
import { InfoTip } from "./InfoTip";
import { leaguePrizesText as text } from "./labels";
import { Fact } from "./ProfileParts";
import type { CompetitionPrizes, LeaguePrizes, LeaguePrizesSet, PrizeInput, StagePrizes } from "./types";
import { EditorContext } from "./useProfileEditing";

/** The most the editor writes as one amount, in pounds (`MOST_PRIZE` in prize_money.rs). */
const MOST_PRIZE = 200_000_000;

type Read = { view: LeaguePrizes } | { error: string };

/** What the league of the club `club` pays, read when the club's finances are shown and when the data is read again. */
export function LeaguePrizesGroup({ club, version }: { club: number; version: number }) {
  const [read, setRead] = useState<Read | null>(null);
  const [reading, setReading] = useState(false);

  const readNow = (again: boolean, alive: () => boolean = () => true) => {
    setReading(true);
    call<LeaguePrizes>("league_prizes", { club, again }).then(
      (view) => alive() && (setRead({ view }), setReading(false)),
      (e) => alive() && (setRead({ error: describeError(e) }), setReading(false)),
    );
  };

  useEffect(() => {
    let alive = true;
    readNow(false, () => alive);
    return () => {
      alive = false;
    };
    // `readNow` reads `club` itself; it is asked only on these changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club, version]);

  const view = read && "view" in read ? read.view : null;
  const setLeague = (league: CompetitionPrizes | null) =>
    setRead({ view: { unavailable: null, league } });

  return (
    <section className="profile-group league-prizes" aria-busy={reading}>
      <h3>{text.title}</h3>
      {read === null || (reading && view === null) ? (
        <p className="note">{text.reading}</p>
      ) : "error" in read ? (
        <p className="note invalid" role="alert">
          {read.error}
        </p>
      ) : view?.unavailable ? (
        <p className="note">{view.unavailable === "unreadable" ? text.unavailableUnreadable : text.unavailableBuild}</p>
      ) : view?.league ? (
        <>
          <p className="note">{text.league(view.league.name)}</p>
          {view.league.stages.map((stage, index) => (
            <StageAmounts
              key={index}
              club={club}
              index={index}
              league={view.league!.name}
              stage={stage}
              several={view.league!.stages.length > 1}
              onSaved={setLeague}
            />
          ))}
          <p className="note">{text.note}</p>
        </>
      ) : (
        <p className="note">{text.paysNothing}</p>
      )}
      {view !== null && !view.unavailable && (
        <button type="button" disabled={reading} title={text.readAgainTitle} onClick={() => readNow(true)}>
          {reading ? text.reading : text.readAgain}
        </button>
      )}
    </section>
  );
}

/** The amounts of a stage by key: `win`, `draw`, `loss`, and `place.N` for a final position. */
function amountsOf(stage: StagePrizes): [string, number][] {
  return [
    ["win", stage.win],
    ["draw", stage.draw],
    ["loss", stage.loss],
    ...stage.byPosition.map((pounds, at): [string, number] => [`place.${at + 1}`, pounds]),
  ];
}

/** The amount typed, in the chosen currency, as pounds; null when it is not a whole amount the editor writes. */
function typedPounds(typed: string): number | null {
  const digits = typed.replace(/[\s.,'’_]/g, "");
  if (!/^\d+$/.test(digits)) {
    return null;
  }
  const pounds = toPounds(Number(digits));
  return pounds <= MOST_PRIZE ? pounds : null;
}

function inputOf(key: string, pounds: number): PrizeInput {
  if (key.startsWith("place.")) {
    return { kind: "place", place: Number(key.slice("place.".length)), pounds };
  }
  return { kind: key as "win" | "draw" | "loss", pounds };
}

interface StageAmountsProps {
  club: number;
  /** The stage's place in the league's list, which a change names it by. */
  index: number;
  league: string;
  stage: StagePrizes;
  /** Whether the league has other stages that pay: each is then headed by whether it has started. */
  several: boolean;
  onSaved: (league: CompetitionPrizes | null) => void;
}

/**
 * One stage of the league: per match, and by final position. With Change amounts, while the game can be written to,
 * the amounts become inputs, in the chosen currency; Save writes the ones changed, for every club in the league.
 */
function StageAmounts({ club, index, league, stage, several, onSaved }: StageAmountsProps) {
  const { editable, onEdited } = useContext(EditorContext);
  // What was typed, by the key of its amount; null while the amounts are only shown.
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();

  const amounts = amountsOf(stage);
  const was = new Map(amounts);
  const typed = (key: string) => draft?.[key];
  // The amounts the inputs hold, in pounds, by key: the game's where nothing was typed, null where what was typed is
  // not an amount.
  // What the input showed to begin with is the game's amount, whatever the currency's rounding makes of it.
  const typedAmount = (key: string, pounds: number) => {
    const given = typed(key);
    return given === undefined || given === String(toShown(pounds)) ? pounds : typedPounds(given);
  };
  const after = new Map(amounts.map(([key, pounds]) => [key, typedAmount(key, pounds)]));
  const changed = amounts.filter(([key, pounds]) => after.get(key) !== pounds);
  const invalid = [...after.values()].some((pounds) => pounds === null);
  const nothing = !invalid && [...after.values()].every((pounds) => pounds === 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const inputs = changed.map(([key]) => inputOf(key, after.get(key)!));
      const done = await call<LeaguePrizesSet>("set_league_prizes", { club, stage: index, amounts: inputs });
      setDraft(null);
      onSaved(done.league);
      onEdited();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const amount = (key: string, label: string) => {
    const pounds = was.get(key) ?? 0;
    if (draft === null) {
      return (
        <Fact key={key} label={label}>
          {formatMoney(pounds)}
        </Fact>
      );
    }
    const value = typed(key) ?? String(toShown(pounds));
    const status = after.get(key) === null ? " invalid" : after.get(key) !== pounds ? " changed" : "";
    return (
      <Fact key={key} label={label}>
        <input
          type="text"
          inputMode="numeric"
          className={`edit-input prize-input${status}`}
          style={{ "--digits": 11 } as CSSProperties}
          aria-label={label}
          aria-describedby={noteId}
          aria-invalid={status === " invalid" || undefined}
          value={value}
          disabled={saving}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setDraft((d) => ({ ...d, [key]: next }));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(null);
            }
          }}
        />
      </Fact>
    );
  };

  const paysPerMatch = stage.win > 0 || stage.draw > 0 || stage.loss > 0;
  return (
    <div className="league-stage">
      {several && <h4>{stage.future ? text.stageFuture : text.stageStarted}</h4>}
      {stage.count > 1 && <p className="note">{text.alike(stage.count)}</p>}
      <h4>{text.perMatch}</h4>
      {paysPerMatch || draft !== null ? (
        <dl className="stats">
          {amount("win", text.win)}
          {amount("draw", text.draw)}
          {amount("loss", text.loss)}
        </dl>
      ) : (
        <p className="note">{text.noPerMatch}</p>
      )}
      <h4>{text.byPosition}</h4>
      {stage.byPosition.length > 0 ? (
        <dl className="stats prize-places">
          {stage.byPosition.map((_, at) => amount(`place.${at + 1}`, text.place(at + 1)))}
        </dl>
      ) : (
        <p className="note">{text.noList}</p>
      )}
      {draft === null ? (
        <div className="prize-actions">
          <button
            type="button"
            className="heal-toggle"
            disabled={!editable}
            title={text.editTitle}
            onClick={() => {
              setError(null);
              setDraft({});
            }}
          >
            {text.edit}
          </button>
          <InfoTip label={text.infoLabel} note={text.everyClub(league)} />
        </div>
      ) : (
        <div className="prize-edit">
          <p id={noteId} className="move-note">
            {text.everyClub(league)}
          </p>
          {invalid && <p className="move-note invalid">{text.invalid(formatNumber(toShown(MOST_PRIZE)))}</p>}
          {nothing && <p className="move-note invalid">{text.allNothing}</p>}
          <div className="prize-actions">
            <button
              type="button"
              className="primary"
              disabled={saving || invalid || nothing || changed.length === 0}
              onClick={() => void save()}
            >
              {saving ? text.saving : text.save}
            </button>
            <button type="button" disabled={saving} onClick={() => setDraft(null)}>
              {text.cancel}
            </button>
          </div>
        </div>
      )}
      {error !== null && (
        <p className="move-note invalid" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
