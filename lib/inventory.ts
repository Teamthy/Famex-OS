import { z } from "zod";
import { createRecord, deleteRecord, listRecords, updateRecord } from "@/lib/module-store";

const MODULE = "inventory_assets";

export const AssetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(60).optional().nullable(),
  code: z.string().trim().max(60).optional().nullable(),
  location: z.string().trim().max(80).optional().nullable(),
  assignedTo: z.string().trim().max(120).optional().nullable(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED", "DISPOSED"]).default("GOOD"),
  purchaseDate: z.string().optional().nullable(),
  valueNaira: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const listAssets = (schoolId: string) => listRecords<Asset>(schoolId, MODULE);
export const addAsset = (schoolId: string, data: unknown) => createRecord(schoolId, MODULE, AssetSchema, data);
export const updateAsset = (schoolId: string, id: string, patch: unknown) =>
  updateRecord(schoolId, MODULE, AssetSchema, id, patch);
export const removeAsset = (schoolId: string, id: string) => deleteRecord<Asset>(schoolId, MODULE, id);

const LOG_MODULE = "inventory_movements";
const MovementSchema = z.object({
  assetId: z.string().min(1),
  action: z.enum(["ASSIGN", "RETURN", "REPAIR", "DISPOSE", "AUDIT"]),
  note: z.string().trim().max(300).optional().nullable(),
  actorName: z.string().min(1),
});
export type Movement = z.infer<typeof MovementSchema>;
export const addMovement = (schoolId: string, data: unknown) =>
  createRecord(schoolId, LOG_MODULE, MovementSchema, data);
export const listMovements = (schoolId: string) => listRecords<Movement>(schoolId, LOG_MODULE);

export function assetStats(assets: Array<{ data: Asset }>) {
  const totalValue = assets.reduce((s, a) => s + (a.data.valueNaira || 0), 0);
  const byCondition = { GOOD: 0, FAIR: 0, DAMAGED: 0, DISPOSED: 0 } as Record<string, number>;
  for (const a of assets) byCondition[a.data.condition] = (byCondition[a.data.condition] || 0) + 1;
  return { total: assets.length, totalValue, byCondition };
}
