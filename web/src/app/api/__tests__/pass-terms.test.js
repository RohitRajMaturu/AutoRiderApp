import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/app/api/utils/sql", () => {
  mocks.sql.transaction = mocks.transaction;
  return { default: mocks.sql };
});

import {
  acceptPassTerms,
  getPassTermsStatus,
  PASS_TERMS_SECTIONS,
  PASS_TERMS_VERSION,
} from "@/app/api/utils/pass-terms";

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.transaction.mockReset();
});

describe("TukTukPass terms consent", () => {
  it("requires consent when only cancelled or stale passes remain", async () => {
    mocks.sql.mockResolvedValue([{ has_current_pass: false, consent_id: null }]);

    await expect(getPassTermsStatus("passenger-1")).resolves.toMatchObject({
      required: true,
      hasCurrentPass: false,
      consentId: null,
      version: PASS_TERMS_VERSION,
      sections: PASS_TERMS_SECTIONS,
    });
    expect(mocks.sql.mock.calls[0][0].join(" ")).toContain("end_date >=");
  });

  it("retains and reuses an accepted consent until a pass consumes it", async () => {
    mocks.sql.mockResolvedValue([{ has_current_pass: false, consent_id: "consent-1" }]);

    await expect(getPassTermsStatus("passenger-1")).resolves.toMatchObject({
      required: false,
      consentId: "consent-1",
    });
  });

  it("does not interrupt creation while the passenger has a current pass", async () => {
    mocks.sql.mockResolvedValue([{ has_current_pass: true, consent_id: null }]);

    await expect(getPassTermsStatus("passenger-1")).resolves.toMatchObject({
      required: false,
      hasCurrentPass: true,
    });
  });

  it("stores a versioned consent and reuses it on duplicate acceptance", async () => {
    const tx = vi.fn()
      .mockResolvedValueOnce([{ id: "passenger-1" }])
      .mockResolvedValueOnce([{ id: "consent-1", accepted_at: "2026-07-02T10:00:00Z" }]);
    mocks.transaction.mockImplementation((callback) => callback(tx));

    await expect(acceptPassTerms("passenger-1", "TukTukGo test")).resolves.toMatchObject({ id: "consent-1" });
    expect(tx).toHaveBeenCalledTimes(2);
  });
});
