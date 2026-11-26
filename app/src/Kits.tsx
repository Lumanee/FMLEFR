// A club's kits (docs/recon/fm27-kits.md): each item the game keeps, with its five colours and its style. While the game
// can be written to, the colours and the style can be changed; the change is written at once, logged and undone like
// any other. The game redraws kits only when a day passes, which the note under the kits says.

import { useContext, useEffect, useState } from "react";
import { call } from "./api";
import { describeError } from "./format";
import { kitsText as text } from "./labels";
import { EditorContext } from "./useProfileEditing";
import type { ClubKits, KitItem } from "./types";

type Read = { view: ClubKits } | { error: string };

const COLOUR_LABELS = [text.foreground, text.background, text.outline, text.number, text.numberOutline] as const;

/** `#rrggbb` for a colour of red, green and blue. */
const hex = (colour: readonly number[]) => `#${colour.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

/** The club `club`'s kits, read when the profile shows and when the data is read again. */
export function KitsGroup({ club, version }: { club: number; version: number }) {
  const { editable, onEdited } = useContext(EditorContext);
  const [read, setRead] = useState<Read | null>(null);

  useEffect(() => {
    let alive = true;
    call<ClubKits>("club_kits", { club }).then(
      (view) => alive && setRead({ view }),
      (e) => alive && setRead({ error: describeError(e) }),
    );
    return () => {
      alive = false;
    };
  }, [club, version]);

  const view = read && "view" in read ? read.view : null;
  return (
    <section className="profile-group kits" aria-busy={read === null}>
      <h3>{text.title}</h3>
      {read === null ? (
        <p className="note">{text.reading}</p>
      ) : "error" in read ? (
        <p className="note invalid" role="alert">
          {read.error}
        </p>
      ) : view?.unavailable ? (
        <p className="note">{text.unavailable}</p>
      ) : view === null || view.items.length === 0 ? (
        <p className="note">{text.none}</p>
      ) : (
        <>
          {view.items.map((item, index) => (
            <KitRow key={`${item.address}-${index}`} club={club} index={index} item={item} editable={editable} onEdited={onEdited} />
          ))}
          <p className="note">{text.note}</p>
        </>
      )}
    </section>
  );
}

function KitRow({
  club,
  index,
  item,
  editable,
  onEdited,
}: {
  club: number;
  index: number;
  item: KitItem;
  editable: boolean;
  onEdited: () => void;
}) {
  const saved = item.colours.map(hex);
  const [colours, setColours] = useState<string[]>(saved);
  const [style, setStyle] = useState<number>(item.style);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the game holds is what the inputs show again whenever it is read.
  const savedKey = `${saved.join()}|${item.style}`;
  useEffect(() => {
    setColours(saved);
    setStyle(item.style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const styleOk = Number.isInteger(style) && style >= 0 && style <= 255;
  const changed = colours.some((colour, i) => colour !== saved[i]) || style !== item.style;
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await call("set_kit", { club, index, colours: colours.map((colour) => colour.slice(1)), style });
      onEdited();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kit-item">
      <h4>{text.itemName(item.slot, item.itemType)}</h4>
      <div className="kit-colours">
        {COLOUR_LABELS.map((label, i) => (
          <label key={label} className="kit-colour">
            <span>{label}</span>
            <input
              type="color"
              value={colours[i] ?? saved[i]}
              disabled={!editable || saving}
              onChange={(e) => {
                const next = [...colours];
                next[i] = e.currentTarget.value;
                setColours(next);
              }}
            />
          </label>
        ))}
        <label className="kit-colour">
          <span>{text.style}</span>
          <input
            type="number"
            min={0}
            max={255}
            value={Number.isNaN(style) ? "" : style}
            aria-invalid={!styleOk || undefined}
            disabled={!editable || saving}
            onChange={(e) => setStyle(e.currentTarget.valueAsNumber)}
          />
        </label>
      </div>
      {editable && (
        <div className="kit-actions">
          <button type="button" className="primary" disabled={saving || !changed || !styleOk} onClick={() => void save()}>
            {saving ? text.applying : text.apply}
          </button>
          <button
            type="button"
            disabled={saving || !changed}
            onClick={() => {
              setColours(saved);
              setStyle(item.style);
            }}
          >
            {text.reset}
          </button>
        </div>
      )}
      {error !== null && (
        <p className="note invalid" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
