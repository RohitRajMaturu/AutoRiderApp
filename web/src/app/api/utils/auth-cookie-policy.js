export function shouldUseSecureCookies({ requestUrl, forwardedProtocol, authUrl, nodeEnv }) {
  let requestProtocol = "http";
  try {
    requestProtocol = new URL(requestUrl).protocol.replace(":", "");
  } catch {
    // Invalid request URLs must not force secure cookies in development.
  }
  const proxyProtocol = String(forwardedProtocol || "").split(",")[0].trim();
  const requestIsSecure = (proxyProtocol || requestProtocol) === "https";
  return requestIsSecure || (nodeEnv === "production" && String(authUrl || "").startsWith("https://"));
}
