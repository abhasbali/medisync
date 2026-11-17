import { describe, expect, it } from "vitest";
import { availabilityLevel, availabilityPercent } from "@/lib/format";
import { validateCounts } from "@/pages/HospitalAdminPage";
import { invalidateFor } from "@/contexts/RealtimeContext";
import { QueryClient } from "@tanstack/react-query";

describe("availability colour thresholds (report section 2.1.4)", () => {
  it("is green at 40% or more", () => {
    expect(availabilityLevel(8, 20)).toBe("good"); // Apollo emergency, exactly 40%
    expect(availabilityLevel(40, 50)).toBe("good");
  });
  it("is amber from 15% up to 40%", () => {
    expect(availabilityLevel(5, 30)).toBe("low"); // Apollo ICU ~17%
    expect(availabilityLevel(3, 20)).toBe("low"); // exactly 15%
  });
  it("is red below 15%", () => {
    expect(availabilityLevel(1, 18)).toBe("critical"); // Kauvery ICU ~6%
    expect(availabilityLevel(0, 10)).toBe("critical");
  });
  it("handles zero capacity without dividing by zero", () => {
    expect(availabilityPercent(0, 0)).toBe(0);
    expect(availabilityLevel(0, 0)).toBe("none");
  });
});

describe("admin count validation", () => {
  it("rejects non-integers, negatives and available above total", () => {
    expect(validateCounts("10.5", "2", 0)).toMatch(/whole numbers/);
    expect(validateCounts("-1", "0", 0)).toMatch(/whole numbers/);
    expect(validateCounts("10", "11", 0)).toMatch(/cannot exceed/);
  });
  it("protects active allocations", () => {
    expect(validateCounts("8", "8", 1)).toMatch(/must stay occupied/);
    expect(validateCounts("8", "7", 1)).toBeNull();
  });
});

describe("realtime invalidation", () => {
  it("refreshes inventory-dependent data on an allocation but not on a new transfer request", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    invalidateFor(qc, { type: "ALLOCATED", entity: "REQUEST", referenceId: 1, timestamp: "" });
    const keysAfterAllocation = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keysAfterAllocation).toContain(JSON.stringify(["hospitals"]));
    expect(keysAfterAllocation).toContain(JSON.stringify(["requests"]));

    spy.mockClear();
    invalidateFor(qc, { type: "TRANSFER_REQUESTED", entity: "TRANSFER", referenceId: 2, timestamp: "" });
    const keysAfterTransfer = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keysAfterTransfer).toContain(JSON.stringify(["transfers"]));
    expect(keysAfterTransfer).not.toContain(JSON.stringify(["hospitals"]));
  });
});
