import { describe, expect, it } from "vitest";
import { getThisWeekRange, resolveTimeZone } from "../../src/shared/utils/date-range.ts";

describe("resolveTimeZone", () => {
  it("falls back to UTC when there is no stored timezone", () => {
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone(undefined)).toBe("UTC");
  });

  it("falls back to UTC for a value that Intl doesn't recognize as a timezone", () => {
    expect(resolveTimeZone("not-a-timezone")).toBe("UTC");
  });

  it("passes through a valid IANA timezone", () => {
    expect(resolveTimeZone("Europe/Madrid")).toBe("Europe/Madrid");
  });
});

// 2026-01-05 es lunes. A las 02:00 UTC son distintos dias de la semana segun el timezone: eso es
// justo lo que hace que el mismo instante `now` caiga en semanas distintas segun la zona.
describe("getThisWeekRange", () => {
  const now = new Date("2026-01-05T02:00:00.000Z");

  it("uses the UTC week when the timezone is UTC", () => {
    const { start, end } = getThisWeekRange(now, "UTC");

    expect(start.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-12T00:00:00.000Z");
  });

  // UTC+14: a esa hora ya es lunes 16:00 alli, misma semana que en UTC pero con el lunes local
  // empezando antes en terminos UTC.
  it("shifts the week start earlier for a timezone ahead of UTC", () => {
    const { start, end } = getThisWeekRange(now, "Pacific/Kiritimati");

    expect(start.toISOString()).toBe("2026-01-04T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-11T10:00:00.000Z");
  });

  // UTC-12: a esa hora todavia es domingo 14:00 alli, o sea la semana anterior a la que ve UTC
  // para el mismo instante.
  it("resolves to the previous week when the timezone is still on Sunday", () => {
    const { start, end } = getThisWeekRange(now, "Etc/GMT+12");

    expect(start.toISOString()).toBe("2025-12-29T12:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-05T12:00:00.000Z");
  });
});
