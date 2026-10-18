/** 4:05, or 1:02:03 past an hour. Tabular digits come from the font. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "Oct 18" style short date for a YYYY-MM-DD key, in the device locale. */
export function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  try {
    return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return key;
  }
}

export function monthTitle(year: number, month: number): string {
  try {
    return new Date(year, month, 1, 12).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}
