// Ticket-04 local leaderboard (pure logic, shared by the game page, the local server and the export command).
export interface LeaderEntry {
  name: string;
  score: number; // total of the nights won
  nights_won: number; // 0..3
  achieved_at: string; // ISO 8601 with timezone offset
  seed: number;
}

export const MAX_ENTRIES = 10;

/** 3-12 characters of [A-Za-z0-9_]; Vietnamese letters with diacritics are accepted too (bonus). */
export function validName(raw: string): string | null {
  const name = raw.normalize("NFC").trim();
  const chars = [...name];
  if (chars.length < 3 || chars.length > 12) return null;
  return /^[\p{L}\p{M}0-9_]+$/u.test(name) && /^[A-Za-z0-9_À-ỹ̀-̣]+$/u.test(name) ? name : null;
}

/** ISO 8601 with the local timezone offset, e.g. 2026-11-20T17:05:09+07:00 */
export function isoWithOffset(d = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/** score desc; equal score -> whoever achieved it first stays above */
export function sortEntries(list: LeaderEntry[]): LeaderEntry[] {
  return [...list].sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
}

export function addEntry(list: LeaderEntry[], e: LeaderEntry): LeaderEntry[] {
  return sortEntries([...list, e]).slice(0, MAX_ENTRIES);
}

/** validate untrusted input (file / HTTP body) into an entry, or null */
export function toEntry(raw: unknown): LeaderEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? validName(o.name) : null;
  if (!name) return null;
  if (!Number.isInteger(o.score) || (o.score as number) < 0) return null;
  if (!Number.isInteger(o.nights_won) || (o.nights_won as number) < 0 || (o.nights_won as number) > 3) return null;
  if (!Number.isInteger(o.seed)) return null;
  const at = typeof o.achieved_at === "string" && !Number.isNaN(Date.parse(o.achieved_at)) ? o.achieved_at : isoWithOffset();
  return { name, score: o.score as number, nights_won: o.nights_won as number, achieved_at: at, seed: o.seed as number };
}
