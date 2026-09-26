/** Rounds a chart maximum up to 1, 2 or 5 × 10^n so gridlines land on clean values. */
export function niceMaximum(values: number[]) {
  const raw = Math.max(...values, 0);
  if (!raw) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Compact axis label: "1,5tr" for money in millions, "12k" for thousands. */
export function axisLabel(value: number, money = false) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  if (money && absolute >= 1_000_000) return `${sign}${Number((absolute / 1_000_000).toFixed(1))}tr`;
  if (absolute >= 1_000) return `${sign}${Number((absolute / 1_000).toFixed(1))}k`;
  return `${sign}${Number(absolute.toFixed(1)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}`;
}

export function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlOneX = point.x + (next.x - previous.x) / 6;
    const minimumY = Math.min(point.y, next.y);
    const maximumY = Math.max(point.y, next.y);
    const controlOneY = Math.min(maximumY, Math.max(minimumY, point.y + (next.y - previous.y) / 6));
    const controlTwoX = next.x - (afterNext.x - point.x) / 6;
    const controlTwoY = Math.min(maximumY, Math.max(minimumY, next.y - (afterNext.y - point.y) / 6));
    return `${path} C${controlOneX.toFixed(1)},${controlOneY.toFixed(1)} ${controlTwoX.toFixed(1)},${controlTwoY.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }, `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`);
}
