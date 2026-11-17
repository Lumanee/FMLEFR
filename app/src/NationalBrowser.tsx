// The national teams, which the Clubs tab lists behind its switch (see `TeamsSwitch`): each nation's men's and women's
// team with the reputation of its senior team, and, beside the list, the profile of the one picked: its teams (the
// senior team and its youth teams, "Under 21" and so on), the reputation of each, which can be edited, and the squad the
// game lists for the team picked. Calling players up, the captains and the manager's contract are not here (see
// docs/recon/fm27-national-teams.md). Where this version of the game has no national teams to read, it says why instead
// of the list.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ability } from "./Ability";
import { EditableValue } from "./EditControls";
import { nationalProfile, nationalStatus } from "./editing";
import { FilterBar } from "./FilterBar";
import { describeError } from "./format";
import { nationalTeamLabel, nationalText as text, playerListText, positionLabel, profileText } from "./labels";
import { ListBrowser, type ListRequest } from "./ListBrowser";
import { NationFlag, PICTURE_SIZE, WithPicture } from "./Picture";
import { PlayerDialog } from "./PlayerProfile";
import { ProfileFrame, ReputationMeter, type Loaded } from "./ProfileParts";
import { restored, useSnapshot } from "./restore";
import type { NationalProfile, NationalSide, NationalStatus, NationalTeamSummary, SquadPlayer } from "./types";
import { useProfileEditing } from "./useProfileEditing";

/** Which teams the list shows. */
type Kind = "all" | "men" | "women";

const readKind = (value: unknown): Kind => (value === "men" || value === "women" ? value : "all");

interface NationalBrowserProps {
  /** Changes when the game data is read again, so the list and the open profile are too. */
  version: number;
  active: boolean;
  /** What the command palette asks of the list (see `ListRequest`). */
  request?: ListRequest<NationalTeamSummary> | null;
  /** Over the list, and over the note when there is none: the switch back to the clubs (see `TeamsSwitch`). */
  scope?: ReactNode;
}

/** The nations' teams with the profile of the selected one beside them; or the reason there are none to show. */
export function NationalBrowser({ version, active, request = null, scope }: NationalBrowserProps) {
  const [status, setStatus] = useState<NationalStatus | null>(null);
  const [kind, setKind] = useState<Kind>(() => restored("nationalKind", readKind));
  useSnapshot("nationalKind", () => kind);

  // Asked again whenever the game is read again: another save, or another build, may have them.
  useEffect(() => {
    let current = true;
    nationalStatus().then(
      (found) => current && setStatus(found),
      () => current && setStatus(null),
    );
    return () => {
      current = false;
    };
  }, [version]);

  if (status?.available === false) {
    return (
      <section className="national-unavailable" hidden={!active} aria-live="polite">
        {scope}
        <h2>{text.unavailableTitle}</h2>
        <p>{status.reason === "unreadable" ? text.unavailableUnreadable : text.unavailableBuild}</p>
      </section>
    );
  }

  const women = kind === "all" ? undefined : kind === "women";
  return (
    <ListBrowser<NationalTeamSummary>
      name="nationals"
      command="search_national_teams"
      requestArgs={{ women }}
      request={request}
      version={version}
      active={active}
      placeholder={text.search}
      summary={text.summary}
      empty={(query) => text.empty(query, kind !== "all")}
      scope={scope}
      filterBar={
        <FilterBar active={kind === "all" ? 0 : 1} onClear={() => setKind("all")}>
          <label className="filter-field">
            <span>{text.filters.kind}</span>
            <select value={kind} onChange={(e) => setKind(readKind(e.currentTarget.value))}>
              <option value="all">{text.filters.all}</option>
              <option value="men">{text.filters.men}</option>
              <option value="women">{text.filters.women}</option>
            </select>
          </label>
        </FilterBar>
      }
      tableClass="club-grid national-grid"
      header={
        <>
          <th className="col-name">{text.columns.name}</th>
          <th className="col-league">{text.columns.code}</th>
          <th className="num col-rep">{text.columns.reputation}</th>
          <th className="num col-founded">{text.columns.players}</th>
          <th className="num col-uid">{text.columns.uid}</th>
        </>
      }
      cells={(team) => <NationalCells team={team} />}
      profile={(team, panel) => <NationalProfileView team={team} version={panel.version} onClose={panel.onClose} />}
    />
  );
}

function NationalCells({ team }: { team: NationalTeamSummary }) {
  return (
    <>
      <td className="col-name" title={team.name}>
        <WithPicture picture={<NationFlag uid={team.nationUid} />}>
          <div className="name">
            <span className="name-text">{team.name}</span>
            {team.women && <span className="tag women">{text.women}</span>}
          </div>
        </WithPicture>
      </td>
      <td className="col-league">{team.code ?? <span className="muted">{profileText.none}</span>}</td>
      <td className="num col-rep">
        <ReputationMeter value={team.reputation} />
      </td>
      <td className="num col-founded">{team.players}</td>
      <td className="num uid col-uid">{team.uid}</td>
    </>
  );
}

interface NationalProfileViewProps {
  /** The row that was picked; its fields fill the header while the profile loads. */
  team: NationalTeamSummary;
  version: number;
  onClose: () => void;
}

/**
 * The profile of one national team: its nation and the reputation of its senior team in the header, and under it its
 * teams, the reputation of the one picked when it is not the senior team, and that team's squad.
 */
function NationalProfileView({ team, version, onClose }: NationalProfileViewProps) {
  // The kind of team picked, for this nation only: another nation opens on its senior team.
  const [picked, setPicked] = useState<{ uid: number; kind: number } | null>(null);
  const kind = picked?.uid === team.uid ? picked.kind : null;
  const loaded = useNationalProfile(team.uid, kind, version);
  const editing = useProfileEditing("nationalTeam", team.uid);
  const info = loaded?.details?.team ?? team;
  const teams = loaded?.details?.teams;
  const squad = loaded?.details?.squad;
  const shown = teams?.find((side) => side.kind === squad?.kind);

  return (
    <ProfileFrame
      picture={<NationFlag uid={info.nationUid} size={PICTURE_SIZE.clubLogo} label={info.name} />}
      name={info.name}
      fullName={null}
      badge={info.women ? <span className="tag women">{text.womensTeam}</span> : undefined}
      vitals={[info.code, `${profileText.uid} ${info.uid}`]}
      side={
        // Laid out like a club's reputation: a label and a bar with the number on it, an input while it is edited.
        <div className="profile-abilities">
          <abbr title={text.reputationTitle}>{text.reputationShort}</abbr>
          <EditableValue field="reputation">
            <ReputationMeter value={info.reputation} />
          </EditableValue>
        </div>
      }
      wide
      loaded={loaded}
      onClose={onClose}
      editing={editing}
    >
      {loaded?.details && teams && (
        <div className="squad-tab">
          {teams.length === 0 || !shown ? (
            <p className="empty">{text.noTeams}</p>
          ) : (
            <>
              <NationalTeams
                teams={teams}
                shown={shown}
                onPick={(picked) => setPicked({ uid: team.uid, kind: picked })}
              />
              <NationalSquad team={shown} players={squad?.players ?? []} version={version} />
            </>
          )}
        </div>
      )}
    </ProfileFrame>
  );
}

/** The national team `uid` as its profile shows it, with its team of kind `kind`, read again whenever `version` changes. */
function useNationalProfile(uid: number, kind: number | null, version: number): Loaded<NationalProfile> | null {
  const [loaded, setLoaded] = useState<Loaded<NationalProfile> | null>(null);
  useEffect(() => {
    let cancelled = false;
    nationalProfile(uid, kind).then(
      (details) => !cancelled && setLoaded({ details }),
      (e) => !cancelled && setLoaded({ error: describeError(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [uid, kind, version]);
  return loaded;
}

interface NationalTeamsProps {
  teams: readonly NationalSide[];
  shown: NationalSide;
  onPick: (kind: number) => void;
}

/**
 * The switch between the nation's teams, as a club's squad has it, and beside it the reputation of the team shown when
 * it is not the senior team, whose reputation the header has: an input while the profile is edited.
 */
function NationalTeams({ teams, shown, onPick }: NationalTeamsProps) {
  return (
    <div className="squad-summary national-teams">
      <div className="squad-teams" role="group" aria-label={text.teamsLabel}>
        {teams.map((side) => (
          <button key={side.kind} type="button" aria-pressed={side.kind === shown.kind} onClick={() => onPick(side.kind)}>
            {nationalTeamLabel(side.kind)}
          </button>
        ))}
      </div>
      {shown.kind !== 0 && (
        <div className="profile-abilities national-team-reputation">
          <abbr title={text.teamReputationTitle}>{text.reputationShort}</abbr>
          <EditableValue field={`team.${shown.kind}.reputation`}>
            <ReputationMeter value={shown.reputation} />
          </EditableValue>
        </div>
      )}
    </div>
  );
}

interface NationalSquadProps {
  /** The team whose players these are. */
  team: NationalSide;
  players: readonly SquadPlayer[];
  version: number;
}

/**
 * The players the game lists for one of the nation's teams, in the order it lists them. A name opens the player's
 * profile over the squad, as in a club's.
 */
function NationalSquad({ team, players, version }: NationalSquadProps) {
  const [shown, setShown] = useState<SquadPlayer | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const columns = playerListText.columns;

  // Once his profile is closed, focus goes back to the name that opened it.
  useEffect(() => {
    if (shown === null && opener.current?.isConnected) {
      opener.current.focus();
    }
  }, [shown]);

  return (
    <>
      <div className="squad-summary">
        <p className="squad-count">{text.squadHeading(nationalTeamLabel(team.kind), players.length)}</p>
        <p className="note squad-hint">{text.squadNote}</p>
      </div>
      <div className="squad-table-wrap">
        <table className="grid squad-grid" aria-label={text.squadLabel(nationalTeamLabel(team.kind))}>
          <thead>
            <tr>
              <th className="col-name">{columns.name}</th>
              <th>{columns.positions}</th>
              <th className="num">{columns.age}</th>
              <th>{columns.club}</th>
              <th className="num">{columns.currentAbility}</th>
              <th className="num">{columns.potentialAbility}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const positions = player.positions.map(positionLabel);
              return (
                <tr key={player.uid}>
                  <td className="col-name" title={player.fullName ?? player.name}>
                    <button
                      type="button"
                      className="name name-link"
                      aria-haspopup="dialog"
                      onClick={(event) => {
                        opener.current = event.currentTarget;
                        setShown(player);
                      }}
                    >
                      {player.name}
                    </button>
                  </td>
                  <td title={positions.join(" ") || undefined}>
                    {positions[0] ?? <span className="muted">{profileText.none}</span>}
                  </td>
                  <td className="num">{player.age ?? profileText.none}</td>
                  <td>{player.club ?? <span className="muted">{profileText.none}</span>}</td>
                  <td className="num">
                    <Ability value={player.currentAbility} />
                  </td>
                  <td className="num">
                    <Ability value={player.potentialAbility} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {players.length === 0 && <p className="empty">{text.noPlayers}</p>}
      </div>
      {shown && <PlayerDialog player={shown} version={version} onClose={() => setShown(null)} />}
    </>
  );
}
