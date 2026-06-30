import { auth } from "@/auth";
import { createPassPaymentLink } from "@/app/api/utils/pass-payment";

// Compatibility endpoint for mobile builds released before the pass-scoped route.
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.passId) return Response.json({ error: "passId is required" }, { status: 400 });
  const result = await createPassPaymentLink({ passId: body.passId, passengerId: session.user.id });
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
