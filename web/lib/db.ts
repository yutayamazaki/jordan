import Database from "better-sqlite3";
import path from "path";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(process.cwd(), "../data/jordan.sqlite");

  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");

  return dbInstance;
}

