export function formatMiles(m: number): string {
  if (!m || m < 0.1) return "0 mi";
  return `${m.toFixed(m < 10 ? 1 : 0)} mi`;
}
export function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}
export function formatFt(ft: number, inches: number): string {
  return `${ft}ft ${inches}in`;
}
export function shortRelative(ts?: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
export function niceStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
