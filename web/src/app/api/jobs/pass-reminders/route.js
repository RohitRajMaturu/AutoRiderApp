import { cronUnauthorized, isCronAuthorized } from "@/app/api/utils/cron-auth";
import { sendPassReminders } from "@/app/api/utils/phase2-jobs";

export async function POST(request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    return Response.json(await sendPassReminders());
  } catch (error) {
    console.error("POST /api/jobs/pass-reminders error:", error);
    return Response.json({ error: "Phase 2 job failed" }, { status: 500 });
  }
}
