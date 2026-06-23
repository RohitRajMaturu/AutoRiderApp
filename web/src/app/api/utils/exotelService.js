function getExotelConfig() {
  const {
    EXOTEL_SID,
    EXOTEL_API_KEY,
    EXOTEL_API_TOKEN,
    EXOTEL_SUBDOMAIN = "api.exotel.com",
    EXOTEL_VIRTUAL_NUMBER,
    EXOTEL_APP_ID,
  } = process.env;

  if (
    !EXOTEL_SID ||
    !EXOTEL_API_KEY ||
    !EXOTEL_API_TOKEN ||
    !EXOTEL_SUBDOMAIN ||
    !EXOTEL_VIRTUAL_NUMBER ||
    !EXOTEL_APP_ID
  ) {
    return null;
  }

  return {
    sid: EXOTEL_SID,
    apiKey: EXOTEL_API_KEY,
    apiToken: EXOTEL_API_TOKEN,
    subdomain: EXOTEL_SUBDOMAIN,
    virtualNumber: EXOTEL_VIRTUAL_NUMBER,
    appId: EXOTEL_APP_ID,
  };
}

export function isExotelConfigured() {
  return Boolean(getExotelConfig());
}

function exotelAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.apiKey}:${config.apiToken}`).toString("base64")}`;
}

export async function initiateMaskedCall(passengerPhone, driverPhone, rideId, direction) {
  const config = getExotelConfig();
  if (!config) {
    return {
      error: "Masked calling is not configured",
      code: "EXOTEL_NOT_CONFIGURED",
    };
  }

  const from = direction === "driver_to_passenger" ? driverPhone : passengerPhone;
  const to = direction === "driver_to_passenger" ? passengerPhone : driverPhone;
  const params = new URLSearchParams({
    From: from,
    To: to,
    CallerId: config.virtualNumber,
    Url: config.appId,
    CustomField: rideId,
  });

  try {
    const response = await fetch(
      `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/connect`,
      {
        method: "POST",
        headers: {
          Authorization: exotelAuthHeader(config),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        error: "Masked call failed",
        code: "EXOTEL_CALL_FAILED",
        providerStatus: response.status,
      };
    }

    const call = body.Call || body.call || body;
    return {
      callSid: call.Sid || call.sid || call.CallSid || call.callSid,
      status: call.Status || call.status || "initiated",
    };
  } catch (error) {
    console.error("Exotel call initiation failed:", { rideId, message: error.message });
    return {
      error: "Masked call failed",
      code: "EXOTEL_CALL_FAILED",
    };
  }
}

export async function getCallRecord(callSid) {
  const config = getExotelConfig();
  if (!config) {
    return { error: "Masked calling is not configured", code: "EXOTEL_NOT_CONFIGURED" };
  }

  try {
    const response = await fetch(
      `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/${callSid}`,
      { headers: { Authorization: exotelAuthHeader(config) } },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: "Call record lookup failed", code: "EXOTEL_LOOKUP_FAILED" };
    }
    const call = body.Call || body.call || body;
    return {
      callSid,
      status: call.Status || call.status || null,
      durationSeconds: Number(call.Duration || call.duration || 0),
      timestamp: call.DateCreated || call.dateCreated || null,
    };
  } catch (error) {
    console.error("Exotel call lookup failed:", { callSid, message: error.message });
    return { error: "Call record lookup failed", code: "EXOTEL_LOOKUP_FAILED" };
  }
}
