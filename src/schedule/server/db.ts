export interface Db {
  readonly driver: "bun:sqlite" | "node:sqlite";
  exec(sql: string): void;
  run(sql: string, ...params: unknown[]): { changes: number };
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined;
  /** Runs `work` in an immediate transaction; rolls back when it throws. */
  transaction<T>(work: () => T): T;
  close(): void;
}

type Migration = string;

/** Each entry upgrades the schema by one version (`PRAGMA user_version`). */
const MIGRATIONS: Migration[] = [
  `
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT NOT NULL,
    agent TEXT NOT NULL,
    model TEXT,
    timeout_minutes INTEGER NOT NULL DEFAULT 30,
    enabled INTEGER NOT NULL DEFAULT 1,
    archived_at INTEGER,
    prompt TEXT NOT NULL,
    cron TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE job_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    scheduled_for INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    status TEXT NOT NULL,
    reason TEXT,
    session_id TEXT
  );
  CREATE INDEX job_runs_slot ON job_runs (job_id, scheduled_for);
  `,
];

/** Opens (creating if needed) a SQLite database and brings it to the latest schema. */
export async function openDatabase(path: string): Promise<Db> {
  const db = await open(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const version = Number(db.get<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0);
  for (let next = version; next < MIGRATIONS.length; next++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[next]!);
      db.exec(`PRAGMA user_version = ${next + 1}`);
    });
  }
}

async function open(path: string): Promise<Db> {
  let native: any;
  let driver: Db["driver"];
  try {
    const { Database } = await import("bun:sqlite" as string);
    native = new Database(path);
    driver = "bun:sqlite";
  } catch {
    const { DatabaseSync } = await import("node:sqlite" as string);
    native = new DatabaseSync(path);
    driver = "node:sqlite";
  }
  const db: Db = {
    driver,
    exec: (sql) => void native.exec(sql),
    run: (sql, ...params) => {
      const result = native.prepare(sql).run(...params);
      return { changes: Number(result?.changes ?? 0) };
    },
    all: (sql, ...params) => native.prepare(sql).all(...params),
    get: (sql, ...params) => native.prepare(sql).get(...params) ?? undefined,
    transaction: (work) => {
      native.exec("BEGIN IMMEDIATE");
      try {
        const result = work();
        native.exec("COMMIT");
        return result;
      } catch (error) {
        native.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => native.close(),
  };
  return db;
}
