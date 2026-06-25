import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { triggerRideEvent } from "@/lib/pusher/server";

const CHATTABLE_STATUSES = new Set(["accepted", "in_progress"]);
const MAX_MESSAGE_LENGTH = 200;
const CLIENT_MESSAGE_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,100}$/;

async function getAuthorizedRide(request, rideId) {
  const session = await auth(request);
  if (!session?.user?.id) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const rideRows = await sql`
    SELECT
      r.id,
      r.status,
      r.passenger_id,
      d.user_id AS driver_user_id
    FROM rides r
    LEFT JOIN drivers d ON r.driver_id = d.id
    WHERE r.id = ${rideId}
    LIMIT 1
  `;
  const ride = rideRows[0];
  if (!ride) {
    return { response: Response.json({ error: "Ride not found" }, { status: 404 }) };
  }

  const isPassenger = ride.passenger_id === session.user.id;
  const isDriver = ride.driver_user_id === session.user.id;
  if (!isPassenger && !isDriver) {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!CHATTABLE_STATUSES.has(ride.status)) {
    return {
      response: Response.json(
        { error: "Chat is only available during an active ride" },
        { status: 409 },
      ),
    };
  }

  return {
    ride,
    role: isPassenger ? "passenger" : "driver",
    session,
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    rideId: message.ride_id,
    senderRole: message.sender_role,
    text: message.text,
    sentAt: message.sent_at,
    readAt: message.read_at || null,
  };
}

export async function GET(request, { params }) {
  try {
    const access = await getAuthorizedRide(request, params.id);
    if (access.response) return access.response;

    const messages = await sql`
      SELECT id, ride_id, sender_role, text, sent_at, read_at
      FROM ride_chat_messages
      WHERE ride_id = ${params.id}
      ORDER BY sent_at ASC
      LIMIT 100
    `;

    return Response.json({ messages: messages.map(serializeMessage) });
  } catch (err) {
    console.error("GET /api/rides/[id]/chat error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const access = await getAuthorizedRide(request, params.id);
    if (access.response) return access.response;

    const body = await request.json().catch(() => ({}));
    const text = String(body.text || "").trim().slice(0, MAX_MESSAGE_LENGTH);
    const clientMessageId = String(body.clientMessageId || "").trim();

    if (!text) {
      return Response.json({ error: "Message text is required" }, { status: 400 });
    }
    if (clientMessageId && !CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId)) {
      return Response.json({ error: "Invalid message identifier" }, { status: 400 });
    }

    const payload = {
      id: clientMessageId || `${access.session.user.id}:${Date.now()}`,
      rideId: params.id,
      text,
      senderRole: access.role,
      sentAt: new Date().toISOString(),
      readAt: null,
    };

    await sql`
      INSERT INTO ride_chat_messages (id, ride_id, sender_role, text, sent_at)
      VALUES (${payload.id}, ${params.id}, ${payload.senderRole}, ${payload.text}, ${payload.sentAt})
      ON CONFLICT (id) DO NOTHING
    `;

    const published = await triggerRideEvent(params.id, "chat-message", payload);
    return Response.json({ ok: true, message: payload, realtime: published });
  } catch (err) {
    console.error("POST /api/rides/[id]/chat error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const access = await getAuthorizedRide(request, params.id);
    if (access.response) return access.response;

    const body = await request.json().catch(() => ({}));
    const lastMessageId = String(body.lastMessageId || "").trim();
    if (!lastMessageId || !CLIENT_MESSAGE_ID_PATTERN.test(lastMessageId)) {
      return Response.json({ error: "Invalid message identifier" }, { status: 400 });
    }

    const readMessages = await sql`
      UPDATE ride_chat_messages
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE ride_id = ${params.id}
        AND sender_role <> ${access.role}
        AND read_at IS NULL
        AND sent_at <= COALESCE(
          (
            SELECT sent_at
            FROM ride_chat_messages
            WHERE id = ${lastMessageId}
              AND ride_id = ${params.id}
          ),
          CURRENT_TIMESTAMP
        )
      RETURNING id
    `;

    const payload = {
      lastMessageId,
      readerRole: access.role,
      readAt: new Date().toISOString(),
      readMessageIds: readMessages.map((message) => message.id),
    };
    const published = await triggerRideEvent(params.id, "chat-read", payload);
    return Response.json({ ok: true, receipt: payload, realtime: published });
  } catch (err) {
    console.error("PATCH /api/rides/[id]/chat error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
