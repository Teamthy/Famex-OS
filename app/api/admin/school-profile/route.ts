import { Prisma, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, jsonNoStore } from "@/lib/requests";
import { confirmedSchoolAddress } from "@/lib/school-address";
import { requireRole } from "@/lib/session";
import {
  clampRadiusM,
  DEFAULT_RADIUS_M,
  isValidPoint,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
} from "@/lib/geofence";
import { decimalToNumber } from "@/lib/geofence";

export const dynamic = "force-dynamic";

/** Only people who speak for the school can change its address. Teachers and bursars cannot. */
const EDIT_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR];

const updateSchema = z.object({
  address: z
    .string()
    .trim()
    .max(300, "Keep the address under 300 characters.")
    .refine((value) => !/[<>]/.test(value), "The address cannot contain < or > characters.")
    .optional(),
  geoLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  geoLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  geoRadiusM: z.coerce
    .number()
    .int()
    .min(MIN_RADIUS_M)
    .max(MAX_RADIUS_M)
    .nullable()
    .optional(),
  geoEnabled: z.coerce.boolean().optional(),
});

export async function GET() {
  const user = await requireRole(EDIT_ROLES);
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: {
      name: true,
      address: true,
      geoLatitude: true,
      geoLongitude: true,
      geoRadiusM: true,
      geoEnabled: true,
    },
  });
  if (!school) return jsonNoStore({ error: "School not found." }, { status: 404 });

  const lat = decimalToNumber(school.geoLatitude);
  const lng = decimalToNumber(school.geoLongitude);

  return jsonNoStore({
    name: school.name,
    address: school.address,
    addressConfirmed: confirmedSchoolAddress(school.address) !== null,
    geo: {
      enabled: school.geoEnabled,
      latitude: lat,
      longitude: lng,
      radiusM: school.geoRadiusM ?? DEFAULT_RADIUS_M,
      configured: isValidPoint({ latitude: lat, longitude: lng }),
      minRadiusM: MIN_RADIUS_M,
      maxRadiusM: MAX_RADIUS_M,
      defaultRadiusM: DEFAULT_RADIUS_M,
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await requireRole(EDIT_ROLES);
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Please check the form and try again.";
    return jsonNoStore(
      { error: message || "Please check the form and try again." },
      { status: 422 },
    );
  }

  const data: Prisma.SchoolUpdateInput = {};

  // Address update (optional — may come alone or with geo)
  if (typeof payload.address === "string") {
    data.address = confirmedSchoolAddress(payload.address) ?? "";
  }

  // Geo update — treat null lat/lng as "clear fence"; otherwise validate pair
  const latPresent = payload.geoLatitude !== undefined;
  const lngPresent = payload.geoLongitude !== undefined;
  const radiusPresent = payload.geoRadiusM !== undefined;
  const enabledPresent = payload.geoEnabled !== undefined;

  if (latPresent || lngPresent || radiusPresent || enabledPresent) {
    const current = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { geoLatitude: true, geoLongitude: true, geoRadiusM: true, geoEnabled: true },
    });
    const curLat = decimalToNumber(current?.geoLatitude);
    const curLng = decimalToNumber(current?.geoLongitude);

    let nextLat = latPresent ? payload.geoLatitude : curLat;
    let nextLng = lngPresent ? payload.geoLongitude : curLng;
    let nextRadius = radiusPresent
      ? payload.geoRadiusM
      : current?.geoRadiusM ?? DEFAULT_RADIUS_M;
    let nextEnabled = enabledPresent ? payload.geoEnabled : current?.geoEnabled ?? false;

    if (nextLat === null || nextLng === null) {
      // Clearing the fence → disable GPS clock-in
      Object.assign(data, {
        geoLatitude: null,
        geoLongitude: null,
        geoRadiusM: null,
        geoEnabled: false,
      });
    } else {
      if (!isValidPoint({ latitude: nextLat, longitude: nextLng })) {
        return jsonNoStore(
          { error: "Please set both a valid latitude and longitude for the school." },
          { status: 422 },
        );
      }
      data.geoLatitude = new Prisma.Decimal((nextLat as number).toFixed(6));
      data.geoLongitude = new Prisma.Decimal((nextLng as number).toFixed(6));
      data.geoRadiusM = clampRadiusM(nextRadius ?? DEFAULT_RADIUS_M);
      // Only allow enabling if the point is valid
      data.geoEnabled = nextEnabled;
    }
  }

  const school = await prisma.school.update({
    where: { id: user.schoolId },
    data,
    select: {
      id: true,
      address: true,
      geoLatitude: true,
      geoLongitude: true,
      geoRadiusM: true,
      geoEnabled: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "SCHOOL_PROFILE_UPDATED",
      entityType: "School",
      entityId: school.id,
      metadata: {
        addressSet: (data.address as string | undefined)?.length
          ? (data.address as string).length > 0
          : undefined,
        geoConfigured: isValidPoint({
          latitude: decimalToNumber(school.geoLatitude),
          longitude: decimalToNumber(school.geoLongitude),
        }),
        geoEnabled: school.geoEnabled,
        geoRadiusM: school.geoRadiusM,
      },
      ipAddress: getClientIp(request),
    },
  });

  const lat = decimalToNumber(school.geoLatitude);
  const lng = decimalToNumber(school.geoLongitude);

  return jsonNoStore({
    ok: true,
    address: school.address,
    addressConfirmed: school.address.length > 0,
    geo: {
      enabled: school.geoEnabled,
      latitude: lat,
      longitude: lng,
      radiusM: school.geoRadiusM ?? DEFAULT_RADIUS_M,
      configured: isValidPoint({ latitude: lat, longitude: lng }),
    },
  });
}
