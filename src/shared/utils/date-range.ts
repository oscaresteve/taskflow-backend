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

export const DAY_MS = 24 * 60 * 60 * 1000;

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

// `Task.dueDate` no es un instante sino un dia de calendario, y viaja siempre como la medianoche UTC
// de ese dia para que todo el mundo vea la misma fecha. Esta es la clave del dia que es "hoy" en
// `timeZone`: lo que hay que comparar contra la columna. Comparar contra `new Date()` en vez de
// contra esto es lo que hacia que una tarea que vence hoy contara como vencida desde las 00:00.
export function getDayKey(instant: Date, timeZone: string): Date {
  const local = new Date(instant.getTime() + getTimeZoneOffsetMs(instant, timeZone));

  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

// Claves de dia del lunes de la semana ISO que contiene `now` visto desde `timeZone`, y del lunes
// siguiente (exclusivo). Mismo criterio que date-fns `isThisWeek(date, { weekStartsOn: 1 })`, que
// es lo que hace el filtro de Kanban en el cliente. Al ser claves de dia se pueden sumar y restar
// dias enteros sin que un cambio de horario de verano corra el limite.
export function getThisWeekRange(now: Date, timeZone: string): { start: Date; end: Date } {
  const today = getDayKey(now, timeZone);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;

  const start = new Date(today.getTime() - daysSinceMonday * DAY_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS);

  return { start, end };
}
