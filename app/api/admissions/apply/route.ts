import { jsonNoStore } from "@/lib/requests";

export const runtime = "nodejs";

export async function POST() {
  return jsonNoStore(
    {
      error:
        "This endpoint has been replaced by the secure admissions workflow. Please use /admissions.",
    },
    { status: 410 },
  );
}
