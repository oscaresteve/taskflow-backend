// Desfase (ms) tal que `instant.getTime() + offset` reproduce, leido con los getters UTC, la
// hora de pared de `timeZone` para ese instante. No hay date-fns-tz/luxon en el backend y anadir
// una dependencia solo para esta cuenta seria mas coste que este helper con Intl (soportado nativo
// en Node con ICU completo).
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));

  return asIfUtc - instant.getTime();
}

// El timezone del usuario es texto libre (no se valida contra la lista IANA al firmar), asi que
// un valor corrupto no debe tumbar el listado: cae a UTC igual que si no hubiera timezone guardado.
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";

  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

// Limites de la semana ISO (lunes-domingo) que contiene `now`, vistos desde `timeZone`. Mismo
// criterio que date-fns `isThisWeek(date, { weekStartsOn: 1 })` evaluado en esa zona, que es lo
// que hace el filtro de Kanban en el cliente con la zona del navegador. Se usa un unico desfase
// (el de `now`) para las dos puntas de la semana: si el limite cae justo sobre un cambio de
// horario de verano puede quedar corrido una hora, asumible para un filtro de "esta semana".
export function getThisWeekRange(now: Date, timeZone: string): { start: Date; end: Date } {
  const offset = getTimeZoneOffsetMs(now, timeZone);
  const local = new Date(now.getTime() + offset);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;

  const start = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - offset,
  );
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { start, end };
}
