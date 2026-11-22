// Destroy's question: the dialog the Destroy button of a squad opens. It says what Destroy does to the team before
// anything is written, and says so when the club is the user's own. Destroy runs once it is confirmed; one Undo takes
// it back, from the line under the buttons or from the Changes view, while the game has not moved on.

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { squadText as text, teamLabel } from "./labels";
import type { ClubTeam } from "./types";
import { useModal } from "./useModal";

interface DestroyDialogProps {
  /** The club's name. */
  club: string;
  /** The team Destroy would act on, as the squad shows it. */
  team: ClubTeam;
  onConfirm: () => void;
  /** Cancel, or Escape. */
  onClose: () => void;
}

export function DestroyDialog({ club, team, onConfirm, onClose }: DestroyDialogProps) {
  const base = useId();
  const id = (part: string) => `${base}-${part}`;
  const dialog = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const words = text.destroyDialog;

  useModal(dialog, true, onClose);

  // The question is asked before anything is written: focus starts on its safe answer, Cancel.
  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  return createPortal(
    // A click beside the dialog does nothing, and keeps focus where it is.
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
        }
      }}
    >
      <div
        ref={dialog}
        className="modal move-dialog destroy-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        aria-describedby={id("team")}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h2 id={id("title")}>{words.title}</h2>
          <p id={id("team")} className="move-player">
            {[club, teamLabel(team), text.players(team.players.length)].join(" · ")}
          </p>
        </header>

        <div className="modal-body">
          {team.humanClub && <p className="destroy-own">{words.ownClub}</p>}
          <section className="move-section" aria-labelledby={id("does")}>
            <h3 id={id("does")}>{words.doesHeading}</h3>
            <ul className="move-facts">
              {words.does.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <p className="note destroy-keeps">{words.keeps}</p>
        </div>

        <footer className="modal-foot">
          <span className="move-foot-note">{words.hint}</span>
          <button type="button" className="destroy" onClick={onConfirm}>
            {text.destroy}
          </button>
          <button ref={cancelButton} type="button" onClick={onClose}>
            {words.cancel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
