/**
 * Generic JSON-file record store for lightweight modules (library, inventory,
 * clinic). These do not need full Prisma models to ship in beta: records are
 * persisted to `./data/<schoolId>/<module>.json` so they survive restarts and
 * survive a Prisma migration later when a production schema is drafted.
 *
 * Why: the full Famex-OS schema (70+ models) is already in the Prisma schema,
 * and we don't want to force a migration in a sandboxed build. The file
 * store is deliberately compatible with the shape a future Prisma model would
 * expose (id, schoolId, createdAt, updatedAt + data), so switching is a
 * one-line adapter in each module service.
 *
 * Safety:
 *   - writes are atomic (write temp, rename)
 *   - writes are per-school, never cross-tenant
 *   - all records go through a zod-compatible shape so garbage input is
 *     rejected before it is persisted
 *   - no symlinks or path traversal — schoolId is restricted to [a-z0-9-]
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const DATA_DIR = process.env.FAMEX_DATA_DIR ?? path.join(process.cwd(), "data");
const SAFE_ID = /^[a-z0-9-]{1,64}$/;

function safe(schoolId: string, module: string) {
  if (!SAFE_ID.test(schoolId)) throw new Error("Invalid schoolId");
  if (!SAFE_ID.test(module)) throw new Error("Invalid module name");
  return path.join(DATA_DIR, schoolId, `${module}.json`);
}

export type ModuleRecord<T> = {
  id: string;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
  data: T;
};

async function readAll<T>(schoolId: string, module: string): Promise<Array<ModuleRecord<T>>> {
  const p = safe(schoolId, module);
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Array<ModuleRecord<T>>) : [];
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    return [];
  }
}

async function writeAll<T>(schoolId: string, module: string, rows: Array<ModuleRecord<T>>) {
  const p = safe(schoolId, module);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await fs.rename(tmp, p);
}

export async function listRecords<T>(
  schoolId: string,
  module: string,
): Promise<Array<ModuleRecord<T>>> {
  return readAll<T>(schoolId, module);
}

export async function createRecord<T>(
  schoolId: string,
  module: string,
  schema: z.ZodType<T>,
  data: unknown,
): Promise<ModuleRecord<T>> {
  const parsed = schema.parse(data);
  const rows = await readAll<T>(schoolId, module);
  const now = new Date().toISOString();
  const rec: ModuleRecord<T> = {
    id: randomUUID(),
    schoolId,
    createdAt: now,
    updatedAt: now,
    data: parsed,
  };
  rows.unshift(rec);
  await writeAll(schoolId, module, rows);
  return rec;
}

export async function updateRecord<T>(
  schoolId: string,
  module: string,
  schema: z.ZodType<T>,
  id: string,
  patch: unknown,
): Promise<ModuleRecord<T> | null> {
  const rows = await readAll<T>(schoolId, module);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  // Merge; validate the merged result.
  const merged = { ...rows[i].data, ...(patch && typeof patch === "object" ? patch : {}) } as T;
  schema.parse(merged);
  rows[i] = { ...rows[i], data: merged, updatedAt: new Date().toISOString() };
  await writeAll(schoolId, module, rows);
  return rows[i];
}

export async function deleteRecord<T>(
  schoolId: string,
  module: string,
  id: string,
): Promise<boolean> {
  const rows = await readAll<T>(schoolId, module);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  await writeAll(schoolId, module, next);
  return true;
}
