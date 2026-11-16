import type { Role } from "@apex/schema";

/** Guesses roles from Riot's class tags. Only a fallback for champions without enough collected games. */
export const guessRoles = (tags: string[]): Role[] =>
  ({ Marksman: ["ADC"], Support: ["SUPPORT"], Tank: ["TOP", "SUPPORT"], Fighter: ["TOP", "JUNGLE"], Assassin: ["MID", "JUNGLE"], Mage: ["MID"] } as Record<string, Role[]>)[tags[0]] ?? ["MID"];
