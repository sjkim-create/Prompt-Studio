export interface StrokePoint {
  x: number;
  y: number;
  f: number; // pressure 0~1
  dt: number; // delta time in ms from previous point
}

export interface Stroke {
  id: string;
  color: string;
  startTime: number; // absolute timestamp ms
  endTime: number;
  brushType: number;
  dotCount: number;
  points: StrokePoint[];
  dots: string;
}

export interface StrokeData {
  section: number;
  owner: number;
  bookCode: number;
  pageNumber: number;
  nid: string;
  pid: string;
  strokes: Stroke[];
}

export interface TimelinePoint {
  absoluteTime: number; // ms from start
  x: number;
  y: number;
  f: number;
  color: string;
  strokeIdx: number;
  isFirst: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  pdfPath: string;
}

export interface DelayInfo {
  strokeIndex: number;
  delayMs: number;
  x: number;
  y: number;
}

export interface Transform {
  canvasH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ExportCache {
  video1x?: Blob;
  video2x?: Blob;
  planAImage?: Blob;
  planBOriginal?: Blob;
  planBMetadata?: Blob;
}
