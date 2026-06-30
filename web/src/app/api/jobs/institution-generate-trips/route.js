import { cronUnauthorized, isCronAuthorized } from "@/app/api/utils/cron-auth";
import { generateInstitutionTrips } from "@/app/api/utils/phase2-jobs";

export async function POST(request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    return Response.json(await generateInstitutionTrips());
  } catch (error) {
    console.error("POST /api/jobs/institution-generate-trips error:", error);
    return Response.json({ error: "Phase 2 job failed" }, { status: 500 });
  }
}
