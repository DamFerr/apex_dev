import { placeFlash } from "@apex/lcu-core";

/**
 * Summoner spells as Apex SHOWS them: Flash is always the left one, on Apex's own recommendations (the champion page). A real player's
 * spells in a match history are NOT passed through here: they show in the order that player used them. The Flash key setting (D / F) is NOT used for display: it only decides which
 * slot Flash goes on when Apex writes your spells into champ select (`importer.ts`). Pairs without Flash keep the order they came in.
 */
export const displaySpells = (ids: number[]): number[] => (ids.length === 2 ? placeFlash([ids[0]!, ids[1]!], "D") : ids);
