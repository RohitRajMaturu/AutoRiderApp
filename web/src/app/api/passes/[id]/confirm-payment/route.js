import { auth } from "@/auth";
import { createPassPaymentLink } from "@/app/api/utils/pass-payment";

export async function POST(request, { params }) {
  const session = await auth(request);
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await createPassPaymentLink({
      passId: params.id,
      passengerId: session.user.id,
    });
    if (result.error)
      return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    console.error("POST /api/passes/[id]/confirm-payment error:", error);
    return Response.json(
      { error: "Could not create the secure payment link" },
      { status: 500 },
    );
  }
}
