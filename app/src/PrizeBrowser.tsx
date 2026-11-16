// The Prize money tab: the competitions whose stages pay prize money, with what the first stage of each pays by final
// position and per match, and, beside the list, every stage of the one picked. It only reads (#123). The editor finds
// the amounts in one pass over the game's memory, which takes a few seconds, so the tab reads them the first time it is
// shown after the game data was read, and again on Read again; where this version of the game has none to show, it
// says why instead of the list.

import { useEffect, useMemo, useRef, useState } from "react";
import { call } from "./api";
import { describeError, fold, formatMoney } from "./format";
import { prizeText as text, profileText } from "./labels";
import { NationFlag, Picture, PICTURE_SIZE, WithPicture } from "./Picture";
import { Fact, ProfileFrame } from "./ProfileParts";
import { isRecord, restored, useSnapshot } from "./restore";
import type { CompetitionPrizes, PrizeMoneyView, StagePrizes } from "./types";

/** The search text and the UID of the selected competition that the tab saved. */
function readStart(value: unknown): { query: string; selected: number | null } {
  const given = isRecord(value) ? value : {};
  return {
    query: typeof given.query === "string" ? given.query : "",
    selected: typeof given.selected === "number" && Number.isInteger(given.selected) ? given.selected : null,
  };
}

type Read = { view: PrizeMoneyView } | { error: string };

interface PrizeBrowserProps {
  /** Changes when the game data is read again: the amounts are read again the next time the tab is shown. */
  version: number;
  active: boolean;
}

/** The competitions that pay prize money, with the stages of the selected one beside them; or why there are none. */
export function PrizeBrowser({ version, active }: PrizeBrowserProps) {
  const [start] = useState(() => restored("prizes", readStart));
  const [query, setQuery] = useState(start.query);
  const [selected, setSelected] = useState<number | null>(start.selected);
  useSnapshot("prizes", () => ({ query, selected }));
  // What was read, and for which version of the game data; null while it is being read.
  const [read, setRead] = useState<{ version: number; result: Read } | null>(null);
  const [reading, setReading] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const readNow = () => {
    setReading(true);
    call<PrizeMoneyView>("prize_money").then(
      (view) => {
        setRead({ version, result: { view } });
        setReading(false);
      },
      (e) => {
        setRead({ version, result: { error: describeError(e) } });
        setReading(false);
      },
    );
  };

  // Read once the tab is shown, and again when it is shown after the game data was read again, also when that happened
  // while the amounts were being read.
  useEffect(() => {
    if (active && !reading && read?.version !== version) {
      readNow();
    }
    // `readNow` reads `version` itself; it is asked only on these changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, version, reading]);

  useEffect(() => {
    if (active) {
      searchInput.current?.focus();
    }
  }, [active]);

  const result = read?.result;
  const view = result && "view" in result ? result.view : null;
  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return (view?.competitions ?? []).filter((c) => {
      const text = fold(`${c.name} ${c.shortName ?? ""} ${c.nation ?? ""}`);
      return String(c.uid) === query.trim() || words.every((word) => text.includes(word));
    });
  }, [view, query]);

  if (view?.unavailable) {
    return (
      <section className="prize-unavailable" hidden={!active} aria-live="polite">
        <h2>{text.unavailableTitle}</h2>
        <p>{view.unavailable === "unreadable" ? text.unavailableUnreadable : text.unavailableBuild}</p>
      </section>
    );
  }

  const picked = view?.competitions.find((c) => c.uid === selected) ?? null;
  const showProfile = active && picked !== null;
  const className = ["workspace", showProfile && "with-profile", !active && "inactive"].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <section className="players">
        <div className="toolbar">
          <label className="search">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
            <input
              ref={searchInput}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder={text.search}
              spellCheck={false}
            />
          </label>
          <span className="count">{view ? text.summary(view.competitions.length, shown.length) : ""}</span>
          <button type="button" onClick={readNow} disabled={reading} title={text.readAgainTitle}>
            {text.readAgain}
          </button>
        </div>
        {result && "error" in result && <div className="banner">{result.error}</div>}

        <div className="table-wrap" aria-busy={reading}>
          {reading && !view ? (
            <p className="empty">{text.reading}</p>
          ) : (
            <table className="grid prize-grid">
              <thead>
                <tr>
                  <th className="col-name">{text.columns.competition}</th>
                  <th className="col-nation">{text.columns.nation}</th>
                  <th className="num">{text.columns.places}</th>
                  <th className="num">{text.columns.first}</th>
                  <th className="num">{text.columns.last}</th>
                  <th className="num">{text.columns.win}</th>
                  <th className="num">{text.columns.draw}</th>
                  <th className="num">{text.columns.loss}</th>
                  <th className="num col-uid">{text.columns.uid}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((competition) => (
                  <CompetitionRow
                    key={competition.uid}
                    competition={competition}
                    selected={competition.uid === selected}
                    onPick={() => setSelected(competition.uid)}
                  />
                ))}
              </tbody>
            </table>
          )}
          {view && shown.length === 0 && <p className="empty">{text.empty(query)}</p>}
          {view && shown.length > 0 && <p className="note prize-note">{text.note}</p>}
        </div>
      </section>

      {showProfile && (
        <CompetitionProfile key={picked.uid} competition={picked} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** A competition's logo from the graphics packs, an empty frame where none has it. */
function CompetitionLogo({ uid, size, label = "" }: { uid: number; size: number; label?: string }) {
  return <Picture kind="competition" id={uid} size={size} label={label} fallback={<span className="picture-frame" />} />;
}

interface CompetitionRowProps {
  competition: CompetitionPrizes;
  selected: boolean;
  onPick: () => void;
}

/** One competition, with what its first stage pays. */
function CompetitionRow({ competition, selected, onPick }: CompetitionRowProps) {
  const stage = competition.stages[0];
  const list = stage?.byPosition ?? [];
  const amount = (pounds: number | undefined) =>
    pounds === undefined ? <span className="muted">{profileText.none}</span> : formatMoney(pounds);
  return (
    <tr
      className={selected ? "selected" : undefined}
      aria-current={selected ? "true" : undefined}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onPick();
        }
      }}
    >
      <td className="col-name" title={competition.name}>
        <WithPicture picture={<CompetitionLogo uid={competition.uid} size={PICTURE_SIZE.rowLogo} />}>
          <div className="name">
            <span className="name-text">{competition.name}</span>
            {competition.stages.length > 1 && <span className="tag">{text.stages(competition.stages.length)}</span>}
          </div>
        </WithPicture>
      </td>
      <td className="col-nation">
        <NationCell competition={competition} />
      </td>
      <td className="num">{list.length > 0 ? list.length : <span className="muted">{profileText.none}</span>}</td>
      <td className="num" title={text.firstStageTitle}>
        {amount(list[0])}
      </td>
      <td className="num" title={text.firstStageTitle}>
        {amount(list.length > 1 ? list[list.length - 1] : undefined)}
      </td>
      <td className="num" title={text.firstStageTitle}>
        {amount(stage?.win)}
      </td>
      <td className="num" title={text.firstStageTitle}>
        {amount(stage?.draw)}
      </td>
      <td className="num" title={text.firstStageTitle}>
        {amount(stage?.loss)}
      </td>
      <td className="num uid col-uid">{competition.uid}</td>
    </tr>
  );
}

function NationCell({ competition }: { competition: CompetitionPrizes }) {
  if (competition.nation === null) {
    return <span className="muted">{text.noNation}</span>;
  }
  return (
    <WithPicture picture={<NationFlag uid={competition.nationUid} />}>
      <span>{competition.nation}</span>
    </WithPicture>
  );
}

/** Every stage of a competition that pays: per match, and by final position. */
function CompetitionProfile({ competition, onClose }: { competition: CompetitionPrizes; onClose: () => void }) {
  return (
    <ProfileFrame
      picture={<CompetitionLogo uid={competition.uid} size={PICTURE_SIZE.clubLogo} label={competition.name} />}
      name={competition.name}
      fullName={competition.shortName}
      vitals={[competition.nation ?? text.noNation, `${profileText.uid} ${competition.uid}`]}
      loaded={{ details: competition }}
      onClose={onClose}
    >
      <div className="profile-stack">
        {competition.stages.map((stage, index) => (
          <StageGroup key={index} stage={stage} />
        ))}
      </div>
    </ProfileFrame>
  );
}

function StageGroup({ stage }: { stage: StagePrizes }) {
  const paysPerMatch = stage.win > 0 || stage.draw > 0 || stage.loss > 0;
  return (
    <section className="profile-group">
      <h3>{stage.future ? text.stageFuture : text.stageStarted}</h3>
      {stage.count > 1 && <p className="note">{text.alike(stage.count)}</p>}
      <h4>{text.perMatch}</h4>
      {paysPerMatch ? (
        <dl className="stats">
          <Fact label={text.win}>{formatMoney(stage.win)}</Fact>
          <Fact label={text.draw}>{formatMoney(stage.draw)}</Fact>
          <Fact label={text.loss}>{formatMoney(stage.loss)}</Fact>
        </dl>
      ) : (
        <p className="note">{text.noPerMatch}</p>
      )}
      <h4>{text.byPosition}</h4>
      {stage.byPosition.length > 0 ? (
        <dl className="stats prize-places">
          {stage.byPosition.map((pounds, index) => (
            <Fact key={index} label={text.place(index + 1)}>
              {formatMoney(pounds)}
            </Fact>
          ))}
        </dl>
      ) : (
        <p className="note">{text.noList}</p>
      )}
    </section>
  );
}
