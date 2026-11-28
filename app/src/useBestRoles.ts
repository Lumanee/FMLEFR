// The best positions and roles of a list of players, read from their details a few at a time while the tab shows, and
// kept for the session: a player's attributes do not change between two reads of the same game data.

import { useEffect, useState } from "react";
import { playerDetails } from "./scoutApi";
import { bestRoles, type PositionRole } from "./roles";

/** By game-data version, then player. */
const cache = new Map<string, PositionRole[]>();

/** How many players are read at once. */
const AT_ONCE = 6;

/** The best positions and roles by player UID, filled in as the details come; `done` once every one has been read. */
export function useBestRoles(uids: readonly number[], version: number): { roles: ReadonlyMap<number, PositionRole[]>; done: boolean } {
  const [roles, setRoles] = useState<ReadonlyMap<number, PositionRole[]>>(new Map());
  const [done, setDone] = useState(false);
  const key = uids.join(",");

  useEffect(() => {
    let alive = true;
    const known = new Map<number, PositionRole[]>();
    const todo: number[] = [];
    for (const uid of uids) {
      const hit = cache.get(`${version}:${uid}`);
      if (hit) {
        known.set(uid, hit);
      } else {
        todo.push(uid);
      }
    }
    setRoles(new Map(known));
    setDone(todo.length === 0);
    const worker = async () => {
      for (let uid = todo.shift(); uid !== undefined && alive; uid = todo.shift()) {
        try {
          const found = bestRoles(await playerDetails(uid));
          cache.set(`${version}:${uid}`, found);
          known.set(uid, found);
        } catch {
          // A player whose details cannot be read has no roles listed.
          known.set(uid, []);
        }
        if (alive) {
          setRoles(new Map(known));
        }
      }
    };
    Promise.all(Array.from({ length: AT_ONCE }, worker)).then(() => alive && setDone(true));
    return () => {
      alive = false;
    };
    // `key` stands for the list of UIDs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return { roles, done };
}
