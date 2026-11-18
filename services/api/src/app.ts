import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ChampionPatches, PatchPoint, PatchTrends, PatchTrendRow, ChampionBuild, ChampionDetail, ChampionRelations, RelationLine, ChampionList, FilterOptions, LiveResult, PostGameRecap, PoolEntry, ChampionSummary, MatchPage, RankHistory, Role, StatLine, Summoner } from "@apex/schema";
import type { Cache } from "./db";
import type { DD } from "./ddragon";
import type { Collector } from "./collector";
import type { Store } from "./store";
import { toLiveGame, toRecap, toMastery, toMatchDetail, toMatchSummary, toSummoner, perGame, roleOf, type PerGame } from "./mapping";
import { HttpError, PLATFORM_IDS, regionOf, type LeagueEntry, type RiotActiveGame, type RiotApi, type RiotMatch } from "./riot";
import { TIERS } from "./collector";
import { computeBuild, isFinished, itemWpas } from "./build";
import { canonicalChampionId } from "./champions";
import { ACCOUNT_PREFIX, searchStoredPlayers, type StoredPlayer } from "./players";
import type { Filter } from "./store";
import { isQueueFilter, matchesQueueFilter, riotQueueOf, type MatchSummary } from "@apex/schema";

export interface Deps { riot: RiotApi; cache: Cache; dd: () => Promise<DD>; store: Store; collector: Collector; defaultPlatform: string; hasKey?: boolean; now?: () => number }
const MIN = 60_000, DAY = 24 * 60 * MIN;
/** Raw match ids read per page and at most per request when the queue filter cannot be done by Riot (Arena). */
const QUEUE_SCAN_PAGE = 20, QUEUE_SCAN_MAX = 40;

export async function buildApp(deps: Deps) {
  const { riot, cache, store, collector } = deps,
    dd = async () => { try { return await deps.dd(); } catch { throw new HttpError(502, "Could not load game data from Riot's Data Dragon (offline?)"); } }, now = deps.now ?? (() => Date.now());
  const app = Fastify({ logger: false });
  // Only the app itself (browser dev server or the Tauri window) may call this service.
  await app.register(cors, { origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^(https?|tauri):\/\/tauri\.localhost$/, "tauri://localhost"] });

  async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttl) return JSON.parse(hit.value) as T;
    const value = await fn(); cache.set(key, JSON.stringify(value), now()); return value;
  }
  /**
   * Cache for the endpoints that scan the whole participants table (patch history and patch trends). 10 minutes, like /v1/draft/data (the
   * collector adds games all the time, so a number is at most 10 minutes old). The key carries the kept patches, so a new patch (or the
   * removal of the oldest one) never serves an answer built for the old window.
   */
  const cachedScan = <T,>(key: string, fn: () => Promise<T>) => cached<T>(`${key}|${store.recentPatches().join(",")}`, 10 * MIN, fn);
  const REGIONS = ["europe", "americas", "asia", "sea"];
  function parseRiotId(raw: string): [string, string] {
    const i = raw.lastIndexOf("#");
    if (i < 1 || i === raw.length - 1) throw new HttpError(400, "Riot ID must look like Name#TAG");
    return [raw.slice(0, i), raw.slice(i + 1)];
  }
  /** Resolves a Riot ID to a puuid. Riot IDs are global, so no region is needed (cached for a day). */
  async function identity(raw: string) {
    const [name, tag] = parseRiotId(raw);
    return cached(`acct:${name.toLowerCase()}#${tag.toLowerCase()}`, DAY, () => riot.account(name, tag, regionOf(deps.defaultPlatform)));
  }
  /**
   * Finds which region a player plays on, so searches need no region. Match ids start with the platform ("EUW1_..."), so
   * asking each regional cluster for one recent match is enough (1 to 4 requests). Players without recent matches fall back
   * to asking each platform for their summoner. Cached for a week.
   */
  async function homePlatform(puuid: string): Promise<string> {
    return cached(`home:${puuid}`, 7 * DAY, async () => {
      const first = regionOf(deps.defaultPlatform);
      for (const region of [first, ...REGIONS.filter((r) => r !== first)]) {
        const [id] = await riot.matchIds(puuid, region, 0, 1);
        const platform = id?.split("_")[0]?.toLowerCase();
        if (platform && PLATFORM_IDS.includes(platform)) return platform;
      }
      for (const platform of [deps.defaultPlatform, ...PLATFORM_IDS.filter((p) => p !== deps.defaultPlatform)]) {
        try { await riot.summoner(puuid, platform); return platform; } catch (e) { if (!(e instanceof HttpError && e.status === 404)) throw e; }
      }
      throw new HttpError(404, "Could not find this player in any region");
    });
  }
  const matchOf = (id: string, region: string) => cached<RiotMatch>(`match:${id}`, Infinity, () => riot.match(id, region)); // matches never change

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    console.error("Unexpected error:", err instanceof Error ? err.message : err);
    return reply.code(500).send({ error: "Unexpected server error" });
  });

  // Old links and clients may still use Riot's spelling of a champion id ("FiddleSticks"): every /v1/champions/:id route sees the Data Dragon one.
  app.addHook("preHandler", async (req) => { const p = req.params as { id?: string } | undefined; if (p?.id && req.url.startsWith("/v1/champions/")) p.id = canonicalChampionId(p.id); });

  app.get("/health", async () => ({ ok: true, hasKey: deps.hasKey ?? true }));

  /** Profile (level + Ranked Solo rank), cached 5 minutes. Every fresh lookup also records a rank snapshot for the LP history. */
  const profileOf = (acct: { puuid: string; gameName: string; tagLine: string }, platform: string, fresh = false) => cached<Summoner>(`profile:${platform}:${acct.puuid}`, fresh ? 0 : 5 * MIN, async () => {
    const [s, entries] = await Promise.all([riot.summoner(acct.puuid, platform), riot.league(acct.puuid, platform)]);
    const out = { ...toSummoner(`${acct.gameName}#${acct.tagLine}`, s.summonerLevel, entries), platform };
    if (out.rank) store.saveRankSnapshot(acct.puuid, out.rank, now());
    return out;
  });
  /** Players this backend has already looked up, filtered by name (`?q=`, at least 2 characters). Local data only, no Riot call: it feeds the app's search palette. */
  app.get<{ Querystring: { q?: string; limit?: string } }>("/v1/players", async (req): Promise<StoredPlayer[]> => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
    return searchStoredPlayers(cache.scan(ACCOUNT_PREFIX, 500), req.query.q ?? "", limit);
  });
  app.get<{ Params: { riotId: string } }>("/v1/players/:riotId", async (req) => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid);
    return profileOf(acct, platform);
  });
  /** LP history: the rank snapshots Apex has recorded. Opening it also takes a fresh snapshot (`?fresh=1` even when the profile was looked up minutes ago), but Riot being down must not hide what is already stored. */
  app.get<{ Params: { riotId: string }; Querystring: { fresh?: string } }>("/v1/players/:riotId/lp-history", async (req): Promise<RankHistory> => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid);
    await profileOf(acct, platform, req.query.fresh === "1").catch(() => undefined); // fresh=1: skip the 5 minute profile cache (used right after a game ends)
    return { snapshots: store.rankHistory(acct.puuid).map((r) => ({ at: new Date(r.at).toISOString(), rank: { tier: r.tier as never, division: r.division as never, lp: r.lp, wins: r.wins, losses: r.losses } })) };
  });

  /**
   * Match history, optionally for one queue group (`?queue=solo|flex|normal|blind|aram|arena|other`, default all).
   * Groups with one queue id are filtered by Riot (exact paging). Arena has no single id, so ids are read unfiltered and each match is checked
   * after it is loaded (matches are cached forever): at most `QUEUE_SCAN_MAX` ids per request, so a rarely played mode returns a short page with a
   * cursor to continue instead of hammering Riot. `nextCursor` always counts RAW ids, so "load more" works the same for every filter.
   */
  app.get<{ Params: { riotId: string }; Querystring: { cursor?: string; limit?: string; queue?: string } }>("/v1/players/:riotId/matches", async (req): Promise<MatchPage> => {
    const filter = req.query.queue ?? "all"; if (!isQueueFilter(filter)) throw new HttpError(400, "Unknown queue filter");
    const acct = await identity(req.params.riotId), region = regionOf(await homePlatform(acct.puuid));
    const cursor = Math.max(0, Number(req.query.cursor ?? 0) || 0), limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 10) || 10));
    const riotQueue = riotQueueOf(filter), summaries = async (ids: string[]) => (await Promise.all(ids.map(async (id) => { const m = await matchOf(id, region); return { m, s: toMatchSummary(m, acct.puuid) }; })));
    if (filter === "all" || riotQueue !== undefined) {
      const ids = await cached<string[]>(`ids:${acct.puuid}:${filter}:${cursor}:${limit}`, 2 * MIN, () => riot.matchIds(acct.puuid, region, cursor, limit, riotQueue));
      const items = (await summaries(ids)).filter((x) => x.s && (filter !== "all" || matchesQueueFilter("all", x.m.info.queueId))).map((x) => x.s as MatchSummary);   // allow-list: games outside the named queues are never shown
      return { items, nextCursor: ids.length === limit ? cursor + limit : null };
    }
    const items: MatchSummary[] = []; let at = cursor, more = true;
    while (more && items.length < limit && at - cursor < QUEUE_SCAN_MAX) {
      const from = at, ids = await cached<string[]>(`ids:${acct.puuid}:all:${from}:${QUEUE_SCAN_PAGE}`, 2 * MIN, () => riot.matchIds(acct.puuid, region, from, QUEUE_SCAN_PAGE));
      for (const { m, s } of await summaries(ids)) if (s && matchesQueueFilter(filter, m.info.queueId)) items.push(s);
      at += ids.length; more = ids.length === QUEUE_SCAN_PAGE;
    }
    return { items, nextCursor: more ? at : null };
  });

  app.get<{ Params: { id: string }; Querystring: { riotId?: string } }>("/v1/matches/:id", async (req) => {
    const prefix = req.params.id.split("_")[0]?.toLowerCase() ?? "";
    if (!PLATFORM_IDS.includes(prefix)) throw new HttpError(400, "Unknown match id");
    const match = await matchOf(req.params.id, regionOf(prefix));
    const puuid = req.query.riotId ? (await identity(req.query.riotId)).puuid : undefined;
    return toMatchDetail(match, puuid);
  });

  app.get<{ Params: { riotId: string } }>("/v1/players/:riotId/mastery", async (req) => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid);
    const list = await cached(`mastery:${platform}:${acct.puuid}`, 10 * MIN, () => riot.mastery(acct.puuid, platform, 8));
    return toMastery(list, (await dd()).champs);
  });

  // ---- Champion statistics, computed from the games the collector has stored ----
  const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  /**
   * patch: latest (default) | all | 26.22. "all" means the last 5 patches, the only ones Apex keeps. region: all | euw1 ... rank: all | EMERALD.
   * A rank always means that tier AND ABOVE ("EMERALD+" is accepted too). `label` is what the response reports as its patch ("all" or one patch).
   */
  function filterOf(q: { patch?: string; region?: string; rank?: string }): Filter & { label: string } {
    const recent = store.recentPatches();
    const patches = q.patch === "all" ? recent : q.patch && q.patch !== "latest" ? [q.patch] : recent.slice(0, 1);
    const label = q.patch === "all" ? "all" : q.patch && q.patch !== "latest" ? q.patch : recent[0] ?? "all";
    const platform = q.region && q.region !== "all" ? q.region.toLowerCase() : undefined;
    let brackets: string[] | undefined;
    if (q.rank && q.rank !== "all") {
      const tier = q.rank.replace("+", "").toUpperCase(), i = TIERS.indexOf(tier);
      if (i < 0) throw new HttpError(400, `Unknown rank "${q.rank}"`);
      brackets = TIERS.slice(i); // Emerald means Emerald IV and everything above it
    }
    return { patches, platform, brackets, label };
  }
  const roleOfQuery = (r?: string) => (r && ROLES.includes(r) ? (r as Role) : undefined);

  /** A role counts for a champion when it holds at least 10% of the champion's games (and 2 games). */
  const isRealRole = (roleGames: number, champGames: number) => roleGames >= Math.max(2, champGames * 0.1);

  async function summaries(f: ReturnType<typeof filterOf>, role?: Role): Promise<{ list: ChampionSummary[]; total: number }> {
    const { champs } = await dd(), byId = new Map([...champs].map(([key, c]) => [c.id, { key, ...c }])), bans = new Map(store.bans(f).map((b) => [b.k, b.n]));
    // Always read every role, so a champion's share in each role is known. Asking for one role then keeps only champions that really play it:
    // a champion with a handful of games in a role it is not played in (an off-role pick, a role-detection miss) is not shown there.
    const per = new Map<string, { games: number; wins: number; byRole: Map<Role, { games: number; wins: number }> }>();
    for (const r of store.championRows(f)) {
      const e = per.get(r.champion) ?? { games: 0, wins: 0, byRole: new Map() };
      e.games += r.games; e.wins += r.wins;
      if (r.role) { const x = e.byRole.get(r.role as Role) ?? { games: 0, wins: 0 }; x.games += r.games; x.wins += r.wins; e.byRole.set(r.role as Role, x); }
      per.set(r.champion, e);
    }
    const list = [...per].flatMap(([id, e]) => {
      const c = byId.get(id); if (!c) return [];
      const roles = [...e.byRole].filter(([, x]) => isRealRole(x.games, e.games)).sort((a, b) => b[1].games - a[1].games);
      const mine = role ? e.byRole.get(role) : undefined;
      if (role && (!mine || !isRealRole(mine.games, e.games))) return [];
      return [{ id, name: c.name, tags: c.tags ?? [], games: mine?.games ?? e.games, wins: mine?.wins ?? e.wins, bans: bans.get(c.key) ?? 0, roles: roles.map(([r]) => r) }];
    });
    return { list, total: store.matchCount(f) };
  }

  app.get<{ Querystring: { role?: string; patch?: string; region?: string; rank?: string } }>("/v1/champions", async (req): Promise<ChampionList> => {
    const f = filterOf(req.query), { list, total } = await summaries(f, roleOfQuery(req.query.role));
    return { patch: f.label, totalGames: total, champions: list };
  });

  app.get<{ Params: { id: string }; Querystring: { patch?: string; region?: string; rank?: string } }>("/v1/champions/:id", async (req): Promise<ChampionDetail> => {
    const f = filterOf(req.query), { list, total } = await summaries(f), me = list.find((c) => c.id === req.params.id);
    if (!me) throw new HttpError(404, "No collected games for this champion with these filters");
    const data = await dd(), line = (name: string, r: { games: number; wins: number }, id?: number | string): StatLine => ({ name, games: r.games, wins: r.wins, ...(id !== undefined ? { id } : {}) });
    const nameOf = (id: string) => [...data.champs.values()].find((c) => c.id === id)?.name ?? id;
    const completed = store.items(req.params.id, f).filter((i) => isFinished(data.items.get(i.id))); // finished items only: the one shared rule, which also counts the five support upgrades
    const wpas = itemWpas(store.buildRows(req.params.id, f), data.items);   // Win Probability Added per item (all roles of this champion)
    return { ...me, totalGames: total,
      builds: completed.slice(0, 6).map((i) => ({ ...line(data.items.get(i.id)!.name, i, i.id), ...(wpas.has(i.id) ? { wpa: wpas.get(i.id) } : {}) })),
      runes: store.keystones(req.params.id, f).map((k) => line(data.runes.get(k.id) ?? `Rune ${k.id}`, k, k.id)),
      matchups: store.matchups(req.params.id, f).map((m) => line(nameOf(m.name), m, m.name)) };
  });

  /**
   * Lane matchups and teammate synergies of a champion in one role (default: its busiest role), each with the other champion's own
   * games in its role, so the client can compare the pairing with what the two win rates predict. Empty lists = no collected games.
   */
  app.get<{ Params: { id: string }; Querystring: { role?: string; patch?: string; region?: string; rank?: string } }>("/v1/champions/:id/relations", async (req): Promise<ChampionRelations> => {
    const f = filterOf(req.query), data = await dd(), rows = store.championRows(f), champion = req.params.id;
    const base = new Map(rows.filter((r) => r.role).map((r) => [`${r.champion}|${r.role}`, { games: r.games, wins: r.wins }]));
    const mine = rows.filter((r) => r.champion === champion && r.role).sort((a, b) => b.games - a.games);
    const role = roleOfQuery(req.query.role) ?? (mine[0]?.role as Role | undefined);
    const own = role ? base.get(`${champion}|${role}`) : undefined;
    if (!role || !own) return { champion, role: role ?? null, base: { games: 0, wins: 0 }, matchups: [], synergies: [] };
    const nameOf = (id: string) => [...data.champs.values()].find((c) => c.id === id)?.name ?? id;
    const line = (r: { champion: string; role: string; games: number; wins: number }): RelationLine => { const b = base.get(`${r.champion}|${r.role}`) ?? { games: r.games, wins: 0 };
      return { champion: r.champion, name: nameOf(r.champion), role: r.role as Role, games: r.games, wins: r.wins, baseGames: b.games, baseWins: b.wins }; };
    const rel = store.relations(champion, role, f);
    return { champion, role, base: own, matchups: rel.matchups.map(line), synergies: rel.synergies.map(line) };
  });

  /** Patch comparisons always span every kept patch (newest first): the patch filter is ignored, region and rank still apply. */
  const patchScope = (q: { region?: string; rank?: string }) => filterOf({ region: q.region, rank: q.rank, patch: "all" });

  /**
   * One champion across the kept patches (newest first): its games and wins in one role (default: its busiest), its bans and the size of each
   * patch. The client turns neighbouring patches into changes with `patchDelta` (stats-core), so this only reports counts.
   */
  app.get<{ Params: { id: string }; Querystring: { role?: string; region?: string; rank?: string } }>("/v1/champions/:id/patches", async (req): Promise<ChampionPatches> => cachedScan(`patches:${req.params.id}:${JSON.stringify(req.query)}`, async () => {
    const f = patchScope(req.query), data = await dd(), champion = req.params.id, key = [...data.champs].find(([, c]) => c.id === champion)?.[0];
    const rows = store.championRowsByPatch(f, champion), perRole = new Map<string, number>();
    for (const r of rows) if (r.role) perRole.set(r.role, (perRole.get(r.role) ?? 0) + r.games);
    const role = roleOfQuery(req.query.role) ?? ([...perRole].sort((a, b) => b[1] - a[1])[0]?.[0] as Role | undefined);
    if (!role) return { champion, role: null, patches: [] };
    const matches = store.matchesByPatch(f), bans = store.bansByPatch(f);
    const patches = (f.patches ?? []).map((patch): PatchPoint => { const r = rows.find((x) => x.patch === patch && x.role === role);
      return { patch, games: r?.games ?? 0, wins: r?.wins ?? 0, bans: key !== undefined ? bans.get(`${patch}|${key}`) ?? 0 : 0, matches: matches.get(patch) ?? 0 }; });
    return { champion, role, patches };
  }));

  /**
   * The newest patch next to the one before it, for every champion that really plays `role` (same 10% rule as the tier list). Needs data in two
   * patches; otherwise `previous` is null and `rows` is empty. Counts only: the client computes the changes with `patchDelta` (stats-core).
   */
  app.get<{ Querystring: { role?: string; region?: string; rank?: string } }>("/v1/patch-trends", async (req): Promise<PatchTrends> => {
    const role = roleOfQuery(req.query.role);
    if (!role) throw new HttpError(400, "role is required (TOP, JUNGLE, MID, ADC or SUPPORT)");
    return cachedScan(`trends:${JSON.stringify(req.query)}`, () => patchTrends(role, req.query));
  });
  async function patchTrends(role: Role, query: { region?: string; rank?: string }): Promise<PatchTrends> {
    const f = patchScope(query), [patch, previous] = f.patches ?? [];
    if (!patch || !previous) return { patch: patch ?? null, previous: null, role, rows: [] };
    const data = await dd(), matches = store.matchesByPatch(f), bans = store.bansByPatch(f), byId = new Map([...data.champs].map(([key, c]) => [c.id, { key, name: c.name }]));
    type Acc = { all: number; role: Record<string, { games: number; wins: number }> };
    const per = new Map<string, Acc>();
    for (const r of store.championRowsByPatch(f)) {
      if (r.patch !== patch && r.patch !== previous) continue;
      const e = per.get(r.champion) ?? { all: 0, role: {} }; e.all += r.games;
      if (r.role === role) e.role[r.patch] = { games: r.games, wins: r.wins };
      per.set(r.champion, e);
    }
    const point = (id: string, p: string, e: Acc): PatchPoint => ({ patch: p, games: e.role[p]?.games ?? 0, wins: e.role[p]?.wins ?? 0, bans: bans.get(`${p}|${byId.get(id)!.key}`) ?? 0, matches: matches.get(p) ?? 0 });
    const rows = [...per].flatMap(([id, e]): PatchTrendRow[] => {
      const c = byId.get(id), inRole = (e.role[patch]?.games ?? 0) + (e.role[previous]?.games ?? 0);
      if (!c || !isRealRole(inRole, e.all)) return [];
      return [{ id, name: c.name, cur: point(id, patch, e), prev: point(id, previous, e) }];
    }).sort((a, b) => a.id.localeCompare(b.id));
    return { patch, previous, role, rows };
  }

  /** Rune pages, summoner spells and final items of collected games for one champion. role is optional; an empty result means no collected games with these filters. */
  app.get<{ Params: { id: string }; Querystring: { role?: string; patch?: string; region?: string; rank?: string } }>("/v1/champions/:id/build", async (req): Promise<ChampionBuild> => {
    const f = filterOf(req.query), role = roleOfQuery(req.query.role), data = await dd();
    return computeBuild(req.params.id, role ?? null, store.buildRows(req.params.id, f, role), data.items);
  });

  /** Every region and rank is always offered (counts may be zero while the collector fills in). Ranks are cumulative: Emerald = Emerald and above. */
  /** Counts follow the active filters (patch, region, rank as on every stats route): each menu shows the games its options would give with the other two filters applied. */
  app.get<{ Querystring: { patch?: string; region?: string; rank?: string } }>("/v1/filters", async (req): Promise<FilterOptions> => {
    const f = store.facets(filterOf(req.query)), count = (list: { id: string; matches: number }[], id: string) => list.find((x) => x.id === id)?.matches ?? 0;
    return { platforms: PLATFORM_IDS.map((id) => ({ id, matches: count(f.platforms, id) })), patches: f.patches,
      ranks: TIERS.map((id, i) => ({ id, matches: TIERS.slice(i).reduce((s, t) => s + count(f.ranks, t), 0) })) };
  });
  app.get<{ Querystring: { patch?: string; region?: string; rank?: string } }>("/v1/draft/data", async (req) => {
    const f = filterOf(req.query);
    return cached(`draft:${JSON.stringify(f)}`, 10 * MIN, async () => ({ ...store.draftStats(f), patch: f.label }));
  });
  /** Your own recent champion pool (last 20 games, split by role) plus your top 30 mastery champions, for personalised draft suggestions. */
  app.get<{ Params: { riotId: string } }>("/v1/players/:riotId/pool", async (req): Promise<PoolEntry[]> => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid), region = regionOf(platform), data = await dd();
    const ids = await cached<string[]>(`ids:${acct.puuid}:0:20`, 2 * MIN, () => riot.matchIds(acct.puuid, region, 0, 20));
    const pool = new Map<string, PoolEntry>();
    for (const id of ids) {
      const s = toMatchSummary(await matchOf(id, region), acct.puuid); if (!s) continue;
      const e = pool.get(s.champion) ?? { champion: s.champion, games: 0, wins: 0, points: 0 }; e.games++; if (s.win) e.wins++; pool.set(s.champion, e);
      if (s.role) { // the same games split by role, so the draft can leave out champions you only play elsewhere
        const byRole = (e.byRole ??= []), r = byRole.find((x) => x.role === s.role) ?? (byRole[byRole.push({ role: s.role, games: 0, wins: 0 }) - 1]); r.games++; if (s.win) r.wins++;
      }
    }
    for (const m of toMastery(await cached(`mastery30:${platform}:${acct.puuid}`, 10 * MIN, () => riot.mastery(acct.puuid, platform, 30)), data.champs)) {
      const e = pool.get(m.champion) ?? { champion: m.champion, games: 0, wins: 0, points: 0 }; e.points = m.points; pool.set(m.champion, e);
    }
    return [...pool.values()].sort((x, y) => y.games - x.games || y.points - x.points);
  });



  // ---- Post-game recap: one finished game vs collected averages, your own recent games, and the lobby ----
  const MIN_BASELINE = 30; // fewer collected games than this is too noisy to compare against
  const tierLabel = (t: string) => t[0] + t.slice(1).toLowerCase(), roleLabel = (r: string) => (r === "ADC" ? "ADC" : r[0] + r.slice(1).toLowerCase());
  app.get<{ Params: { riotId: string }; Querystring: { matchId?: string } }>("/v1/players/:riotId/recap", async (req): Promise<PostGameRecap> => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid), region = regionOf(platform);
    const ids = await cached<string[]>(`ids:${acct.puuid}:0:20`, 2 * MIN, () => riot.matchIds(acct.puuid, region, 0, 20));
    const matchId = req.query.matchId ?? ids[0];
    if (!matchId) throw new HttpError(404, "No games found for this player");
    if (!PLATFORM_IDS.includes(matchId.split("_")[0]?.toLowerCase() ?? "")) throw new HttpError(400, "Unknown match id");
    const match = await matchOf(matchId, regionOf(matchId.split("_")[0]!.toLowerCase())), me = match.info.participants.find((p) => p.puuid === acct.puuid);
    if (!me) throw new HttpError(404, "This player was not in that match");
    const data = await dd(), names = new Map([...data.champs.values()].map((c) => [c.id, c.name])), role = roleOf(me.teamPosition);
    // Baseline: the most specific group of collected Ranked Solo games with enough data (same champion + role + rank, then looser).
    let baseline: { label: string; avg: PerGame; games: number } | null = null;
    if (role) {
      const tier = (await cached(`league:${platform}:${acct.puuid}`, 10 * MIN, () => riot.league(acct.puuid, platform)).catch(() => [])).find((e) => e.queueType === "RANKED_SOLO_5x5")?.tier;
      const myChamp = canonicalChampionId(me.championName), champ = names.get(myChamp) ?? myChamp;
      const tries = [...(tier ? [{ champion: myChamp, bracket: tier, label: `${tierLabel(tier)} ${champ} ${roleLabel(role)}` }] : []), { champion: myChamp, bracket: undefined, label: `${champ} ${roleLabel(role)}, all ranks` },
        ...(tier ? [{ champion: undefined, bracket: tier, label: `${tierLabel(tier)} ${roleLabel(role)}` }] : []), { champion: undefined, bracket: undefined, label: `${roleLabel(role)}, all ranks` }];
      for (const t of tries) {
        const a = store.averages({ role, champion: t.champion, bracket: t.bracket });
        if (a.games >= MIN_BASELINE) { baseline = { label: `${t.label} (Ranked Solo)`, avg: a, games: a.games }; break; }
      }
    }
    // Your other recent games in the same role (cached matches are free; the first lookup may fetch a few).
    const others = ids.filter((id) => id !== matchId).slice(0, 10), personal: PerGame[] = [];
    for (const id of others) {
      const m = await matchOf(id, region).catch(() => null), p = m?.info.participants.find((x) => x.puuid === acct.puuid);
      if (m && p && roleOf(p.teamPosition) === role && role) personal.push(perGame(p, m.info.gameDuration));
    }
    return toRecap(match, acct.puuid, { names, baseline, personal });
  });

  // ---- Live game scouting (Spectator-v5). Uses only what the loading screen shows, plus public rank data. ----
  app.get<{ Params: { riotId: string } }>("/v1/live/:riotId", async (req): Promise<LiveResult> => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid);
    // 45 s cache: the same lookup (and the app's 30 s refresh) never spends more than one Spectator call, and the ten rank lookups are reused.
    return cached<LiveResult>(`live:${platform}:${acct.puuid}`, 45_000, async () => {
      let game: RiotActiveGame;
      try { game = await riot.activeGame(acct.puuid, platform); }
      catch (e) { if (e instanceof HttpError && e.status === 404) return { inGame: false }; throw e; }
      const data = await dd(), entries = new Map<string, LeagueEntry[]>();
      // A failed rank lookup for one player must not break the whole screen: that player just shows no rank.
      await Promise.all(game.participants.flatMap((p) => (p.puuid && !p.bot ? [p.puuid] : [])).map(async (puuid) => {
        entries.set(puuid, await cached(`league:${platform}:${puuid}`, 10 * MIN, () => riot.league(puuid, platform)).catch(() => []));
      }));
      const pop = new Map<string, { games: number; wins: number }>();
      for (const r of store.championRows({ patches: store.recentPatches(1) })) { const e = pop.get(r.champion) ?? { games: 0, wins: 0 }; e.games += r.games; e.wins += r.wins; pop.set(r.champion, e); }
      return toLiveGame(game, { youPuuid: acct.puuid, champs: data.champs, entries, pop });
    });
  });

  // ---- Collector control (POSTs need a custom header, so other websites cannot trigger them from your browser) ----
  const guard = (req: { headers: Record<string, unknown> }) => { if (req.headers["x-apex"] !== "1") throw new HttpError(403, "Missing X-Apex header"); };
  // A failed request is retried and usually a blip, so only a recent error (or a fatal one such as a bad key) is shown. An old one would stay on screen forever.
  const collectorStatus = () => ({ ...collector.status, lastError: collector.status.lastError && (collector.status.fatal || now() - collector.status.lastErrorAt < 3 * MIN) ? collector.status.lastError : null, ...store.counts(), latestPatch: store.latestPatch() ?? null, ladders: collector.progress(), workers: collector.cfg.concurrency });
  app.get("/v1/collector", async () => collectorStatus());
  app.post("/v1/collector/start", async (req) => { guard(req); collector.start(); return collectorStatus(); });
  app.post("/v1/collector/stop", async (req) => { guard(req); await collector.halt(); return collectorStatus(); });
  return app;
}
