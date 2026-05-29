import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { is_online, lat, lng } = await request.json();

    // Check if subscription is active
    const driver =
      await sql`SELECT id, subscription_expiry FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
    if (driver.length === 0)
      return Response.json(
        { error: "Driver profile not found" },
        { status: 404 },
      );

    const now = new Date();
    const expiry = driver[0].subscription_expiry
      ? new Date(driver[0].subscription_expiry)
      : null;

    // If trying to go online but subscription expired
    if (is_online && (!expiry || expiry < now)) {
      return Response.json(
        {
          error: "Subscription expired. Please renew to go online.",
          code: "SUBSCRIPTION_EXPIRED",
        },
        { status: 403 },
      );
    }

    const rows = await sql`
      UPDATE drivers 
      SET is_online = COALESCE(${is_online}, is_online),
          last_lat = COALESCE(${lat}, last_lat),
          last_lng = COALESCE(${lng}, last_lng)
      WHERE user_id = ${session.user.id}
      RETURNING *
    `;

    return Response.json({ driver: rows[0] });
  } catch (err) {
    console.error("PATCH /api/drivers/status error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
