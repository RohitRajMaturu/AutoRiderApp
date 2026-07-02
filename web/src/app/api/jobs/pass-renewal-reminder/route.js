import { cronUnauthorized, isCronAuthorized } from "@/app/api/utils/cron-auth";
import { sendPassRenewalReminders } from "@/app/api/utils/phase2-jobs";

export async function POST(request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    return Response.json(await sendPassRenewalReminders());
  } catch (error) {
    console.error("POST /api/jobs/pass-renewal-reminder error:", error);
    return Response.json({ error: "Phase 2 job failed" }, { status: 500 });
  }
}
