import { auth } from "@/auth";
import {
  acceptPassTerms,
  getPassTermsStatus,
  PASS_TERMS_SECTIONS,
  PASS_TERMS_VERSION,
} from "@/app/api/utils/pass-terms";

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "passenger")
      return Response.json({ error: "Only passengers can accept pass terms" }, { status: 403 });
    return Response.json(await getPassTermsStatus(session.user.id));
  } catch (error) {
    console.error("GET /api/passes/terms error:", error);
    return Response.json({ error: "Could not load TukTukPass terms" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "passenger")
      return Response.json({ error: "Only passengers can accept pass terms" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (body.accepted !== true || body.termsVersion !== PASS_TERMS_VERSION) {
      return Response.json(
        { error: "Accept the current TukTukPass terms to continue", code: "INVALID_PASS_TERMS_CONSENT" },
        { status: 400 },
      );
    }
    const consent = await acceptPassTerms(session.user.id, request.headers.get("user-agent"));
    return Response.json({
      consentId: consent.id,
      acceptedAt: consent.accepted_at,
      version: PASS_TERMS_VERSION,
      sections: PASS_TERMS_SECTIONS,
    });
  } catch (error) {
    console.error("POST /api/passes/terms error:", error);
    return Response.json({ error: "Could not save TukTukPass consent" }, { status: 500 });
  }
}
