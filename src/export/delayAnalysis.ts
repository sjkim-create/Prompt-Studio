import type { Stroke, DelayInfo } from '../types';

/**
 * Analyze delays between consecutive strokes.
 * Delay = stroke[i].startTime - stroke[i-1].endTime
 */
export function analyzeDelays(strokes: Stroke[], thresholdMs: number = 500): DelayInfo[] {
  const delays: DelayInfo[] = [];
  for (let i = 1; i < strokes.length; i++) {
    const delayMs = strokes[i].startTime - strokes[i - 1].endTime;
    if (delayMs >= thresholdMs) {
      delays.push({
        strokeIndex: i,
        delayMs,
        x: strokes[i].points[0].x,
        y: strokes[i].points[0].y,
      });
    }
  }
  return delays;
}

export function getDelayBetween(strokes: Stroke[], index: number): number {
  if (index <= 0 || index >= strokes.length) return 0;
  return strokes[index].startTime - strokes[index - 1].endTime;
}
