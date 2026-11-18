/**
 * Riot's public patch number is the game's internal version with the major number +10: the internal version 16.22.100.1 is patch 26.22
 * (2025 was 15.x inside and 25.x in the patch notes). Apex stores and shows the public number everywhere. Versions that already look public
 * (20 and above) and anything unreadable are left alone, so this keeps working if Riot ever reports the public number itself. Pure.
 */
export function publicPatch(version: string): string {
  const [major, minor] = version.split("."), n = Number(major);
  if (minor === undefined || !Number.isInteger(n)) return version.split(".").slice(0, 2).join(".");
  return `${n >= 10 && n < 20 ? n + 10 : n}.${minor}`;
}
