/** Shared contract between the desktop app and the local backend (services/api). */
export type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type Tier = "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";

export interface RankInfo { tier: Tier; division: "I" | "II" | "III" | "IV"; lp: number; wins: number; losses: number }
/** rank is null for players who are unranked in Ranked Solo/Duo. */
export interface Summoner { riotId: string; level: number; rank: RankInfo | null; /** Region the player plays on, found automatically (e.g. "euw1"). */ platform?: string }
/** Your Ranked Solo rank as Apex saw it at one moment. Apex only knows LP at the moments it checked, never per game. */
export interface RankSnapshot { at: string; rank: RankInfo }
export interface RankHistory { snapshots: RankSnapshot[] }
export interface MatchSummary {
  id: string; champion: string; role: Role | null; win: boolean;
  kills: number; deaths: number; assists: number; cs: number;
  durationSec: number; queue: string; playedAt: string; // ISO date
}
/** What a player ran in one game: final items (empty slots dropped, at most 6), the trinket, the two summoner spells, and the rune choices Riot reports (keystone and secondary tree). */
export interface Loadout { items: number[]; trinket: number | null; spells: number[]; keystone: number | null; secondaryStyle: number | null }
export interface Participant {
  name: string; loadout: Loadout; champion: string; team: "blue" | "red"; kills: number; deaths: number; assists: number;
  cs: number; damage: number; gold: number; vision: number; isYou?: boolean;
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
export interface BuildItemBlock { name: string; items: BuildItem[] }
export interface SpellPairStat { ids: [number, number]; games: number; wins: number }
/** Skill priority ("max order", e.g. Q, E, W: the order the three basic skills reach rank 5) plus the most common first 9 skill points among games with that priority. */
export interface SkillOrderStat { max: string[]; levels: string[]; games: number; wins: number }
export interface PathItem { id: number; name: string; count: number }
/** A sequence of items as bought: starting items (any order), or the three core items in their usual build order. */
export interface ItemPathStat { items: PathItem[]; games: number; wins: number }
/**
 * What strong collected games used for one champion (optionally in one role). Items are the FINAL inventories at game end:
 * build order and starting items come from the timeline sample. Empty lists = not enough data.
 */
export interface ChampionBuild {
  champion: string; role: Role | null; games: number;
  runePages: RunePageStat[]; spells: SpellPairStat | null; itemBlocks: BuildItemBlock[];
  /** Games of this champion that have timeline data (only a share of collected games do). The three fields below come from those. */
  timelineGames: number; skillOrder: SkillOrderStat | null; startItems: ItemPathStat | null; corePath: ItemPathStat | null;
  /** Fewest games that must have kept the same three core items before corePath is shown (it is null below that). */
  minPathGames: number;
}

export interface MasteryEntry { champion: string; name: string; level: number; points: number }

export interface PoolEntry { champion: string; games: number; wins: number; points: number }

/** Collected statistics for the draft engine: pairs are [champion, champion, games, winsOfFirst], first id alphabetically first. */
export interface DraftStats {
  games: number; patch?: string;
  champions: { id: string; games: number; wins: number; roles: string[] }[];
  matchups: [string, string, number, number][];   // lane opponents: same role, opposite teams
  synergies: [string, string, number, number][];  // same team
}
/** Filters shared by every stats screen. platform: "all" or a region id; patch: "latest", "all" (= the last 5 patches, the only ones Apex keeps) or e.g. "16.22"; rank: "all" or a tier such as "EMERALD", which always means that tier AND ABOVE (Emerald IV and up). */
export interface StatsFilter { platform: string; patch: string; rank: string }
export interface FilterOption { id: string; matches: number }
/** What the collected data actually contains, so the UI only offers filters that have data. `patches` is at most the 5 newest, newest first. */
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

/** Live game scouting (Spectator-v5). Only what the game's own loading screen already shows, plus public rank data. */
export interface LivePlayer {
  riotId: string; champion: string; championName: string; team: "blue" | "red"; rank: RankInfo | null;
  /** Riot's "hot streak" flag on the Ranked Solo entry (won several in a row). */ hotStreak: boolean;
  /** Carries Smite, so almost certainly the jungler. Spectator data has no role field; Apex does not guess the other roles. */ jungle: boolean;
  isYou: boolean;
  /** Collected games on this champion (current patch, all roles), for a population win rate next to the player. 0 = no data. */ champGames: number; champWins: number;
}
export interface LiveBan { champion: string; championName: string; team: "blue" | "red" }
export interface LiveGame { inGame: true; queue: string; mode: string; lengthSec: number; bans: LiveBan[]; players: LivePlayer[] }
export type LiveResult = LiveGame | { inGame: false };

/** Every screen talks to this interface only; the local backend implements it over HTTP. */
export interface ApexApi {
  getSummoner(riotId: string): Promise<Summoner>;
  getRecentMatches(riotId: string, limit?: number): Promise<MatchSummary[]>;
  getMatchPage(riotId: string, cursor: number, limit: number): Promise<MatchPage>;
  /** riotId marks which participant is "you" in the scoreboard (real backend only). */
  getMatchDetail(matchId: string, riotId?: string): Promise<MatchDetail>;
  getChampionPool(riotId: string): Promise<PoolEntry[]>;
  getMastery(riotId: string): Promise<MasteryEntry[]>;
  /** Rank snapshots Apex recorded for this player, oldest first. History starts the first time Apex looked the player up. */
  getRankHistory(riotId: string): Promise<RankHistory>;
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
  getFilterOptions(): Promise<FilterOptions>;
  /** games is 0 when nothing has been collected for these filters yet. */
  getDraftStats(filter?: StatsFilter): Promise<DraftStats>;
  /** One finished game (the latest when matchId is omitted) compared with averages. */
  getRecap(riotId: string, matchId?: string): Promise<PostGameRecap>;
  /** Is this player in a game right now? If so, all ten players. */
  getLiveGame(riotId: string): Promise<LiveResult>;
}
