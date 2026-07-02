import { cronUnauthorized, isCronAuthorized } from "@/app/api/utils/cron-auth";
import { sendPassExpiryFinalReminder } from "@/app/api/utils/phase2-jobs";

export async function POST(request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    return Response.json(await sendPassExpiryFinalReminder());
  } catch (error) {
    console.error("POST /api/jobs/pass-expiry-final-reminder error:", error);
    return Response.json({ error: "Phase 2 job failed" }, { status: 500 });
  }
}
