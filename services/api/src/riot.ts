import { parseRateLimit, type RateLimiter } from "./rateLimiter";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const REGION: Record<string, string> = { euw1: "europe", eun1: "europe", tr1: "europe", ru: "europe", me1: "europe", na1: "americas", br1: "americas", la1: "americas", la2: "americas",
  kr: "asia", jp1: "asia", oc1: "sea", ph2: "sea", sg2: "sea", th2: "sea", tw2: "sea", vn2: "sea" };
export const PLATFORM_IDS = Object.keys(REGION);
export const regionOf = (platform: string) => REGION[platform] ?? (() => { throw new HttpError(400, `Unknown platform "${platform}"`); })();

export interface RiotParticipant { puuid: string; champLevel?: number; riotIdGameName?: string; riotIdTagline?: string; summonerName?: string; championName: string; teamId: number; teamPosition: string; win: boolean;
  kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number; totalDamageDealtToChampions: number; goldEarned: number; visionScore: number;
  physicalDamageDealtToChampions?: number; magicDamageDealtToChampions?: number; trueDamageDealtToChampions?: number; totalDamageTaken?: number; timeCCingOthers?: number; /** Heals and shields on teammates (Peel data, E.2e); names checked against published Riot typings, not a live match. Absent on older games. */ totalHealsOnTeammates?: number; totalDamageShieldedOnTeammates?: number;
  championId?: number; individualPosition?: string; item0?: number; item1?: number; item2?: number; item3?: number; item4?: number; item5?: number; item6?: number;
  summoner1Id?: number; summoner2Id?: number; perks?: { styles: { style?: number; selections: { perk: number }[] }[]; statPerks?: { offense: number; flex: number; defense: number } } }
export interface RiotMatch { metadata: { matchId: string }; info: { gameDuration: number; gameCreation: number; gameEndTimestamp?: number; queueId: number; gameVersion?: string; participants: RiotParticipant[];
  teams?: { teamId: number; bans: { championId: number }[] }[] } }
/** Match-v5 timeline, only the parts Apex reads. participantId is the 1-based index into metadata.participants. */
export interface RiotTimelineEvent { type: string; timestamp: number; participantId?: number; itemId?: number; beforeId?: number; afterId?: number; skillSlot?: number; levelUpType?: string }
/** One per-minute snapshot of a player in a timeline frame (names as in Riot's match-v5 typings, NOT checked against a live match). */
export interface RiotParticipantFrame { totalGold?: number; xp?: number; minionsKilled?: number; jungleMinionsKilled?: number }
export interface RiotTimeline { metadata: { participants: string[] }; info: { frames: { timestamp?: number; participantFrames?: Record<string, RiotParticipantFrame>; events?: RiotTimelineEvent[] }[] } }
export interface LeagueEntry { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number; hotStreak?: boolean }
export interface LadderEntry { puuid?: string; tier: string; rank: string; leaguePoints: number }
export interface ActiveParticipant { puuid?: string; riotId?: string; teamId: number; championId: number; spell1Id?: number; spell2Id?: number; bot?: boolean; /** Spectator-v5 runes: perkIds[0] is the keystone, perkSubStyle the secondary tree. */ perks?: { perkIds?: number[]; perkStyle?: number; perkSubStyle?: number } }
export interface RiotActiveGame { gameId: number; gameMode: string; gameType?: string; gameLength: number; gameQueueConfigId?: number; participants: ActiveParticipant[]; bannedChampions?: { championId: number; teamId: number }[] }
export interface RiotMastery { championId: number; championLevel: number; championPoints: number }

/** Only what Apex needs. A fake implements this in tests. */
export interface RiotApi {
  account(name: string, tag: string, region: string): Promise<{ puuid: string; gameName: string; tagLine: string }>;
  summoner(puuid: string, platform: string): Promise<{ summonerLevel: number }>;
  league(puuid: string, platform: string): Promise<LeagueEntry[]>;
  /** low = background priority (collector). queue filters by queue id, e.g. 420 for Ranked Solo. */
  matchIds(puuid: string, region: string, start: number, count: number, queue?: number, low?: boolean): Promise<string[]>;
  match(id: string, region: string, low?: boolean): Promise<RiotMatch>;
  timeline(id: string, region: string, low?: boolean): Promise<RiotTimeline>;
  ladder(platform: string, tier: string, division: string, page: number, low?: boolean): Promise<LadderEntry[]>;
  mastery(puuid: string, platform: string, count: number): Promise<RiotMastery[]>;
  /** Spectator-v5. Throws HttpError 404 when the player is not in a game. */
  activeGame(puuid: string, platform: string): Promise<RiotActiveGame>;
}

const REQUEST_TIMEOUT_MS = 15_000, NET_RETRIES = 3, SERVER_RETRIES = 2, NET_BACKOFF_MS = 500;
/** Node reports network failures as a bare "fetch failed"; the real reason (ENOTFOUND, ETIMEDOUT, ...) is on the cause. */
export function networkCause(e: unknown): string {
  const err = e as { name?: string; code?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "timed out";
  return err?.cause?.code ?? err?.code ?? err?.cause?.message ?? err?.message ?? "unknown network error";
}

export class HttpRiot implements RiotApi {
  constructor(private key: string, private limiters: { for(host: string): RateLimiter }, private fetchFn: typeof fetch = fetch,
    private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {}
  /**
   * All requests go through the limiter. A 429 waits for Retry-After and retries; a dropped connection, timeout or Riot 5xx is retried
   * a few times with a growing pause (these are common when many requests run in parallel) before giving up with a message that names
   * the cause. The key is only ever sent as a header, never logged.
   */
  private async get<T>(host: string, path: string, low = false): Promise<T> {
    let rateTries = 0, netTries = 0, serverTries = 0;
    for (;;) {
      const limiter = this.limiters.for(host);
      await limiter.acquire(low);
      let res: Response;
      try { res = await this.fetchFn(`https://${host}.api.riotgames.com${path}`, { headers: { "X-Riot-Token": this.key }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }); }
      catch (e) {
        if (netTries++ < NET_RETRIES) { await this.sleep(NET_BACKOFF_MS * 3 ** (netTries - 1)); continue; }
        throw new HttpError(502, `Could not reach Riot's servers (${networkCause(e)})`);
      }
      // Riot reports the key's real limits on every response: adopt them (with a 10% safety margin), so a production key runs faster than a personal one.
      const hdr = res.headers.get("x-app-rate-limit"), tuned = parseRateLimit(hdr);
      if (hdr && tuned && hdr !== limiter.lastHeader) { limiter.lastHeader = hdr; limiter.setWindows(tuned.map((w) => ({ limit: Math.max(1, Math.floor(w.limit * 0.9)), ms: w.ms }))); }
      if (res.status === 429 && rateTries++ < 2) { await this.sleep((Number(res.headers.get("retry-after") ?? 1) + 0.25) * 1000); continue; }
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) throw new HttpError(404, "Not found on Riot's servers");
      if (res.status === 401 || res.status === 403) throw new HttpError(502, "Riot rejected the API key (expired or invalid). Check RIOT_API_KEY in services/api/.env");
      if (res.status === 429) throw new HttpError(429, "Riot rate limit reached. Try again in a moment");
      if (res.status >= 500 && serverTries++ < SERVER_RETRIES) { await this.sleep(NET_BACKOFF_MS * 3 ** (serverTries - 1)); continue; }
      throw new HttpError(502, `Riot returned status ${res.status}`);
    }
  }
  account = (n: string, t: string, r: string) => this.get<{ puuid: string; gameName: string; tagLine: string }>(r, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(n)}/${encodeURIComponent(t)}`);
  summoner = (p: string, pf: string) => this.get<{ summonerLevel: number }>(pf, `/lol/summoner/v4/summoners/by-puuid/${p}`);
  league = (p: string, pf: string) => this.get<LeagueEntry[]>(pf, `/lol/league/v4/entries/by-puuid/${p}`).catch((e) => { if (e instanceof HttpError && e.status === 404) return []; throw e; });
  matchIds = (p: string, r: string, s: number, c: number, queue?: number, low = false) => this.get<string[]>(r, `/lol/match/v5/matches/by-puuid/${p}/ids?start=${s}&count=${c}${queue ? `&queue=${queue}` : ""}`, low);
  match = (id: string, r: string, low = false) => this.get<RiotMatch>(r, `/lol/match/v5/matches/${id}`, low);
  timeline = (id: string, r: string, low = false) => this.get<RiotTimeline>(r, `/lol/match/v5/matches/${id}/timeline`, low);
  ladder = (pf: string, tier: string, division: string, page: number, low = false) => this.get<LadderEntry[]>(pf, `/lol/league-exp/v4/entries/RANKED_SOLO_5x5/${tier}/${division}?page=${page}`, low);
  mastery = (p: string, pf: string, c: number) => this.get<RiotMastery[]>(pf, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${p}/top?count=${c}`);
  activeGame = (p: string, pf: string) => this.get<RiotActiveGame>(pf, `/lol/spectator/v5/active-games/by-summoner/${p}`);
}
