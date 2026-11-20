/** Shared contract between the desktop app and the local backend (services/api). */
import type { QueueFilter } from "./queues";
export * from "./queues";
export * from "./patch";
export type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type Tier = "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";

export interface RankInfo { tier: Tier; division: "I" | "II" | "III" | "IV"; lp: number; wins: number; losses: number }
/** rank is null for players who are unranked in Ranked Solo/Duo. */
export interface Summoner { riotId: string; level: number; rank: RankInfo | null; /** Region the player plays on, found automatically (e.g. "euw1"). */ platform?: string }
/** Your Ranked Solo rank as Apex saw it at one moment. Apex only knows LP at the moments it checked, never per game. */
export interface RankSnapshot { at: string; rank: RankInfo }
export interface RankHistory { snapshots: RankSnapshot[] }
/** Optional champion / role narrowing of a match list (the backend checks both on each loaded match). */
export interface MatchFilter { champion?: string; role?: Role }
export interface MatchSummary {
  id: string; champion: string; role: Role | null; win: boolean;
  kills: number; deaths: number; assists: number; cs: number;
  durationSec: number; queue: string; playedAt: string; // ISO date
  /** Riot's queue id, champion level at the end, and what the player ran (absent on older backends). */
  queueId?: number; level?: number; loadout?: Loadout;
}
/** What a player ran in one game: final items (empty slots dropped, at most 6), the trinket, the two summoner spells, and the rune choices Riot reports (keystone and secondary tree). */
/** `items` are the normal item slots (item0..item5, empty ones dropped); `roleItem` is the separate role quest slot of season 2026 (ADC boots, jungle pet, support item), shown in its own place. */
export interface Loadout { items: number[]; roleItem?: number | null; trinket: number | null; spells: number[]; keystone: number | null; secondaryStyle: number | null }
export interface Participant {
  name: string; loadout: Loadout; champion: string; team: "blue" | "red"; kills: number; deaths: number; assists: number;
  cs: number; damage: number; gold: number; vision: number; isYou?: boolean;
  /** Full Riot ID ("Name#TAG") when Riot reports both parts; the scoreboard links the player to their profile only with it. */
  riotId?: string;
}
export interface MatchDetail { id: string; blueWon: boolean; participants: Participant[] }
export interface MatchPage { items: MatchSummary[]; nextCursor: number | null }

/** One row of a stats table. `id` is the game id of what the row is (item id, keystone id, or champion id for matchups) so the UI can show its icon. */
/** Win Probability Added of an item for one champion, in percentage points (shrunk), with its 95% range and the win rate (0..1) those games would be expected to have without the item. A correlation within games of the same length and number of finished items, not proof that the item causes wins. */
export interface ItemWpa { wpa: number; lo: number; hi: number; expected: number }
export interface StatLine { name: string; games: number; wins: number; id?: number | string; /** Only on item rows. */ wpa?: ItemWpa }
export interface ChampionSummary { id: string; name: string; roles: Role[]; tags: string[]; games: number; wins: number; bans: number }
/** One champion met in a lane matchup (opposite team, same role) or played with as a teammate. `baseGames/baseWins` are THAT champion's own games in `role`, so the client can work out what the pairing is expected to do. */
export interface RelationLine { champion: string; name: string; role: Role; games: number; wins: number; baseGames: number; baseWins: number }
/** Matchups and synergies of one champion in one role. role is null when the champion has no collected games (then every list is empty). */
export interface ChampionRelations {
  champion: string; role: Role | null; base: { games: number; wins: number };
  matchups: RelationLine[]; /** Teammates in the OTHER four roles. */ synergies: RelationLine[];
}
/** One champion in one patch. `matches` is every collected game of that patch (the denominator of pick and ban rate); `bans` counts the champion's bans in them. */
export interface PatchPoint { patch: string; games: number; wins: number; bans: number; matches: number }
/** A champion across the kept patches, NEWEST FIRST. `role` is the role the games and pick rate are for (null = no collected games); bans are not tied to a role. */
export interface ChampionPatches { champion: string; role: Role | null; patches: PatchPoint[] }
/** One champion's newest patch next to the one before it, for the tier list's "changes" view. */
export interface PatchTrendRow { id: string; name: string; cur: PatchPoint; prev: PatchPoint }
/** The newest patch compared with the previous one for every champion that plays the role. `patch`/`previous` are null when fewer than two patches have data (then `rows` is empty). */
export interface PatchTrends { patch: string | null; previous: string | null; role: Role | null; rows: PatchTrendRow[] }
export interface ChampionList { patch: string; totalGames: number; champions: ChampionSummary[] }
export interface ChampionDetail extends ChampionSummary {
  totalGames: number; builds: StatLine[]; runes: StatLine[]; matchups: StatLine[];
}

/** A rune page as played in collected games: 4 primary + 2 secondary runes, then 3 stat shards (offense, flex, defense). */
export interface RunePageStat { primaryStyleId: number; subStyleId: number; perkIds: number[]; games: number; wins: number }
export interface BuildItem { id: number; name: string; games: number; wins: number; wpa?: ItemWpa }
/** A titled group of items, e.g. "Boots" or "Core items". */
/** `ordered`: the items are in their usual build order (the Core block when a build path is known). */
export interface BuildItemBlock { name: string; items: BuildItem[]; ordered?: boolean }
/** A keystone rune with its games, for champions without any full rune page. */
export interface KeystoneStat { id: number; games: number; wins: number }
export interface SpellPairStat { ids: [number, number]; games: number; wins: number }
/** Skill priority ("max order", e.g. Q, E, W: the order the three basic skills reach rank 5) plus the most common first 9 skill points among games with that priority. */
export interface SkillOrderStat { max: string[]; levels: string[]; games: number; wins: number;
  /** All 18 levels (one of Q, W, E, R each): levels 1-9 are the most common real sequence, 10-18 continue the max order (R at 11 and 16). Absent on old backends. */ grid?: string[] }
export interface PathItem { id: number; name: string; count: number }
/** A sequence of items as bought: starting items (any order), or the three core items in their usual build order. */
export interface ItemPathStat { items: PathItem[]; games: number; wins: number }
/**
 * What strong collected games used for one champion (optionally in one role). Items are the FINAL inventories at game end:
 * build order and starting items come from the timeline sample. Empty lists = not enough data.
 */
export interface ChampionBuild {
  champion: string; role: Role | null; games: number;
  /** Wins among `games` (all collected games of this champion and role). Optional: absent on old backends. */
  wins?: number;
  runePages: RunePageStat[]; /** Most played keystones; shown when `runePages` is empty. */ keystones: KeystoneStat[]; spells: SpellPairStat | null; itemBlocks: BuildItemBlock[];
  /** Games of this champion that have timeline data (only a share of collected games do). The three fields below come from those. */
  timelineGames: number; skillOrder: SkillOrderStat | null; startItems: ItemPathStat | null; corePath: ItemPathStat | null;
  /** Fewest games that must have kept the same three core items before corePath is shown (it is null below that). */
  minPathGames: number;
  /** The core items AND the usual boots in the order they are bought (boots only when most of those games had them). Null when corePath is null. Absent on old backends. */
  buildOrder?: ItemPathStat | null;
  /** The two most played summoner spell pairs (`spells` is the first). Absent on old backends. */
  spellPairs?: SpellPairStat[];
  /** Separate builds by what players finished with (AP, AD, Tank), each a complete build of its own games. Only present with two or more of them that have enough games. */
  variants?: BuildVariant[];
}
/** The eleven kinds of build, then the nine allowed mixes of two kinds. Decided from the finished items (see services/api build.ts `archetype`). */
export const PURE_ARCHETYPES = ["AD", "AP", "Bruiser", "Crit", "Heal & Shield", "Hybrid", "Lethality", "On-Hit", "Tank", "Utility", "Well Rounded"] as const;
export const MIXED_ARCHETYPES = ["AP / Bruiser", "Bruiser / Lethality", "Bruiser / Tank", "Crit / Lethality", "Crit / On-Hit", "Heal & Shield / Tank", "On-Hit / AD", "On-Hit / AP", "On-Hit / Crit", "Tank / Utility"] as const;
export type BuildArchetype = (typeof PURE_ARCHETYPES)[number] | (typeof MIXED_ARCHETYPES)[number];
/** One build variant: the games of one archetype with their own runes, spells, items and skill order. */
/** `id` is a URL/file-safe slug of the kind ("heal-and-shield-tank"), `label` the name shown to people. */
export interface BuildVariant { id: string; label: BuildArchetype; games: number; wins: number; build: Omit<ChampionBuild, "variants"> }

export interface MasteryEntry { champion: string; name: string; level: number; points: number }

/** One champion of your pool. `games`/`wins`: your last 20 games on it; `points`: mastery. `byRole`: those games split by role (games whose role is unknown are only in `games`); absent on older backends. */
export interface PoolEntry { champion: string; games: number; wins: number; points: number; byRole?: { role: Role; games: number; wins: number }[] }

/** A teammate seen in 2+ of the player's games. `riotId` (`Name#TAG`) is absent when Riot did not send the tag; `name` is always set. */
export interface PlayedWithEntry { name: string; riotId?: string; games: number; wins: number }
/** `GET /v1/players/:riotId/overview`: the same latest games as the profile sidebar (`games`) and the teammates seen in 2+ of them. */
export interface PlayerOverview { games: number; playedWith: PlayedWithEntry[] }

/** Collected statistics for the draft engine: pairs are [champion, champion, games, winsOfFirst], first id alphabetically first. */
/** Sums over the collected games of one champion that carry damage-type data: what the team composition analysis averages. */
export interface CompProfileRow { id: string; /** Role these games were played in; absent (older backends, fixtures) or null = all roles / unknown. */ role?: string | null; games: number; phys: number; magic: number; trueDmg: number; taken: number; cc: number; seconds: number;
  /** Peel (E.2e): heals and shields on teammates, summed only over the `peelGames` games that carry them (older games have none and are not counted as 0), with those games' `peelSeconds`. All four are absent when no game carries them. */
  peelGames?: number; heals?: number; shields?: number; peelSeconds?: number }
export interface DraftStats {
  games: number; patch?: string;
  champions: { id: string; games: number; wins: number; roles: string[] }[];
  matchups: [string, string, number, number][];   // lane opponents: same role, opposite teams
  synergies: [string, string, number, number][];  // same team
  /** Role-keyed twins of `champions` and `matchups` (optional: older backends and fixtures omit them, and the engine then falls back to the role-less numbers). Rows are [champion, champion, role, games, winsOfFirst], first id alphabetically first; the role is the one BOTH played. */
  roleChampions?: { id: string; role: string; games: number; wins: number }[];
  roleMatchups?: [string, string, string, number, number][];
  /** Damage split, damage taken and CC per champion AND role (optional: older backends and test fixtures omit it). */
  profiles?: CompProfileRow[];
  /** Games and wins per champion, role and game-length bucket (0 early under 25 min, 1 mid, 2 late over 33 min), rows [champion, role, bucket, games, wins]. Optional: older backends omit it. */
  lengthBuckets?: [string, string, number, number, number][];
}
/** Filters shared by every stats screen. platform: "all" or a region id; patch: "latest", "all" (= the last 5 patches, the only ones Apex keeps) or e.g. "26.22"; rank: "all" or a tier such as "EMERALD", which always means that tier AND ABOVE (Emerald IV and up). */
export interface StatsFilter { platform: string; patch: string; rank: string }
export interface FilterOption { id: string; matches: number }
/** What the collected data actually contains, so the UI only offers filters that have data. `patches` is at most the 5 newest, newest first. Each list counts games under the OTHER two active filters. */
export interface FilterOptions { platforms: FilterOption[]; ranks: FilterOption[]; patches: FilterOption[] }

/** Post-game recap: one finished game compared with collected averages, the player's own recent games, and the lobby. */
export interface RecapMetric {
  id: "kda" | "cs" | "damage" | "gold"; label: string; unit: string; you: number;
  /** Average of comparable collected games (same champion and role, ideally same rank). null = not enough data. */ vsRank: number | null;
  /** Average of the player's own other recent games in this role. null = fewer than 3. */ vsYou: number | null;
  /** 1 = best of the ten players in this game. */ lobbyRank: number;
}
export interface PostGameRecap {
  matchId: string; queue: string; win: boolean; durationSec: number; playedAt: string;
  champion: string; championName: string; role: Role | null; kills: number; deaths: number; assists: number;
  killParticipation: number; damageShare: number; loadout: Loadout; metrics: RecapMetric[];
  baseline: { label: string; games: number } | null; personal: { games: number } | null;
}

/** Live game scouting (Spectator-v5): the ten players and champions, summoner spells and runes Riot's spectator data lists, plus public rank data. Never in-game state. */
export interface LivePlayer {
  riotId: string; champion: string; championName: string; team: "blue" | "red"; rank: RankInfo | null;
  /** Riot's "hot streak" flag on the Ranked Solo entry (won several in a row). */ hotStreak: boolean;
  /** Carries Smite, so almost certainly the jungler. Spectator data has no role field; Apex does not guess the other roles. */ jungle: boolean;
  isYou: boolean;
  /** Keystone rune id and secondary rune tree id from the spectator data (owner decision Nov 20 2026: shown for all ten players). null = Riot gave none (bots). */ keystone: number | null; secondaryStyle: number | null;
  /** The player's two summoner spells in THEIR slot order (D, then F), as the spectator data reports them; shown as they are. Empty when Riot gives none. */ spells: number[];
  /** Collected games on this champion (current patch, all roles), for a population win rate next to the player. 0 = no data. */ champGames: number; champWins: number;
}
export interface LiveBan { champion: string; championName: string; team: "blue" | "red" }
export interface LiveGame { inGame: true; queue: string; mode: string; lengthSec: number; bans: LiveBan[]; players: LivePlayer[] }
export type LiveResult = LiveGame | { inGame: false };

/** Every screen talks to this interface only; the local backend implements it over HTTP. */
export interface ApexApi {
  getSummoner(riotId: string): Promise<Summoner>;
  getRecentMatches(riotId: string, limit?: number, queue?: QueueFilter, filter?: MatchFilter): Promise<MatchSummary[]>;
  /** Teammates seen twice over the latest games of one queue group (default 50, the backend's maximum). */
  getOverview(riotId: string, limit?: number, queue?: QueueFilter): Promise<PlayerOverview>;
  /** `queue`: only games of that queue group (default all). */
  /** `filter`: only games on that champion (Data Dragon id, as in `MatchSummary.champion`) and/or in that role. */
  getMatchPage(riotId: string, cursor: number, limit: number, queue?: QueueFilter, filter?: MatchFilter): Promise<MatchPage>;
  /** riotId marks which participant is "you" in the scoreboard (real backend only). */
  getMatchDetail(matchId: string, riotId?: string): Promise<MatchDetail>;
  getChampionPool(riotId: string): Promise<PoolEntry[]>;
  getMastery(riotId: string): Promise<MasteryEntry[]>;
  /** Rank snapshots Apex recorded for this player, oldest first. History starts the first time Apex looked the player up. */
  /** `fresh`: skip the backend's 5 minute profile cache, so a rank change right after a game is seen. */
  getRankHistory(riotId: string, opts?: { fresh?: boolean }): Promise<RankHistory>;
  getChampions(role?: Role, filter?: StatsFilter): Promise<ChampionList>;
  getChampion(id: string, filter?: StatsFilter): Promise<ChampionDetail>;
  /** Most played rune pages, summoner spells and final items for a champion (role optional). */
  getChampionBuild(id: string, role?: Role, filter?: StatsFilter): Promise<ChampionBuild>;
  /** Lane matchups and teammate synergies of a champion in one role (default: the role it plays most). */
  getChampionRelations(id: string, role?: Role, filter?: StatsFilter): Promise<ChampionRelations>;
  /** Games, wins and bans per kept patch (newest first) for a champion in one role (default: its busiest). The patch filter is ignored; region and rank apply. */
  getChampionPatches(id: string, role?: Role, filter?: StatsFilter): Promise<ChampionPatches>;
  /** Newest patch vs the previous one for every champion in a role. The patch filter is ignored; region and rank apply. */
  getPatchTrends(role: Role, filter?: StatsFilter): Promise<PatchTrends>;
  getFilterOptions(filter?: StatsFilter): Promise<FilterOptions>;
  /** games is 0 when nothing has been collected for these filters yet. */
  getDraftStats(filter?: StatsFilter): Promise<DraftStats>;
  /** One finished game (the latest when matchId is omitted) compared with averages. */
  getRecap(riotId: string, matchId?: string): Promise<PostGameRecap>;
  /** Is this player in a game right now? If so, all ten players. */
  getLiveGame(riotId: string): Promise<LiveResult>;
}
