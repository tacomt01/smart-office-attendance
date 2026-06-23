export const WORK_START = '09:00';
export const WORK_END = '18:00';

export function isLate(timeStr: string): boolean {
  return timeStr > WORK_START;
}

export function isEarlyLeave(timeStr: string): boolean {
  return timeStr < WORK_END;
}
