import {
	blob,
	int,
	numeric,
	real,
	sqliteTable,
	text,
} from "@rivetkit/db/drizzle";
import { sql } from "drizzle-orm";

export const usersTable = sqliteTable("users_table", {
	id: int().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	age: int().notNull(),
	email: text().notNull().unique(),
});

export const postsTable = sqliteTable("posts_table", {
	id: int().primaryKey({ autoIncrement: true }),
	title: text().notNull(),
	content: text().notNull(),
	userId: int()
		.notNull()
		.references(() => usersTable.id),
});

// table for all types that sqlite supports
export const allTypesTable = sqliteTable("all_types_table", {
	id: int().primaryKey({ autoIncrement: true }),
	text: text(),
	text_json: text({ mode: "json" }),
	text_enum: text({ enum: ["value1", "value2"] }),
	blob: blob(),
	blob_buffer: blob({ mode: "buffer" }),
	blob_bigint: blob({ mode: "bigint" }),
	blob_json: blob({ mode: "json" }),
	numeric: numeric(),
	numeric_number: numeric({ mode: "number" }),
	numeric_bigint: numeric({ mode: "bigint" }),
	real: real(),
	int: int(),
	int_number: int({ mode: "number" }),
	int_boolean: int({ mode: "boolean" }),
	int_timestamp_ms: int({ mode: "timestamp_ms" }),
	int_timestamp: int({ mode: "timestamp" }), // Date

	default_time: text().default(sql`(CURRENT_TIME)`),
	default_date: text().default(sql`(CURRENT_DATE)`),
	default_timestamp: text().default(sql`(CURRENT_TIMESTAMP)`),
	default_int: int().default(42),
	default_int_sql: int().default(sql`(abs(42))`),
	default_fn: int({ mode: "timestamp_ms" }).$defaultFn(() => new Date()),

	notnull_int: int().notNull(),

	always_null: text()
		.$type<string | null>()
		.$onUpdate(() => null),
});
