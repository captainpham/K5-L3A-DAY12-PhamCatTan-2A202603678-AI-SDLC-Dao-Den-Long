// Leaderboard client: the local server (`npm start` = dist/serve.cjs) stores it on disk (~/.dao-den-long/leaderboard.json)
// so it survives restarts and can be exported with --export-leaderboard. Without that server (e.g. `npm run dev`) it falls
// back to localStorage, which is also kept on the local disk by the browser.
import { addEntry, sortEntries, toEntry, type LeaderEntry } from "../sim/leaderboard";

const LS = "ddl-leaderboard";
const fromLs = (): LeaderEntry[] => {
  try { return sortEntries((JSON.parse(localStorage.getItem(LS) ?? "[]") as unknown[]).map(toEntry).filter((e): e is LeaderEntry => !!e)); }
  catch { return []; }
};

export async function loadBoard(): Promise<LeaderEntry[]> {
  try {
    const r = await fetch("/api/leaderboard");
    if (r.ok) return (await r.json()).entries as LeaderEntry[];
  } catch { /* no local server */ }
  return fromLs();
}

export async function saveEntry(e: LeaderEntry): Promise<LeaderEntry[]> {
  try {
    const r = await fetch("/api/leaderboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e) });
    if (r.ok) return (await r.json()).entries as LeaderEntry[];
  } catch { /* no local server */ }
  const list = addEntry(fromLs(), e);
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* storage blocked */ }
  return list;
}
