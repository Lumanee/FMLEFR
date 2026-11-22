// The note that asks for a star on GitHub: once, in the top right corner of the views, from the third start of the app
// on, when it is connected to the game and nothing else is being told (an update, what's new). It is asked once, not at
// every start: its first showing puts it away for good, whichever button is pressed, or none. The count of starts is
// kept in the web view's storage, as the language is.

import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { inTauri } from "./api";
import { starText } from "./labels";

const text = starText;

/** Where the starts are counted; it holds `ASKED` once the note has shown. */
const STORAGE_KEY = "fmlibre.star";
const ASKED = "asked";

/** Set for the run once its start is counted: changing the language reloads the window, which is not a new start. */
const COUNTED_KEY = "fmlibre.starCounted";

/** The start from which the note shows: by then the app has had the chance to be of use. */
const FROM_START = 3;

/** The project's page. The opener allows only addresses under it (`capabilities/default.json`), hence the slash. */
const PROJECT_PAGE = "https://github.com/tozmoz/FMLibreEditor/";

/** `?star` in the browser preview shows the note at once; without it the preview never does. */
const previewAsked = !inTauri && new URLSearchParams(window.location.search).has("star");

/** Whether the note is due this run. The start is counted here, once per run. */
const dueAtStart: boolean = (() => {
  if (!inTauri) {
    return previewAsked;
  }
  try {
    const kept = window.localStorage.getItem(STORAGE_KEY);
    if (kept === ASKED) {
      return false;
    }
    // Anyone can edit the storage: what is not a count starts the count again.
    let starts = Number.parseInt(kept ?? "", 10);
    starts = Number.isSafeInteger(starts) && starts > 0 ? starts : 0;
    if (window.sessionStorage.getItem(COUNTED_KEY) === null) {
      starts += 1;
      window.localStorage.setItem(STORAGE_KEY, String(starts));
      window.sessionStorage.setItem(COUNTED_KEY, "1");
    }
    return starts >= FROM_START;
  } catch {
    // Where nothing can be kept, the note would show at every start: it never does.
    return false;
  }
})();

function keepAsked(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, ASKED);
  } catch {
    // Not kept: the note may show again at the next start, which is all that is lost.
  }
}

/**
 * Whether the note is up. It shows the first time `ready` is true in a run where it is due, and stays until one of its
 * buttons closes it (`close`); it does not show again, in this run or a later one.
 */
export function useStarRequest(ready: boolean) {
  const [phase, setPhase] = useState<"waiting" | "shown" | "done">(dueAtStart ? "waiting" : "done");

  useEffect(() => {
    if (phase === "waiting" && ready) {
      setPhase("shown");
      if (inTauri) {
        keepAsked();
      }
    }
  }, [phase, ready]);

  const close = useCallback(() => setPhase("done"), []);
  return { shown: phase === "shown", close };
}

/** The star on the note's button. */
function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.6l2.27 4.6 5.08.74-3.67 3.58.87 5.06L10 14.18l-4.55 2.4.87-5.06L2.65 7.94l5.08-.74z" />
    </svg>
  );
}

/** The note itself: what a star does, a button that opens the project's page on GitHub, and one that says no. */
export function StarRequest({ onClose }: { onClose: () => void }) {
  const star = () => {
    if (inTauri) {
      void openUrl(PROJECT_PAGE);
    } else {
      window.open(PROJECT_PAGE, "_blank", "noopener");
    }
    onClose();
  };

  return (
    <div className="star-anchor">
      <div className="star-request" role="status">
        <strong className="star-request-title">{text.title}</strong>
        <p>{text.text}</p>
        <div className="star-request-actions">
          <button type="button" className="primary" onClick={star}>
            <StarIcon />
            {text.star}
          </button>
          <button type="button" onClick={onClose}>
            {text.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
