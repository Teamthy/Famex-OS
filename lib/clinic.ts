import { z } from "zod";
import { createRecord, deleteRecord, listRecords, updateRecord } from "@/lib/module-store";

const MODULE = "clinic_visits";

export const VisitSchema = z.object({
  personType: z.enum(["STUDENT", "STAFF"]),
  personId: z.string().min(1),
  personName: z.string().min(1),
  presentedAt: z.string().min(1),
  complaints: z.string().trim().min(1).max(1000),
  treatment: z.string().trim().max(1000).optional().nullable(),
  medicationGiven: z.string().trim().max(400).optional().nullable(),
  referredOut: z.boolean().default(false),
  parentNotified: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().nullable(),
  // Medical alerts (allergies, chronic conditions) for the student; updated
  // on the record so admin can carry over to a StudentProfile.medicalAlerts
  // field when a migration adds one.
  alertUpdated: z.string().trim().max(500).optional().nullable(),
});
export type Visit = z.infer<typeof VisitSchema>;

export const listVisits = (schoolId: string) => listRecords<Visit>(schoolId, MODULE);
export const recordVisit = (schoolId: string, data: unknown) => createRecord(schoolId, MODULE, VisitSchema, data);
export const updateVisit = (schoolId: string, id: string, patch: unknown) =>
  updateRecord(schoolId, MODULE, VisitSchema, id, patch);
export const removeVisit = (schoolId: string, id: string) => deleteRecord<Visit>(schoolId, MODULE, id);

const ALERT_MODULE = "clinic_alerts";
const AlertSchema = z.object({
  personType: z.enum(["STUDENT", "STAFF"]),
  personId: z.string().min(1),
  personName: z.string().min(1),
  condition: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type MedicalAlert = z.infer<typeof AlertSchema>;
export const listAlerts = (schoolId: string) => listRecords<MedicalAlert>(schoolId, ALERT_MODULE);
export const addAlert = (schoolId: string, data: unknown) => createRecord(schoolId, ALERT_MODULE, AlertSchema, data);
export const removeAlert = (schoolId: string, id: string) => deleteRecord<MedicalAlert>(schoolId, ALERT_MODULE, id);

export function clinicStats(visits: Array<{ data: Visit }>) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = visits.filter((v) => v.data.presentedAt.slice(0, 10) === todayIso).length;
  const referred = visits.filter((v) => v.data.referredOut).length;
  return { total: visits.length, today, referred };
}
