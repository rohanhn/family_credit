import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Kiểu DB chung cho production (postgres.js) và test (PGlite). Lớp domain chỉ nhận kiểu này. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Transaction lồng trong Db.transaction(...). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Hàm domain nhận được cả Db lẫn Tx. */
export type DbOrTx = Db | Tx;
