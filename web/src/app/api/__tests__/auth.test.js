import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldUseSecureCookies } from "@/app/api/utils/auth-cookie-policy";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@auth/core/jwt", () => ({
  getToken: mocks.getToken,
}));

vi.mock("@/app/api/utils/sql", () => ({
  default: mocks.sql,
}));

describe("Auth.js cookie policy", () => {
  it("uses non-secure cookies for LAN HTTP during development", () => {
    expect(shouldUseSecureCookies({
      requestUrl: "http://192.168.1.4:4000/admin",
      authUrl: "https://api.tuktukgo.in",
      nodeEnv: "development",
    })).toBe(false);
  });

  it("honors proxy HTTPS and the production HTTPS fallback", () => {
    expect(shouldUseSecureCookies({
      requestUrl: "http://127.0.0.1:4000/admin",
      forwardedProtocol: "https",
      authUrl: "https://api.tuktukgo.in",
      nodeEnv: "production",
    })).toBe(true);
    expect(shouldUseSecureCookies({
      requestUrl: "http://127.0.0.1:4000/admin",
      authUrl: "https://api.tuktukgo.in",
      nodeEnv: "production",
    })).toBe(true);
  });
});

describe("auth()", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getToken.mockReset();
    mocks.sql.mockReset();
    process.env.AUTH_SECRET = "test-secret";
  });

  it("returns null when no Auth.js token is present", async () => {
    mocks.getToken.mockResolvedValue(null);
    const { auth } = await import("@/auth");

    const session = await auth(new Request("http://localhost/api/rides"));

    expect(session).toBeNull();
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("returns the normalized app user when the token subject exists", async () => {
    mocks.getToken.mockResolvedValueOnce({ sub: "user-1" });
    mocks.sql.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "rider@example.com",
        phone: "+919000000000",
        role: "passenger",
        name: "Rider",
        image: null,
      },
    ]);
    const { auth } = await import("@/auth");

    const session = await auth(new Request("http://localhost/api/rides"));

    expect(session).toEqual({
      user: {
        id: "user-1",
        email: "rider@example.com",
        phone: "+919000000000",
        role: "passenger",
        name: "Rider",
        image: null,
      },
    });
  });
});

describe("mobile auth token callback", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getToken.mockReset();
    mocks.sql.mockReset();
    process.env.AUTH_SECRET = "test-secret";
  });

  it("returns a React Native bridge message for an authenticated mobile client", async () => {
    mocks.getToken
      .mockResolvedValueOnce("raw-jwt")
      .mockResolvedValueOnce({ sub: "user-1" });
    mocks.sql.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "rider@example.com",
        phone: "+919000000000",
        role: "passenger",
        name: "Rider",
        image: null,
      },
    ]);
    const { GET } = await import("@/app/api/auth/token/route");

    const response = await GET(
      new Request("http://localhost/api/auth/token?client=mobile"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("ReactNativeWebView");
    expect(body).toContain("AUTH_SUCCESS");
    expect(body).toContain("raw-jwt");
  });
});
