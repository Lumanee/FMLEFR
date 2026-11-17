// A club's sponsorship deals, in its finances (#114): each deal by the name the game's Sponsorship screen gives its
// kind, what it pays per season and in all, its term, and the change a relegation (or a promotion) brings. Read only.
// The editor reads them from the game each time the finances show, a few pointers and no scan; the deals that have
// ended, which the game's screen leaves out, are listed last and marked.

import { useEffect, useState } from "react";
import { call } from "./api";
import { describeError, formatDate, formatMoney } from "./format";
import { sponsorshipsText as text } from "./labels";
import { Fact } from "./ProfileParts";
import type { ClubSponsorships, Sponsorship } from "./types";

type Read = { view: ClubSponsorships } | { error: string };

/** The deals of the club `club`, read when its finances are shown and when the data is read again. */
export function SponsorshipsGroup({ club, version }: { club: number; version: number }) {
  const [read, setRead] = useState<Read | null>(null);

  useEffect(() => {
    let alive = true;
    call<ClubSponsorships>("club_sponsorships", { club }).then(
      (view) => alive && setRead({ view }),
      (e) => alive && setRead({ error: describeError(e) }),
    );
    return () => {
      alive = false;
    };
  }, [club, version]);

  const view = read && "view" in read ? read.view : null;
  // The deals the game's screen lists first, as they stand in the game; the ended ones after them.
  const deals = view ? [...view.deals.filter((deal) => !deal.ended), ...view.deals.filter((deal) => deal.ended)] : [];
  return (
    <section className="profile-group sponsorships" aria-busy={read === null}>
      <h3>{text.title}</h3>
      {read === null ? (
        <p className="note">{text.reading}</p>
      ) : "error" in read ? (
        <p className="note invalid" role="alert">
          {read.error}
        </p>
      ) : view?.unavailable ? (
        <p className="note">{view.unavailable === "unreadable" ? text.unavailableUnreadable : text.unavailableBuild}</p>
      ) : deals.length === 0 ? (
        <p className="note">{text.none}</p>
      ) : (
        <>
          {deals.map((deal, index) => (
            <Deal key={index} deal={deal} />
          ))}
          <p className="note">{text.note}</p>
        </>
      )}
    </section>
  );
}

function Deal({ deal }: { deal: Sponsorship }) {
  const term = [formatDate(deal.start), formatDate(deal.end)].filter(Boolean).join(" – ");
  return (
    <div className={`sponsor-deal${deal.ended ? " ended" : ""}`}>
      <h4>
        <span title={deal.name === null ? text.unnamedTitle : undefined}>{deal.name ?? text.unnamed(deal.kind)}</span>
        {deal.ended && (
          <span className="sponsor-ended" title={text.endedTitle}>
            {text.ended}
          </span>
        )}
      </h4>
      <dl className="stats">
        <Fact label={text.perSeason}>{formatMoney(deal.perSeason)}</Fact>
        <Fact label={text.total}>{formatMoney(deal.total)}</Fact>
        {term !== "" && (
          <Fact label={text.term}>{deal.years === null ? term : `${term} (${text.years(deal.years)})`}</Fact>
        )}
      </dl>
      {deal.percent > 0 && <p className="note">{deal.rises ? text.rises(deal.percent) : text.falls(deal.percent)}</p>}
    </div>
  );
}
