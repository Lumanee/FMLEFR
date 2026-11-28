// The reserve and youth teams' managers of a club, in the Staff tab: for each team but the first, who manages it, with
// a coach of the club to name and a button to take the manager out again. What it writes is logged like any change and
// undone from the Changes view, or at once from the line it shows.

import { useEffect, useState } from "react";
import { call } from "./api";
import { undoChange } from "./editing";
import { describeError } from "./format";
import { jobLabel, teamLabel } from "./labels";
import { teamManagersText as text } from "./teamManagersText";
import type { ClubStaffRow, LoggedChange } from "./types";

/** A team of the club other than the first, and who manages it (`club_team_managers`). */
interface Slot {
  team: number;
  kind: number;
  ageLimit: number | null;
  manager: number | null;
}

/** The jobs that may run a team: the coaches (see `TEAM_COACH_JOBS` in the core). */
const COACH_JOBS: readonly number[] = [2, 20, 22, 26, 34, 64];

interface Props {
  club: number;
  version: number;
  staff: readonly ClubStaffRow[];
  editable: boolean;
  readOnlyNote: string;
  onEdited: () => void;
}

export function TeamManagers({ club, version, staff, editable, readOnlyNote, onEdited }: Props) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ message: string; change: LoggedChange } | null>(null);

  useEffect(() => {
    let alive = true;
    call<Slot[]>("club_team_managers", { club }).then(
      (found) => alive && (setSlots(found), setError(null)),
      (e) => alive && setError(describeError(e)),
    );
    return () => {
      alive = false;
    };
  }, [club, version]);

  if (slots === null && error === null) {
    return null;
  }
  if (slots !== null && slots.length === 0) {
    return null;
  }

  const managing = new Set((slots ?? []).flatMap((slot) => (slot.manager === null ? [] : [slot.manager])));
  const candidates = staff.filter((row) => !row.isHuman && row.job !== null && COACH_JOBS.includes(row.job) && !managing.has(row.uid));
  const nameOf = (uid: number) => staff.find((row) => row.uid === uid)?.name ?? `#${uid}`;

  const write = async (task: () => Promise<LoggedChange>, message: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const change = await task();
      setDone(message === "" ? null : { message, change });
      setError(null);
      onEdited();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="profile-group team-managers" aria-label={text.title}>
      <h3>{text.title}</h3>
      <p className="note">{text.intro}</p>
      {error !== null && (
        <p className="note invalid" role="alert">
          {error}
        </p>
      )}
      <ul className="team-managers-list">
        {(slots ?? []).map((slot) => {
          const label = teamLabel({ index: slot.team, kind: slot.kind, ageLimit: slot.ageLimit });
          return (
            <li key={slot.team}>
              <b>{label}</b>
              {slot.manager !== null ? (
                <>
                  <span>{nameOf(slot.manager)}</span>
                  <button
                    type="button"
                    disabled={!editable || busy}
                    title={editable ? undefined : readOnlyNote}
                    onClick={() =>
                      void write(() => call<LoggedChange>("clear_team_manager", { club, team: slot.team }), text.removed(label))
                    }
                  >
                    {text.remove}
                  </button>
                </>
              ) : (
                <>
                  <span className="muted">{text.noManager}</span>
                  <select
                    aria-label={`${label}: ${text.choose}`}
                    value={picked[slot.team] ?? ""}
                    disabled={!editable || busy || candidates.length === 0}
                    onChange={(event) => setPicked({ ...picked, [slot.team]: Number(event.target.value) })}
                  >
                    <option value="">{candidates.length === 0 ? text.noCoach : text.choose}</option>
                    {candidates.map((row) => (
                      <option key={row.uid} value={row.uid}>
                        {row.name} · {row.job === null ? "" : jobLabel(row.job)} · {row.currentAbility}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="primary"
                    disabled={!editable || busy || !picked[slot.team]}
                    title={editable ? undefined : readOnlyNote}
                    onClick={() => {
                      const uid = picked[slot.team];
                      void write(
                        () => call<LoggedChange>("set_team_manager", { club, team: slot.team, uid }),
                        text.appointed(nameOf(uid), label),
                      );
                      setPicked({ ...picked, [slot.team]: 0 });
                    }}
                  >
                    {text.appoint}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {done !== null && (
        <p className="note" role="status">
          {done.message}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void write(() => undoChange(done.change.id), "");
            }}
          >
            {text.undo}
          </button>
        </p>
      )}
    </section>
  );
}
