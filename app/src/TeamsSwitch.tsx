// The switch at the top of the Clubs tab between the clubs and the nations' national teams (#169). A national team is a
// team with a squad and a reputation, as a club's is, so both are listed in one tab rather than each in a tab of its
// own; each list keeps its own search, filters and selection while the other one is shown.

import { clubListText, nationalText } from "./labels";

/** Which teams the Clubs tab lists. */
export type Teams = "clubs" | "nationals";

export const readTeams = (value: unknown): Teams => (value === "nationals" ? "nationals" : "clubs");

const CHOICES: readonly Teams[] = ["clubs", "nationals"];

interface TeamsSwitchProps {
  teams: Teams;
  onChange: (teams: Teams) => void;
}

/** Two buttons in one frame, the list on show pressed. */
export function TeamsSwitch({ teams, onChange }: TeamsSwitchProps) {
  return (
    <div className="teams-switch" role="group" aria-label={nationalText.switchLabel}>
      {CHOICES.map((choice) => (
        <button
          key={choice}
          type="button"
          data-teams={choice}
          aria-pressed={teams === choice}
          onClick={() => onChange(choice)}
        >
          {choice === "clubs" ? clubListText.nav : nationalText.nav}
        </button>
      ))}
    </div>
  );
}
