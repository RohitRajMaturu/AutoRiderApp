import { auth } from "@/auth";
import {
  cancelPassengerPass,
  getPassCancellationQuote,
  passCancellationError,
} from "@/app/api/utils/pass-cancellation";

export async function GET(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { quote } = await getPassCancellationQuote(params.id, session.user.id);
    return Response.json({ refundQuote: quote });
  } catch (error) {
    return passCancellationError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    return Response.json(await cancelPassengerPass({
      passId: params.id,
      passengerId: session.user.id,
      confirmedRefundAmount: body.confirmedRefundAmount,
    }));
  } catch (error) {
    return passCancellationError(error);
  }
}
