export function formatRemaining(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;

  let formatted: string;
  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    formatted = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}
