import { hasValidPassLocation, resolvePassLocation } from "./passLocation";
import { describe, expect, jest, test } from "@jest/globals";

function response(body, ok = true) {
  return { ok, json: async () => body };
}

describe("TukTukPass location resolution", () => {
  test("does not mistake empty coordinates for zero coordinates", () => {
    expect(hasValidPassLocation({ label: "MG Road", lat: "", lng: "" })).toBe(false);
    expect(hasValidPassLocation({ label: "MG Road", lat: null, lng: null })).toBe(false);
  });

  test("resolves a typed destination from autocomplete coordinates", async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({
      suggestions: [{ label: "Kempegowda Airport", lat: 13.1986, lng: 77.7066 }],
    }));

    await expect(resolvePassLocation(
      { label: "Kempegowda Airport", lat: "", lng: "" },
      { fetchFn, fieldName: "destination" },
    )).resolves.toEqual({ label: "Kempegowda Airport", lat: 13.1986, lng: 77.7066 });
  });

  test("loads place details when autocomplete only supplies a place id", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(response({ suggestions: [{ label: "Indiranagar", placeId: "place-1" }] }))
      .mockResolvedValueOnce(response({ place: { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408 } }));

    const result = await resolvePassLocation(
      { label: "Indiranagar", lat: "", lng: "" },
      { fetchFn, fieldName: "destination" },
    );

    expect(result).toEqual({ label: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
