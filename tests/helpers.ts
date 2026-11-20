import { runHeadless, type RunOptions } from "../src/sim/contract-io";

export type Line = Record<string, any>;

export function run(opts: Partial<RunOptions> & { ticks: number }): Line[] {
  return runHeadless({ seed: 1, ...opts }).map((l) => JSON.parse(l));
}

export const events = (lines: Line[], name?: string) =>
  lines.filter((l) => l.type === "event" && (!name || l.name === name));
export const snaps = (lines: Line[]) => lines.filter((l) => l.type === "snapshot");
export const snapAt = (lines: Line[], tick: number): Line => {
  const s = snaps(lines).find((x) => x.tick === tick);
  if (!s) throw new Error(`no snapshot at tick ${tick}`);
  return s;
};
export const end = (lines: Line[]) => lines[lines.length - 1];

/** Empty, controlled world: no random motes/shades/drifters, no wind. */
export const bare = (extra: Record<string, unknown> = {}) => ({
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  wind_enabled: false,
  motes: [],
  shades: [],
  drifters: [],
  charms: [],
  ...extra,
});
