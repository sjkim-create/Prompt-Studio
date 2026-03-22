import type { Stroke, TimelinePoint, Transform } from '../types';

// ncode coordinate system: 600/56 DPI = 1 unit = 1/56 inch
// A4: 210mm × 297mm = 8.267" × 11.693" → ncode: ~462.95 × 654.8
const NCODE_DPI = 56; // dots per inch
const A4_WIDTH_INCH = 8.267;
const A4_HEIGHT_INCH = 11.693;
export const A4_NCODE_WIDTH = A4_WIDTH_INCH * NCODE_DPI;   // ~462.95
export const A4_NCODE_HEIGHT = A4_HEIGHT_INCH * NCODE_DPI; // ~654.8

const CANVAS_W = 800;
const PADDING = 20;

export function buildTimeline(strokes: Stroke[]): { timeline: TimelinePoint[]; totalDuration: number } {
  if (strokes.length === 0) return { timeline: [], totalDuration: 0 };

  const baseTime = strokes[0].startTime;
  const timeline: TimelinePoint[] = [];

  strokes.forEach((stroke, si) => {
    let cumTime = stroke.startTime - baseTime;
    stroke.points.forEach((p, pi) => {
      if (pi > 0) cumTime += p.dt;
      timeline.push({
        absoluteTime: cumTime,
        x: p.x,
        y: p.y,
        f: p.f,
        color: stroke.color,
        strokeIdx: si,
        isFirst: pi === 0,
      });
    });
  });

  timeline.sort((a, b) => a.absoluteTime - b.absoluteTime);
  const totalDuration = timeline[timeline.length - 1].absoluteTime;
  return { timeline, totalDuration };
}

/**
 * Compute transform based on the bounding box of all strokes.
 * All renderings (images, videos) use the bbox of actual strokes,
 * not the full A4 page size.
 */
export function computeTransform(strokes: Stroke[], canvasWidth: number = CANVAS_W): Transform {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  strokes.forEach(s => s.points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }));

  if (!isFinite(minX)) {
    return { canvasH: 400, scale: 1, offsetX: 0, offsetY: 0 };
  }

  const dataW = maxX - minX || 1;
  const dataH = maxY - minY || 1;
  const aspect = dataH / dataW;

  const canvasH = Math.max(200, Math.round(canvasWidth * aspect) + PADDING * 2);
  const drawW = canvasWidth - PADDING * 2;
  const drawH = canvasH - PADDING * 2;
  const scale = Math.min(drawW / dataW, drawH / dataH);
  const offsetX = PADDING + (drawW - dataW * scale) / 2 - minX * scale;
  const offsetY = PADDING + (drawH - dataH * scale) / 2 - minY * scale;

  return { canvasH, scale, offsetX, offsetY };
}

export function tx(x: number, transform: Transform): number {
  return x * transform.scale + transform.offsetX;
}

export function ty(y: number, transform: Transform): number {
  return y * transform.scale + transform.offsetY;
}

export function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Draw strokes incrementally on a canvas context.
 * Returns the new drawnUpTo index.
 */
export function drawStrokesUpTo(
  ctx: CanvasRenderingContext2D,
  timeline: TimelinePoint[],
  transform: Transform,
  timeMs: number,
  drawnUpTo: number,
  colorOverride?: (strokeIdx: number, total: number) => string,
  totalStrokes?: number,
): number {
  let targetIdx = 0;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].absoluteTime <= timeMs) targetIdx = i + 1;
    else break;
  }

  for (let i = drawnUpTo; i < targetIdx; i++) {
    const pt = timeline[i];
    if (pt.isFirst) continue;
    const prev = timeline[i - 1];
    if (prev.strokeIdx !== pt.strokeIdx) continue;

    const lineWidth = Math.max(0.5, 1.5 * (transform.scale / 15));
    ctx.beginPath();
    ctx.moveTo(tx(prev.x, transform), ty(prev.y, transform));
    ctx.lineTo(tx(pt.x, transform), ty(pt.y, transform));
    ctx.strokeStyle = colorOverride
      ? colorOverride(pt.strokeIdx, totalStrokes ?? 0)
      : pt.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  return targetIdx;
}
