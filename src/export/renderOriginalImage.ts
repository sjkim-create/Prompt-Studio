import type { Stroke } from '../types';
import { computeTransform, tx, ty } from './strokeUtils';

const CANVAS_W = 800;

/**
 * Render all strokes in original black color on white background.
 * Used for Plan B Image 1.
 */
export function renderOriginalImage(strokes: Stroke[]): HTMLCanvasElement {
  const transform = computeTransform(strokes, CANVAS_W);
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = transform.canvasH;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  strokes.forEach(stroke => {
    for (let pi = 1; pi < stroke.points.length; pi++) {
      const prev = stroke.points[pi - 1];
      const pt = stroke.points[pi];
      const lineWidth = Math.max(0.5, pt.f * 2.5 * (transform.scale / 15));

      ctx.beginPath();
      ctx.moveTo(tx(prev.x, transform), ty(prev.y, transform));
      ctx.lineTo(tx(pt.x, transform), ty(pt.y, transform));
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  });

  return canvas;
}
