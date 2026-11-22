// Batch characteristics dialog: allows adding or removing preferred traits/moves (PPMs) across a squad/team.
// If adding: sets selected traits for players missing them (existing traits are kept).
// If removing: clears selected traits for players having them (other traits are kept).

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { batchTraitsText as text, profileText, teamLabel } from "./labels";
import type { ClubTeam } from "./types";
import { useModal } from "./useModal";

/** The 64 trait bits mapped in FM. */
const TRAIT_BITS = Array.from({ length: 64 }, (_, bit) => bit);

interface BatchTraitsDialogProps {
  team: ClubTeam;
  busy: boolean;
  onApply: (addTraits: number[], removeTraits: number[]) => Promise<void>;
  onClose: () => void;
}

export function BatchTraitsDialog({ team, busy, onApply, onClose }: BatchTraitsDialogProps) {
  const base = useId();
  const id = (part: string) => `${base}-${part}`;
  const dialog = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  const [mode, setMode] = useState<"add" | "remove">("add");
  const [selectedAdd, setSelectedAdd] = useState<Set<number>>(new Set());
  const [selectedRemove, setSelectedRemove] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useModal(dialog, !busy && !applying, onClose);

  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  const currentSet = mode === "add" ? selectedAdd : selectedRemove;
  const setCurrentSet = mode === "add" ? setSelectedAdd : setSelectedRemove;

  const toggleTrait = (bit: number, checked: boolean) => {
    setCurrentSet((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(bit);
        // Automatically remove from the opposite set to avoid collision
        if (mode === "add") {
          setSelectedRemove((r) => {
            if (!r.has(bit)) return r;
            const nr = new Set(r);
            nr.delete(bit);
            return nr;
          });
        } else {
          setSelectedAdd((a) => {
            if (!a.has(bit)) return a;
            const na = new Set(a);
            na.delete(bit);
            return na;
          });
        }
      } else {
        next.delete(bit);
      }
      return next;
    });
  };

  const clearCurrent = () => {
    setCurrentSet(new Set());
  };

  const handleApply = async () => {
    if (selectedAdd.size === 0 && selectedRemove.size === 0) return;
    setApplying(true);
    try {
      await onApply(Array.from(selectedAdd), Array.from(selectedRemove));
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const totalSelected = selectedAdd.size + selectedRemove.size;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        ref={dialog}
        className="modal batch-traits-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id("title")}
        style={{ width: "min(880px, 96vw)", maxHeight: "90vh" }}
      >
        <header className="modal-head">
          <h2 id={id("title")}>{text.title}</h2>
          <p className="note" style={{ margin: "2px 0 0" }}>
            {teamLabel(team)} · {team.players.length}
          </p>
        </header>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px 20px" }}>
          {/* Mode Switcher */}
          <div
            role="tablist"
            style={{
              display: "flex",
              gap: "8px",
              paddingBottom: "4px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "add"}
              className="squad-action"
              style={{
                padding: "6px 14px",
                fontWeight: mode === "add" ? 700 : 500,
                background: mode === "add" ? "var(--accent)" : "var(--field)",
                color: mode === "add" ? "var(--on-accent)" : "var(--text)",
                borderColor: mode === "add" ? "var(--accent)" : "var(--border-strong)",
                cursor: "pointer",
              }}
              onClick={() => setMode("add")}
            >
              {text.addMode}
              {selectedAdd.size > 0 && ` (${selectedAdd.size})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "remove"}
              className="squad-action"
              style={{
                padding: "6px 14px",
                fontWeight: mode === "remove" ? 700 : 500,
                background: mode === "remove" ? "var(--danger)" : "var(--field)",
                color: mode === "remove" ? "#fff" : "var(--text)",
                borderColor: mode === "remove" ? "var(--danger)" : "var(--border-strong)",
                cursor: "pointer",
              }}
              onClick={() => setMode("remove")}
            >
              {text.removeMode}
              {selectedRemove.size > 0 && ` (${selectedRemove.size})`}
            </button>
          </div>

          {/* Mode Explanation */}
          <p className="note" style={{ margin: "2px 0 6px", fontSize: "13px" }}>
            {mode === "add" ? text.addHint : text.removeHint}
          </p>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 0" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
              {currentSet.size === 0 ? text.noneSelected : text.selectedCount(currentSet.size)}
            </span>
            {currentSet.size > 0 && (
              <button
                type="button"
                className="squad-action"
                style={{ fontSize: "12px", padding: "2px 10px" }}
                onClick={clearCurrent}
              >
                {text.deselectAll}
              </button>
            )}
          </div>

          {/* Traits Tag Pills */}
          <div
            className="tags traits-edit"
            style={{
              maxHeight: "48vh",
              overflowY: "auto",
              padding: "8px 4px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--panel)",
            }}
          >
            {TRAIT_BITS.map((bit) => {
              const checked = currentSet.has(bit);
              const oppositeChecked = mode === "add" ? selectedRemove.has(bit) : selectedAdd.has(bit);
              return (
                <label
                  key={bit}
                  className={`edit-flag${checked ? " changed" : ""}`}
                  style={
                    checked
                      ? {
                          borderColor: mode === "add" ? "var(--accent)" : "var(--danger)",
                          boxShadow: mode === "add" ? "0 0 0 1px var(--accent)" : "0 0 0 1px var(--danger)",
                        }
                      : oppositeChecked
                        ? { opacity: 0.5 }
                        : undefined
                  }
                  title={oppositeChecked ? text.oppositeModeNote : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy || applying}
                    onChange={(e) => toggleTrait(bit, e.currentTarget.checked)}
                  />
                  <span>{profileText.traitName(bit)}</span>
                </label>
              );
            })}
          </div>
        </div>

        <footer className="modal-foot">
          <span className="move-foot-note" style={{ flex: 1, fontSize: "12px" }}>
            {totalSelected === 0 ? text.emptySquad(team.players.length) : text.applyNote(team.players.length)}
          </span>
          <button
            ref={cancelButton}
            type="button"
            disabled={busy || applying}
            onClick={onClose}
          >
            {text.cancel}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || applying || totalSelected === 0}
            onClick={() => void handleApply()}
          >
            {applying || busy ? text.applying : text.apply}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
