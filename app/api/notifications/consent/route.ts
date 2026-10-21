import { AlertChannel, NotificationKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCommunicationConsents, setCommunicationConsent } from "@/lib/communication-consent";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Self-service communication consent (L, W4 / NDPA).
 *
 * A signed-in user controls whether the school may reach them on WhatsApp,
 * SMS or email per message kind. This is the legal opt-in record; in-app
 * category toggles (notification preferences) are a separate, softer layer.
 */
const postSchema = z.object({
  channel: z.nativeEnum(AlertChannel),
  kind: z.nativeEnum(NotificationKind),
  optedIn: z.boolean(),
  source: z.string().trim().max(40).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const consents = await listCommunicationConsents(session.id);
  return NextResponse.json({
    consents: consents.map((consent) => ({
      channel: consent.channel,
      kind: consent.kind,
      optedIn: consent.optedIn,
      source: consent.source,
      updatedAt: consent.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = postSchema.parse(body);
    const consent = await setCommunicationConsent({
      schoolId: session.schoolId,
      userId: session.id,
      channel: input.channel,
      kind: input.kind,
      optedIn: input.optedIn,
      source: input.source ?? "portal",
      actorUserId: session.id,
    });
    return NextResponse.json({
      consent: {
        channel: consent.channel,
        kind: consent.kind,
        optedIn: consent.optedIn,
        source: consent.source,
        updatedAt: consent.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Consent could not be saved." },
      { status: 400 },
    );
  }
}
