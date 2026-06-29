import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

const DAILY_TARGET = 8;
const DAILY_BONUS = 50;
const STREAK_TARGET = 5;
const STREAK_BONUS = 200;

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const drivers = await sql`SELECT id FROM drivers WHERE user_id = ${session.user.id} LIMIT 1`;
    const driver = drivers[0];
    if (!driver) return Response.json({ error: "Driver profile not found" }, { status: 404 });

    const [rideCounts, incentiveRows] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS rides_today
        FROM rides
        WHERE driver_id = ${driver.id}
          AND status = 'completed'
          AND completed_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata')
            AT TIME ZONE 'Asia/Kolkata'
      `,
      sql`
        SELECT id, type, target_rides, bonus_amount, rides_completed, status
        FROM driver_incentives
        WHERE driver_id = ${driver.id}
          AND status = 'active'
          AND period_start <= CURRENT_TIMESTAMP
          AND period_end > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
      `,
    ]);

    const ridesToday = Number(rideCounts[0]?.rides_today ?? 0);
    const dailyRow = incentiveRows.find((row) => row.type === "daily_target");
    const streakRow = incentiveRows.find((row) => row.type === "streak");
    const dailyTarget = Number(dailyRow?.target_rides || DAILY_TARGET);
    const dailyCompleted = Math.max(ridesToday, Number(dailyRow?.rides_completed || 0));
    const dailyBonus = Number(dailyRow?.bonus_amount || DAILY_BONUS);

    let streak = null;
    if (streakRow) {
      const target = Number(streakRow.target_rides || STREAK_TARGET);
      const daysCompleted = Number(streakRow.rides_completed || 0);
      streak = {
        target,
        bonus: Number(streakRow.bonus_amount || STREAK_BONUS),
        daysCompleted,
        remaining: Math.max(target - daysCompleted, 0),
        achieved: daysCompleted >= target,
        incentiveId: streakRow.id,
      };
    }

    return Response.json({
      ridesToday,
      daily: {
        target: dailyTarget,
        bonus: dailyBonus,
        completed: dailyCompleted,
        remaining: Math.max(dailyTarget - dailyCompleted, 0),
        achieved: dailyCompleted >= dailyTarget,
        incentiveId: dailyRow?.id || null,
      },
      streak,
    });
  } catch (err) {
    console.error("GET /api/drivers/incentives error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
