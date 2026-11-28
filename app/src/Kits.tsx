// A club's kits (docs/recon/fm27-kits.md): each item the game keeps, with its five colours and its style. While the game
// can be written to, the colours and the style can be changed; the change is written at once, logged and undone like
// any other. The game redraws kits only when a day passes, which the note under the kits says.

import { useContext, useEffect, useId, useState } from "react";
import { call } from "./api";
import { describeError } from "./format";
import { kitsText as text } from "./labels";
import { EditorContext } from "./useProfileEditing";
import type { ClubKits, KitItem } from "./types";

type Read = { view: ClubKits } | { error: string };

const COLOUR_LABELS = [text.foreground, text.background, text.outline, text.number, text.numberOutline] as const;

/** `#rrggbb` for a colour of red, green and blue. */
const hex = (colour: readonly number[]) => `#${colour.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

/** The outline of a shirt, drawn in a 100 by 100 box. */
const SHIRT = "M33 8 L12 18 L2 42 L18 50 L24 38 L24 94 L76 94 L76 38 L82 50 L98 42 L88 18 L67 8 Q50 22 33 8 Z";

/** How many patterns the preview draws: the style number picks one by its remainder. */
const PATTERNS = 8;

/**
 * A shirt in the colours and style given: the background as the base, the foreground as the pattern, the outline around
 * it, and the number in its own colours. The game's own patterns are not all known, so the pattern is an approximation
 * by style number: the colours are what the preview is sure about.
 */
export function KitPreview({ colours, style, size = 96, shirt = true }: { colours: readonly string[]; style: number; size?: number; shirt?: boolean }) {
  const id = useId();
  const [fg, bg, outline, number, numberOutline] = colours;
  const pattern = Number.isInteger(style) ? ((style % PATTERNS) + PATTERNS) % PATTERNS : 0;
  const clip = `${id}-clip`;
  return (
    <svg className="kit-preview" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={text.preview}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIRT} />
        </clipPath>
      </defs>
      {shirt ? (
        <>
          <g clipPath={`url(#${clip})`}>
            <rect width="100" height="100" fill={bg} />
            {pattern === 1 && [0, 1, 2, 3, 4].map((i) => <rect key={i} x={4 + i * 20} y="0" width="10" height="100" fill={fg} />)}
            {pattern === 2 && [0, 1, 2, 3].map((i) => <rect key={i} x="0" y={8 + i * 22} width="100" height="11" fill={fg} />)}
            {pattern === 3 && <rect x="50" y="0" width="50" height="100" fill={fg} />}
            {pattern === 4 && <path d="M0 20 L100 70 L100 90 L0 40 Z" fill={fg} />}
            {pattern === 5 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <rect key={i} x={i * 10 + 4} y="0" width="2.5" height="100" fill={fg} />)}
            {pattern === 6 && <rect x="0" y="0" width="100" height="50" fill={fg} />}
            {pattern === 7 && (
              <>
                <rect x="0" y="0" width="26" height="100" fill={fg} />
                <rect x="74" y="0" width="26" height="100" fill={fg} />
              </>
            )}
            {pattern === 0 && (
              <>
                <rect x="0" y="0" width="100" height="9" fill={fg} opacity="0.0" />
                <path d="M33 8 Q50 22 67 8 L64 4 Q50 16 36 4 Z" fill={fg} />
              </>
            )}
          </g>
          <path d={SHIRT} fill="none" stroke={outline} strokeWidth="3" strokeLinejoin="round" />
          <text
            x="50"
            y="66"
            textAnchor="middle"
            fontSize="30"
            fontWeight="800"
            fill={number}
            stroke={numberOutline}
            strokeWidth="1.5"
            paintOrder="stroke"
          >
            9
          </text>
        </>
      ) : (
        <>
          <rect x="14" y="26" width="72" height="48" rx="8" fill={bg} stroke={outline} strokeWidth="3" />
          <rect x="14" y="26" width="72" height="12" rx="6" fill={fg} />
        </>
      )}
    </svg>
  );
}

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
          <div className="kit-strip">
            {view.items.map((item, index) =>
              item.itemType === 1 ? (
                <figure key={`${item.address}-${index}`}>
                  <KitPreview colours={item.colours.map(hex)} style={item.style} size={88} />
                  <figcaption>{text.itemName(item.slot, item.itemType)}</figcaption>
                </figure>
              ) : null,
            )}
          </div>
          {view.items.map((item, index) => (
            <KitRow key={`${item.address}-${index}`} club={club} index={index} item={item} editable={editable} onEdited={onEdited} />
          ))}
          <p className="note">{text.note}</p>
          <p className="note">{text.preview}</p>
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
      <div className="kit-body">
      <KitPreview colours={colours.map((c, i) => c ?? saved[i])} style={Number.isNaN(style) ? item.style : style} shirt={item.itemType === 1} />
      <div className="kit-edit">
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
      </div>
    </div>
  );
}
