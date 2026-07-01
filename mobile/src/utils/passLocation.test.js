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

  test("does not silently choose the first result for a typed destination", async () => {
    const fetchFn = jest.fn();

    await expect(resolvePassLocation(
      { label: "Kempegowda Airport", lat: "", lng: "" },
      { fetchFn, fieldName: "destination" },
    )).rejects.toThrow("Choose the destination from the search results");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("loads place details when autocomplete only supplies a place id", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(response({ place: { address: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408 } }));

    const result = await resolvePassLocation(
      { label: "Indiranagar", placeId: "place-1", lat: "", lng: "" },
      { fetchFn, fieldName: "destination" },
    );

    expect(result).toEqual({ label: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("keeps coordinates and safely truncates a verbose provider address", async () => {
    const address = `Long destination ${"address ".repeat(30)}`;
    const result = await resolvePassLocation({ label: address, lat: 12.9716, lng: 77.5946 });

    expect(result).toMatchObject({ lat: 12.9716, lng: 77.5946 });
    expect(result.label).toHaveLength(200);
  });
});
