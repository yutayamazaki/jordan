import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "path";

import * as schema from "./schema";

let dbInstance: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(process.cwd(), "../data/jordan.sqlite");

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  dbInstance = drizzle(sqlite, { schema });

  return dbInstance;
}
