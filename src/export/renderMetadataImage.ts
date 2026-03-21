import type { Stroke } from '../types';
import { computeTransform, tx, ty, formatTime } from './strokeUtils';
import { strokeColor } from './strokeColor';
import { analyzeDelays } from './delayAnalysis';

const CANVAS_W = 800;
const COLOR_BAR_HEIGHT = 30;
const COLOR_BAR_LABEL_HEIGHT = 25;
const SUMMARY_HEIGHT = 40;
const SECTION_GAP = 15;

/**
 * Render the Plan A metadata image:
 * - Main canvas with color-coded strokes (HSL gradient by order)
 * - Delay markers at significant pauses
 * - Time-proportional color bar
 * - Summary text
 */
export function renderMetadataImage(strokes: Stroke[]): HTMLCanvasElement {
  if (strokes.length === 0) {
    const c = document.createElement('canvas');
    c.width = CANVAS_W;
    c.height = 200;
    return c;
  }

  const transform = computeTransform(strokes, CANVAS_W);
  const extraHeight = SECTION_GAP + COLOR_BAR_HEIGHT + COLOR_BAR_LABEL_HEIGHT + SECTION_GAP + SUMMARY_HEIGHT + 10;
  const totalH = transform.canvasH + extraHeight;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = totalH;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const total = strokes.length;

  // 1. Draw strokes with color gradient
  strokes.forEach((stroke, si) => {
    const color = strokeColor(si, total);
    for (let pi = 1; pi < stroke.points.length; pi++) {
      const prev = stroke.points[pi - 1];
      const pt = stroke.points[pi];
      const lineWidth = Math.max(0.5, pt.f * 2.5 * (transform.scale / 15));

      ctx.beginPath();
      ctx.moveTo(tx(prev.x, transform), ty(prev.y, transform));
      ctx.lineTo(tx(pt.x, transform), ty(pt.y, transform));
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  });

  // 2. Draw delay markers
  const delays = analyzeDelays(strokes, 500);
  const markerPositions: { cx: number; cy: number; label: string }[] = [];

  delays.forEach(d => {
    const cx = tx(d.x, transform);
    const cy = ty(d.y, transform);
    const label = d.delayMs >= 1000
      ? `${(d.delayMs / 1000).toFixed(1)}s`
      : `${Math.round(d.delayMs)}ms`;

    markerPositions.push({ cx, cy, label });
  });

  // Resolve overlaps by shifting markers
  markerPositions.sort((a, b) => a.cy - b.cy);
  for (let i = 1; i < markerPositions.length; i++) {
    const prev = markerPositions[i - 1];
    const curr = markerPositions[i];
    const dist = Math.sqrt((curr.cx - prev.cx) ** 2 + (curr.cy - prev.cy) ** 2);
    if (dist < 20) {
      curr.cy = prev.cy + 20;
    }
  }

  markerPositions.forEach(m => {
    // Circle
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#e94560';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.label, m.cx + 8, m.cy);
  });

  // 3. Time-proportional color bar
  const barY = transform.canvasH + SECTION_GAP;
  const barX = 20;
  const barW = CANVAS_W - 40;

  const baseTime = strokes[0].startTime;
  const totalDuration = strokes[strokes.length - 1].endTime - baseTime;

  // Build stroke ownership: each time t maps to a stroke index
  // Stroke i owns [stroke[i].startTime - base, stroke[i+1].startTime - base)
  // Last stroke owns until its endTime
  for (let col = 0; col < barW; col++) {
    const t = (col / barW) * totalDuration;
    const absT = t + baseTime;

    // Find which stroke owns this time
    let si = 0;
    for (let i = 0; i < strokes.length; i++) {
      if (strokes[i].startTime <= absT) {
        si = i;
      } else {
        break;
      }
    }

    ctx.fillStyle = strokeColor(si, total);
    ctx.fillRect(barX + col, barY, 1, COLOR_BAR_HEIGHT);
  }

  // Bar border
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, COLOR_BAR_HEIGHT);

  // Delay tick marks on the color bar
  const labelY = barY + COLOR_BAR_HEIGHT + 3;
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Start/end time labels
  ctx.fillText('0s', barX, labelY);
  ctx.fillText(formatTime(totalDuration), barX + barW, labelY);

  // Delay markers on bar
  delays.forEach(d => {
    const delayStartTime = strokes[d.strokeIndex].startTime - baseTime;
    const xPos = barX + (delayStartTime / totalDuration) * barW;

    // Tick mark
    ctx.beginPath();
    ctx.moveTo(xPos, barY);
    ctx.lineTo(xPos, barY + COLOR_BAR_HEIGHT + 3);
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Delay label
    const label = d.delayMs >= 1000
      ? `${(d.delayMs / 1000).toFixed(1)}s`
      : `${Math.round(d.delayMs)}ms`;
    ctx.fillStyle = '#e94560';
    ctx.font = '8px sans-serif';
    ctx.fillText(label, xPos, labelY + 10);
  });

  // 4. Summary text
  const summaryY = barY + COLOR_BAR_HEIGHT + COLOR_BAR_LABEL_HEIGHT + SECTION_GAP;
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxDelay = delays.length > 0 ? Math.max(...delays.map(d => d.delayMs)) : 0;
  const summaryText = `총 획: ${total} | 총 시간: ${formatTime(totalDuration)} | 멈춤(≥0.5s): ${delays.length}회 | 최대 멈춤: ${(maxDelay / 1000).toFixed(1)}s`;
  ctx.fillText(summaryText, CANVAS_W / 2, summaryY);

  // Color legend: small gradient bar with labels
  const legendY = summaryY + 20;
  const legendW = 200;
  const legendX = (CANVAS_W - legendW) / 2;
  const legendH = 10;
  for (let col = 0; col < legendW; col++) {
    const idx = Math.floor((col / legendW) * total);
    ctx.fillStyle = strokeColor(idx, total);
    ctx.fillRect(legendX + col, legendY, 1, legendH);
  }
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(legendX, legendY, legendW, legendH);

  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'left';
  ctx.fillText('#1 (첫 획)', legendX, legendY + legendH + 3);
  ctx.textAlign = 'right';
  ctx.fillText(`#${total} (마지막)`, legendX + legendW, legendY + legendH + 3);

  return canvas;
}
