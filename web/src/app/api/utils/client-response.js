export async function readJsonResponse(response, label = "Request") {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    const error = new Error(
      response.redirected || /<html[\s>]/i.test(text)
        ? `${label} returned a web page instead of API data. Sign in again, then retry.`
        : `${label} returned an unsupported response (${response.status}).`,
    );
    error.code = "NON_JSON_RESPONSE";
    error.status = response.status;
    throw error;
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const error = new Error(
      `${label} returned malformed JSON (${response.status}).`,
    );
    error.code = "INVALID_JSON_RESPONSE";
    error.status = response.status;
    throw error;
  }
}
