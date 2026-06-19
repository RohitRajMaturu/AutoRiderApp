import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function readRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

function readComment(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= 280 ? trimmed : undefined;
}

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rating = readRating(body.rating);
    const comment = readComment(body.comment);

    if (!rating || comment === undefined) {
      return Response.json(
        { error: "rating must be 1-5 and comment must be 280 characters or fewer" },
        { status: 400 },
      );
    }

    const rows = await sql`
      UPDATE rides
      SET driver_rating = ${rating},
          rating_feedback = ${comment},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
        AND passenger_id = ${session.user.id}
        AND status = 'completed'
        AND driver_rating IS NULL
      RETURNING id, driver_rating, rating_feedback
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Ride cannot be rated because it is not completed, already rated, or not accessible to this user" },
        { status: 409 },
      );
    }

    return Response.json({ ok: true, rating: rows[0] });
  } catch (err) {
    console.error("POST /api/rides/[id]/rating error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
