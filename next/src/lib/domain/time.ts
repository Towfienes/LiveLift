/**
 * Time helpers. Pure and deterministic: nothing here reads the system clock.
 * Instants are epoch milliseconds; durations are whole seconds.
 */

export const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function clockFormatter(timeZone: string, withSeconds: boolean): Intl.DateTimeFormat {
  const key = `${timeZone}|${withSeconds ? "s" : "m"}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      hourCycle: "h23",
    });
    formatterCache.set(key, f);
  }
  return f;
}

/** "20:12" or "20:12:30" in the given timezone. */
export function formatClock(ms: number, timeZone: string, withSeconds = false): string {
  return clockFormatter(timeZone, withSeconds).format(new Date(ms));
}

/** "Oct 3" style date in the given timezone. */
export function formatDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(
    new Date(ms)
  );
}

/** m:ss, or h:mm:ss from one hour. Negative values keep their sign. */
export function formatDuration(totalSec: number): string {
  const sign = totalSec < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalSec));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

/** +m:ss / -m:ss / 0:00 — for variance and drift. */
export function formatSigned(totalSec: number): string {
  const rounded = Math.round(totalSec);
  if (rounded === 0) return "0:00";
  return `${rounded > 0 ? "+" : "-"}${formatDuration(Math.abs(rounded))}`;
}

/** "3m", "1m 30s", "45s" — short human durations for sentences. */
export function formatHuman(totalSec: number): string {
  const abs = Math.abs(Math.round(totalSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export const secToMs = (sec: number): number => Math.round(sec * 1000);

/**
 * Parse "m:ss", "mm:ss" or plain minutes ("6", "6.5") into whole seconds.
 * Returns null for empty or invalid input — callers must not treat that as zero.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (text === "") return null;
  if (text.includes(":")) {
    const [mm, ss, ...rest] = text.split(":");
    if (rest.length > 0) return null;
    const m = Number(mm);
    const s = Number(ss);
    if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59) return null;
    const total = m * 60 + s;
    return total > 0 ? total : null;
  }
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(minutes * 60);
}

function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Epoch ms for a wall-clock "YYYY-MM-DD" + "HH:mm[:ss]" in an IANA zone. null if malformed. */
export function zonedTimeToMs(date: string, time: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!m || !t) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]), Number(t[3] ?? 0));
  const first = guess - zoneOffsetMs(guess, timeZone);
  // Second pass handles zones whose offset differs at the corrected instant.
  return guess - zoneOffsetMs(first, timeZone);
}

/** "YYYY-MM-DD" and "HH:mm" parts of an instant in a zone, for form inputs. */
export function msToZonedParts(ms: number, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
