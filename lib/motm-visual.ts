export const MOTM_VISUAL_WIDTH = 1350;
export const MOTM_VISUAL_HEIGHT = 1080;
export const MOTM_VISUAL_TEMPLATE_URL = "/assets/motm/MOTM-4-Blank.png";

export type MotmVisualWinner = {
  player_id: string;
  name_snapshot: string;
  image_url_snapshot: string;
  votes: number;
  percentage: number;
};

export type MotmVisualData = {
  matchTitle: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  percentage: number;
  playerId: string;
  playerImageUrl: string;
  filename: string;
};

export const splitPlayerName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};

export const fitFontSize = (
  text: string,
  preferredSize: number,
  minimumSize: number,
  maximumWidth: number,
  measureAtSize: (size: number, value: string) => number,
) => {
  let size = preferredSize;
  while (size > minimumSize && measureAtSize(size, text) > maximumWidth) size -= 1;
  return size;
};

export const createMotmVisualData = (input: {
  status: string;
  slug: string;
  opponent: string;
  homeOrAway: string;
  shirtNumber: number | null;
  winner?: MotmVisualWinner;
}): MotmVisualData | null => {
  const { winner } = input;
  if (
    input.status !== "closed" ||
    !winner ||
    winner.votes <= 0 ||
    (input.shirtNumber !== null && (
      !Number.isInteger(input.shirtNumber) ||
      input.shirtNumber < 0 ||
      input.shirtNumber > 99
    )) ||
    !winner.player_id ||
    !winner.name_snapshot.trim() ||
    !winner.image_url_snapshot
  ) return null;

  const { firstName, lastName } = splitPlayerName(winner.name_snapshot);
  const opponent = input.opponent.trim().toLocaleUpperCase("nl-NL");
  const matchTitle = input.homeOrAway === "home" ? `AJAX-${opponent}` : `${opponent}-AJAX`;
  return {
    matchTitle,
    firstName: firstName.toLocaleUpperCase("nl-NL"),
    lastName: lastName.toLocaleUpperCase("nl-NL"),
    shirtNumber: input.shirtNumber,
    percentage: Math.round(winner.percentage),
    playerId: winner.player_id,
    playerImageUrl: winner.image_url_snapshot,
    filename: `ajaxpro-motm-${input.slug}-${winner.player_id}.png`,
  };
};
