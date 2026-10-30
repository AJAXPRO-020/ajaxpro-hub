export const normalizedClubTokens = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en-US")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean);

export const teamNamesMatch = (left: string, right: string) => {
  const a = normalizedClubTokens(left);
  const b = normalizedClubTokens(right);
  return a.length > 0 && b.length > 0 &&
    (a.every(token => b.includes(token)) || b.every(token => a.includes(token)));
};
