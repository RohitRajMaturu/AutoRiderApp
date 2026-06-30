import { cronUnauthorized, isCronAuthorized } from "@/app/api/utils/cron-auth";
import { generateInstitutionInvoices } from "@/app/api/utils/phase2-jobs";

export async function POST(request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();
  try {
    return Response.json(await generateInstitutionInvoices());
  } catch (error) {
    console.error("POST /api/jobs/institution-generate-invoices error:", error);
    return Response.json({ error: "Phase 2 job failed" }, { status: 500 });
  }
}
