import { describe, expect, it } from "vitest";
import { getDayKey, getThisWeekRange, resolveTimeZone } from "../../src/shared/utils/date-range.ts";

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

// 2026-01-05 es lunes. A las 02:00 UTC no es el mismo dia en todas las zonas, y es ahi donde se ve
// que la clave de dia depende del timezone del usuario y no del instante.
describe("getDayKey", () => {
  const now = new Date("2026-01-05T02:00:00.000Z");

  it("truncates to the UTC midnight of the local date", () => {
    expect(getDayKey(now, "UTC").toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  // UTC+14: a esa hora ya es lunes 16:00 alli, mismo dia que en UTC.
  it("keeps the local date for a timezone ahead of UTC", () => {
    expect(getDayKey(now, "Pacific/Kiritimati").toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  // UTC-12: a esa hora todavia es domingo 14:00 alli, o sea el dia anterior al que ve UTC.
  it("resolves to the previous day when the timezone has not reached midnight yet", () => {
    expect(getDayKey(now, "Etc/GMT+12").toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});

// Los limites son claves de dia, no instantes: el rango no se desplaza con el desfase de la zona,
// solo cambia de semana cuando la zona esta en otro dia.
describe("getThisWeekRange", () => {
  const now = new Date("2026-01-05T02:00:00.000Z");

  it("uses the UTC week when the timezone is UTC", () => {
    const { start, end } = getThisWeekRange(now, "UTC");

    expect(start.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-12T00:00:00.000Z");
  });

  // UTC+14: alli ya es lunes, la misma semana ISO que en UTC y con los mismos limites.
  it("returns the same week for a timezone that is already on Monday", () => {
    const { start, end } = getThisWeekRange(now, "Pacific/Kiritimati");

    expect(start.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-12T00:00:00.000Z");
  });

  // UTC-12: alli todavia es domingo, o sea la semana anterior a la que ve UTC para el mismo instante.
  it("resolves to the previous week when the timezone is still on Sunday", () => {
    const { start, end } = getThisWeekRange(now, "Etc/GMT+12");

    expect(start.toISOString()).toBe("2025-12-29T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });
});
