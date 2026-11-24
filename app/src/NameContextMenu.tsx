// The menu of a right click on a name (a player, a member of staff, a club, a nation...): one entry that copies the name
// to the clipboard, to paste into the game's search. One listener on the document serves every list, profile and the
// squad calculator, so a name needs no markup of its own: the name is found from where the click landed (see
// `NAME_SELECTOR`), and a name that is none of those can carry `data-copy-name`. Text the user has selected is copied
// as it is selected. Over a field to type in, the browser's own menu is left alone.

import { useEffect, useRef, useState } from "react";
import { nameMenuText as text } from "./labels";

/** What holds a name, from the closest to the widest. A cell of a name column falls back to the name inside it. */
const NAME_SELECTOR = [
  "[data-copy-name]",
  ".name-text",
  ".name",
  ".name-link",
  ".compare-name",
  ".compare-chip-name",
  ".move-club-name",
  ".palette-name",
  ".profile-id h2",
  ".profile-fullname",
  ".scout-own-name",
  ".scout-quick-name",
  ".scout-spot-name",
  ".scout-spot-player-name",
  ".lineup-card-name",
  "td.col-name",
].join(",");

/** Parts of a name's element that are not the name: badges, tags, the muted words after it. */
const NOT_NAME = "abbr, .muted, .sub, .badge, [class*='badge'], [class*='tag'], svg, img, button:not(.name-link)";

/** The text of `element` without what is not the name. */
function nameOf(element: Element): string {
  const own = element.getAttribute("data-copy-name");
  if (own !== null && own !== "") {
    return own.trim();
  }
  let target: Element = element;
  if (element.matches("td.col-name")) {
    target = element.querySelector(".name-text, .name, .name-link") ?? element;
  }
  let result = "";
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent !== null && parent !== target && parent.closest(NOT_NAME) !== null && target.contains(parent.closest(NOT_NAME))) {
      continue;
    }
    result += node.textContent ?? "";
  }
  return result.replace(/\s+/g, " ").trim();
}

/** What a right click at `event` would copy, and whether it is the user's selection. */
function copyTarget(event: MouseEvent): { value: string; selection: boolean } | null {
  const target = event.target;
  if (!(target instanceof Element) || target.closest("input, textarea, [contenteditable='true']") !== null) {
    return null;
  }
  const selected = window.getSelection()?.toString().trim() ?? "";
  if (selected !== "" && !window.getSelection()?.isCollapsed) {
    return { value: selected, selection: true };
  }
  const holder = target.closest(NAME_SELECTOR);
  if (holder === null) {
    return null;
  }
  const value = nameOf(holder);
  return value === "" ? null : { value, selection: false };
}

/** Puts `value` on the clipboard. */
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // The web view refused the write; the old way still works on a click.
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export function NameContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; value: string; selection: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const open = (event: MouseEvent) => {
      const found = copyTarget(event);
      if (found === null) {
        setMenu(null);
        return;
      }
      event.preventDefault();
      setMenu({ x: event.clientX, y: event.clientY, ...found });
    };
    const close = () => setMenu(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    document.addEventListener("contextmenu", open);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("contextmenu", open);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", key);
    };
  }, []);

  useEffect(() => {
    if (menu !== null) {
      button.current?.focus();
    }
  }, [menu]);

  if (menu === null) {
    return null;
  }
  // Kept inside the window: the menu is about 12rem wide and one row tall.
  const left = Math.max(4, Math.min(menu.x, window.innerWidth - 220));
  const top = Math.max(4, Math.min(menu.y, window.innerHeight - 48));
  return (
    <>
      <div
        className="name-menu-scrim"
        onMouseDown={() => setMenu(null)}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(null);
        }}
      />
      <div className="squad-menu name-menu" role="menu" style={{ left, top }}>
        <button
          ref={button}
          type="button"
          role="menuitem"
          title={menu.value}
          onClick={() => {
            void copy(menu.value);
            setMenu(null);
          }}
        >
          {menu.selection ? text.copySelection : text.copy}
        </button>
      </div>
    </>
  );
}
