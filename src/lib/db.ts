import fs from "node:fs";
import path from "node:path";

/**
 * データベース接続。
 *
 * 本番（Vercel など）は DATABASE_URL の PostgreSQL に繋ぐ。Supabase を想定。
 * DATABASE_URL が無いときは PGlite（PostgreSQL の WASM 版）を data/ の下に置いて使う。
 * どちらも本物の PostgreSQL なので、SQL は1種類だけ書けばよい。
 */

export type Executor = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** 複数文をまとめて流す（スキーマ定義用）。プレースホルダは使えない。 */
  exec(sql: string): Promise<void>;
};

const PGLITE_DIR = process.env.SEICHI_PGDATA ?? path.join(process.cwd(), "data", "pgdata");

/** 日時は文字列のまま受け取る（画面側で先頭10文字を切って日付として使うため）。 */
const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID = 1114;

type Driver = Executor & {
  transaction<T>(fn: (x: Executor) => Promise<T>): Promise<T>;
};

async function createPostgres(url: string): Promise<Driver> {
  const { Pool, types } = await import("pg");
  types.setTypeParser(TIMESTAMPTZ_OID, (v: string) => v);
  types.setTypeParser(TIMESTAMP_OID, (v: string) => v);

  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new Pool({
    connectionString: url,
    // サーバーレスでは1リクエスト1接続に近い。接続数を抑え、遊んでいる接続は早く返す。
    max: Number(process.env.PGPOOL_MAX ?? 1),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local || process.env.PGSSL === "off" ? undefined : { rejectUnauthorized: false },
  });

  return {
    async query(text, params) {
      const res = await pool.query(text, params as never[]);
      return res.rows;
    },
    async exec(sql) {
      // 引数なしの query は簡易プロトコルになり、複数文をまとめて流せる
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          async query(text, params) {
            const res = await client.query(text, params as never[]);
            return res.rows;
          },
          async exec(sql) {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(path.dirname(PGLITE_DIR), { recursive: true });
  const pg = new PGlite(PGLITE_DIR, {
    parsers: { [TIMESTAMPTZ_OID]: (v: string) => v, [TIMESTAMP_OID]: (v: string) => v },
  });
  await pg.waitReady;

  return {
    async query(text, params) {
      const res = await pg.query(text, params as unknown[]);
      return res.rows as never[];
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async transaction(fn) {
      return pg.transaction(async (t) => {
        return fn({
          async query(text, params) {
            const res = await t.query(text, params as unknown[]);
            return res.rows as never[];
          },
          async exec(sql) {
            await t.exec(sql);
          },
        });
      }) as Promise<never>;
    },
  };
}

declare global {
  var __seichiDb: Promise<Driver> | undefined;
}

function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  return url ? createPostgres(url) : createPglite();
}

/** 接続は1プロセスに1つだけ作る。 */
export function driver(): Promise<Driver> {
  return (globalThis.__seichiDb ??= connect());
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const db = await driver();
  return db.query<T>(text, params);
}

/** 1行だけ取る。無ければ undefined。 */
export async function one<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** 件数など、1つの数値だけ取る。 */
export async function count(text: string, params?: unknown[]): Promise<number> {
  const row = await one<{ n: string | number }>(text, params);
  return Number(row?.n ?? 0);
}

export async function exec(sql: string): Promise<void> {
  const db = await driver();
  await db.exec(sql);
}

export async function tx<T>(fn: (x: Executor) => Promise<T>): Promise<T> {
  const db = await driver();
  return db.transaction(fn);
}
