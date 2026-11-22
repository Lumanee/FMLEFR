// The More actions menu of a squad: the actions on the whole team one at a time, Heal all to Max tactics, which Team at
// its best does together. The tab's controls sit in a box that scrolls, which would cut a menu off at its edge, so the
// menu is drawn over the window, under its button (above it where the window has no room below).

import { useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { squadText as text } from "./labels";
import type { TeamAction } from "./types";
import { EditorContext } from "./useProfileEditing";

/** The room the menu keeps between itself and its button, and between itself and the edge of the window. */
const GAP = 4;

/** Where the open menu hangs: the window's coordinates of its button. */
interface Anchor {
  left: number;
  top: number;
  bottom: number;
}

/** One action of the menu, as its button in the row would have shown it. */
export interface MenuAction {
  action: TeamAction;
  label: string;
  /** Hover text: what it does, or why it waits. */
  title: string;
  /** Whether there is nothing it can do now: the item is dimmed, and says why. */
  waiting: boolean;
}

interface TeamActionMenuProps {
  actions: readonly MenuAction[];
  /** Whether the game can be written to: without it the button is disabled, and says why. */
  editable: boolean;
  /** Whether a write is under way: the menu waits for it. */
  busy: boolean;
  onPick: (action: TeamAction) => void;
}

/** The More actions button and, once it is pressed, its menu. */
export function TeamActionMenu({ actions, editable, busy, onPick }: TeamActionMenuProps) {
  const { readOnlyNote } = useContext(EditorContext);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  const show = () => {
    const box = button.current?.getBoundingClientRect();
    if (box) {
      setAnchor({ left: box.left, top: box.top, bottom: box.bottom });
    }
  };

  const close = (refocus: boolean) => {
    setAnchor(null);
    if (refocus) {
      button.current?.focus();
    }
  };

  // Once the menu is on screen it moves above its button if it would run off the bottom of the window, and left if it
  // would run off its right edge; then its first item takes focus.
  useLayoutEffect(() => {
    const list = menu.current;
    if (anchor === null || list === null) {
      return;
    }
    const { height, width } = list.getBoundingClientRect();
    if (anchor.bottom + GAP + height > window.innerHeight - GAP) {
      list.style.top = `${Math.max(GAP, anchor.top - GAP - height)}px`;
    }
    const room = document.documentElement.clientWidth - GAP;
    if (anchor.left + width > room) {
      list.style.left = `${Math.max(GAP, room - width)}px`;
    }
    list.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [anchor]);

  // A press elsewhere closes it, and so does a scroll or a resize: the button moves with the page, the menu does not.
  useEffect(() => {
    if (!open) {
      return;
    }
    const pressed = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && (menu.current?.contains(target) || button.current?.contains(target))) {
        return;
      }
      setAnchor(null);
    };
    const hide = () => setAnchor(null);
    document.addEventListener("pointerdown", pressed, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", pressed, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  // A write that starts while it is open (from another control) closes it: its items would act on numbers out of date.
  useEffect(() => {
    if (busy) {
      setAnchor(null);
    }
  }, [busy]);

  const pick = (item: MenuAction) => {
    if (item.waiting) {
      return;
    }
    close(true);
    onPick(item.action);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const at = items.findIndex((item) => item === document.activeElement);
    let next: HTMLElement | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = items[(at + 1) % items.length];
        break;
      case "ArrowUp":
        next = items[(at - 1 + items.length) % items.length];
        break;
      case "Home":
        next = items[0];
        break;
      case "End":
        next = items[items.length - 1];
        break;
      case "Escape":
        // A profile behind closes on Escape too: this one is the menu's.
        event.stopPropagation();
        event.preventDefault();
        close(true);
        return;
      case "Tab":
        // Tab leaves the menu for the controls after its button.
        close(true);
        return;
      default:
        return;
    }
    event.preventDefault();
    next?.focus();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="squad-action squad-more"
        aria-haspopup="menu"
        aria-expanded={open}
        // While a write is under way the button is only dimmed (aria-disabled): a disabled button loses focus.
        aria-disabled={busy || undefined}
        disabled={!editable}
        title={editable ? text.moreActionsTitle : readOnlyNote}
        onClick={() => {
          if (open) {
            setAnchor(null);
          } else if (!busy) {
            show();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open && !busy) {
            event.preventDefault();
            show();
          }
        }}
      >
        <span>{text.moreActions}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 8l4.5 4.5L14.5 8" />
        </svg>
      </button>
      {anchor !== null &&
        createPortal(
          <div
            ref={menu}
            className="squad-menu squad-actions-menu"
            role="menu"
            aria-label={text.moreActions}
            style={{ top: anchor.bottom + GAP, left: anchor.left }}
            onKeyDown={keyDown}
          >
            {actions.map((item) => (
              <button
                key={item.action}
                type="button"
                role="menuitem"
                tabIndex={-1}
                // Dimmed, not disabled: the keys still reach it, and its hover text says why it waits.
                aria-disabled={item.waiting || undefined}
                title={item.title}
                onClick={() => pick(item)}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
