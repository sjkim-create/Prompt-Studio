export function strokeColor(index: number, total: number): string {
  const hue = (index / Math.max(total - 1, 1)) * 270;
  return `hsl(${hue}, 85%, 45%)`;
}
