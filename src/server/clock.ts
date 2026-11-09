// Đồng hồ inject được (design D5) để test thời gian (khóa PIN, nửa đêm, hạn lời mời...).

export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

export type FixedClock = Clock & { set(date: Date | string): void; advance(ms: number): void };

export function fixedClock(start: Date | string): FixedClock {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set(date) {
      current = new Date(date);
    },
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
  };
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
