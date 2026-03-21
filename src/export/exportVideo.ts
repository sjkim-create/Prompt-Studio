import type { Stroke } from '../types';
import { buildTimeline, computeTransform, drawStrokesUpTo } from './strokeUtils';

const CANVAS_W = 800;
const FPS = 30;

/**
 * Generate a WebM video of the stroke replay.
 * @param strokes - stroke data
 * @param speed - playback speed multiplier (1 = real-time, 2 = 2x)
 * @param onProgress - progress callback (0-100)
 */
export function generateVideo(
  strokes: Stroke[],
  speed: number,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (strokes.length === 0) {
      reject(new Error('No strokes'));
      return;
    }

    const { timeline, totalDuration } = buildTimeline(strokes);
    const transform = computeTransform(strokes, CANVAS_W);

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = transform.canvasH;
    const ctx = canvas.getContext('2d')!;

    // Initial white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Setup MediaRecorder
    const stream = canvas.captureStream(FPS);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    recorder.onerror = () => reject(new Error('MediaRecorder error'));

    recorder.start(100); // collect data every 100ms

    // Animation loop: render frames as fast as possible
    let drawnUpTo = 0;
    let simTime = 0;
    const frameInterval = (1000 / FPS) * speed; // how much sim time per frame
    let cancelled = false;

    function renderFrame() {
      if (cancelled) return;

      if (simTime >= totalDuration) {
        // Draw final state
        drawnUpTo = drawStrokesUpTo(ctx, timeline, transform, totalDuration, drawnUpTo);
        onProgress?.(100);
        recorder.stop();
        return;
      }

      drawnUpTo = drawStrokesUpTo(ctx, timeline, transform, simTime, drawnUpTo);
      onProgress?.(Math.round((simTime / totalDuration) * 100));

      simTime += frameInterval;
      requestAnimationFrame(renderFrame);
    }

    renderFrame();
  });
}
