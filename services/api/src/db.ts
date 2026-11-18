import { DatabaseSync } from "./sqlite";

export const openDatabase = (path: string) => new DatabaseSync(path);
/** Tiny key-value cache on SQLite (built into Node, nothing to compile). */
export interface CacheRow { key: string; value: string; at: number }
export interface Cache {
  get(key: string): { value: string; at: number } | undefined; set(key: string, value: string, at: number): void;
  /** Newest entries whose key starts with `prefix` (plain text, no wildcards), newest first. Never calls Riot. */
  scan(prefix: string, limit: number): CacheRow[];
}
export function makeCache(db: DatabaseSync): Cache {
  db.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, fetched_at INTEGER NOT NULL)");
  const get = db.prepare("SELECT value, fetched_at AS at FROM kv WHERE key = ?"), put = db.prepare("INSERT OR REPLACE INTO kv (key, value, fetched_at) VALUES (?, ?, ?)"),
    scan = db.prepare("SELECT key, value, fetched_at AS at FROM kv WHERE substr(key, 1, ?) = ? ORDER BY fetched_at DESC LIMIT ?");
  return { get: (k) => get.get(k) as { value: string; at: number } | undefined, set: (k, v, at) => { put.run(k, v, at); },
    scan: (prefix, limit) => scan.all(prefix.length, prefix, Math.max(0, limit)) as unknown as CacheRow[] };
}
