import { describe, expect, it } from "vitest";
import { gameEnded, RANK_REFRESH_DELAYS_MS } from "./rankRefresh";

describe("gameEnded", () => {
  it("fires when a running game hands over to the end-of-game phases or the lobby", () => {
    for (const next of ["WaitingForStats", "PreEndOfGame", "EndOfGame", "Lobby"]) { expect(gameEnded("InProgress", next)).toBe(true); expect(gameEnded("Reconnect", next)).toBe(true); }
  });
  it("fires only once per game: the later end-of-game steps do not count again", () => {
    expect(gameEnded("WaitingForStats", "EndOfGame")).toBe(false); expect(gameEnded("EndOfGame", "Lobby")).toBe(false); expect(gameEnded("PreEndOfGame", "EndOfGame")).toBe(false);
  });
  it("ignores a lost client connection, the start of a game and champ select", () => {
    expect(gameEnded("InProgress", "None")).toBe(false); expect(gameEnded("ChampSelect", "GameStart")).toBe(false); expect(gameEnded("GameStart", "InProgress")).toBe(false);
    expect(gameEnded("Lobby", "ChampSelect")).toBe(false); expect(gameEnded("InProgress", "Reconnect")).toBe(false);
  });
  it("asks twice, soon and later", () => expect([...RANK_REFRESH_DELAYS_MS]).toEqual([30_000, 120_000]));
});
