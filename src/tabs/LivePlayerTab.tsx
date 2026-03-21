import { useRef, useEffect, useState, useCallback } from 'react';
import type { Stroke, TimelinePoint, Transform } from '../types';
import { buildTimeline, computeTransform, tx, ty, formatTime, drawStrokesUpTo } from '../export/strokeUtils';
import { renderMetadataImage } from '../export/renderMetadataImage';
import { renderOriginalImage } from '../export/renderOriginalImage';
import { generateVideo } from '../export/exportVideo';
import { downloadBlob, canvasToBlob } from '../export/download';

const CANVAS_W = 800;

interface Props {
  strokes: Stroke[];
  fileName: string;
}

export default function LivePlayerTab({ strokes, fileName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [canvasH, setCanvasH] = useState(400);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');

  const timelineRef = useRef<TimelinePoint[]>([]);
  const totalDurationRef = useRef(0);
  const transformRef = useRef<Transform>({ canvasH: 400, scale: 1, offsetX: 0, offsetY: 0 });
  const drawnUpToRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const playStartWallRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const animFrameRef = useRef(0);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawnUpToRef.current = 0;
  }, []);

  const drawUpTo = useCallback((timeMs: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    drawnUpToRef.current = drawStrokesUpTo(
      ctx, timelineRef.current, transformRef.current, timeMs, drawnUpToRef.current
    );
  }, []);

  const redrawFromScratch = useCallback((timeMs: number) => {
    clearCanvas();
    drawUpTo(timeMs);
  }, [clearCanvas, drawUpTo]);

  useEffect(() => {
    if (strokes.length === 0) return;
    playingRef.current = false;
    setPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const { timeline, totalDuration } = buildTimeline(strokes);
    timelineRef.current = timeline;
    totalDurationRef.current = totalDuration;

    const transform = computeTransform(strokes, CANVAS_W);
    transformRef.current = transform;
    setCanvasH(transform.canvasH);
    currentOffsetRef.current = 0;
    setProgress(0);
  }, [strokes]);

  useEffect(() => {
    if (strokes.length === 0) return;
    clearCanvas();
  }, [strokes, canvasH, clearCanvas]);

  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const elapsed = (performance.now() - playStartWallRef.current) * speedRef.current;
    let offset = playStartOffsetRef.current + elapsed;

    if (offset >= totalDurationRef.current) {
      offset = totalDurationRef.current;
      drawUpTo(offset);
      currentOffsetRef.current = offset;
      setProgress(1000);
      setPlaying(false);
      playingRef.current = false;
      return;
    }

    drawUpTo(offset);
    currentOffsetRef.current = offset;
    setProgress(totalDurationRef.current > 0 ? (offset / totalDurationRef.current) * 1000 : 0);
    animFrameRef.current = requestAnimationFrame(tick);
  }, [drawUpTo]);

  const handlePlay = useCallback(() => {
    if (playingRef.current) return;
    if (currentOffsetRef.current >= totalDurationRef.current) {
      currentOffsetRef.current = 0;
      clearCanvas();
    }
    playingRef.current = true;
    setPlaying(true);
    playStartWallRef.current = performance.now();
    playStartOffsetRef.current = currentOffsetRef.current;
    animFrameRef.current = requestAnimationFrame(tick);
  }, [tick, clearCanvas]);

  const handlePause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleReset = useCallback(() => {
    handlePause();
    currentOffsetRef.current = 0;
    setProgress(0);
    clearCanvas();
  }, [handlePause, clearCanvas]);

  const handleSeek = useCallback((value: number) => {
    const wasPlaying = playingRef.current;
    if (wasPlaying) handlePause();
    const offset = (value / 1000) * totalDurationRef.current;
    currentOffsetRef.current = offset;
    setProgress(value);
    redrawFromScratch(offset);
    if (wasPlaying) {
      playingRef.current = true;
      setPlaying(true);
      playStartWallRef.current = performance.now();
      playStartOffsetRef.current = offset;
      animFrameRef.current = requestAnimationFrame(tick);
    }
  }, [handlePause, redrawFromScratch, tick]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    const wasPlaying = playingRef.current;
    if (wasPlaying) handlePause();
    speedRef.current = newSpeed;
    setSpeed(newSpeed);
    if (wasPlaying) {
      playingRef.current = true;
      setPlaying(true);
      playStartWallRef.current = performance.now();
      playStartOffsetRef.current = currentOffsetRef.current;
      animFrameRef.current = requestAnimationFrame(tick);
    }
  }, [handlePause, tick]);

  const handleSaveAll = useCallback(async () => {
    if (saving || strokes.length === 0) return;
    setSaving(true);
    try {
      setSaveProgress('A안 이미지 생성 중...');
      const metaCanvas = renderMetadataImage(strokes);
      const metaBlob = await canvasToBlob(metaCanvas);
      downloadBlob(metaBlob, `${fileName}_planA.png`);

      setSaveProgress('B안 원본 이미지 생성 중...');
      const origCanvas = renderOriginalImage(strokes);
      const origBlob = await canvasToBlob(origCanvas);
      downloadBlob(origBlob, `${fileName}_planB_original.png`);

      setSaveProgress('B안 메타데이터 이미지 생성 중...');
      downloadBlob(metaBlob, `${fileName}_planB_metadata.png`);

      setSaveProgress('동영상(1x) 생성 중...');
      const videoBlob = await generateVideo(strokes, 1, pct => {
        setSaveProgress(`동영상(1x) 생성 중... ${pct}%`);
      });
      downloadBlob(videoBlob, `${fileName}_1x.webm`);

      setSaveProgress('완료!');
      setTimeout(() => setSaveProgress(''), 2000);
    } catch (e) {
      setSaveProgress(`오류: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [saving, strokes, fileName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={canvasH}
          style={{
            ...styles.canvas,
            width: '100%',
            maxHeight: 'calc(100vh - 280px)',
            objectFit: 'contain' as const,
          }}
        />
      </div>

      <div style={styles.row}>
        <button style={{ ...styles.btn, ...(playing ? styles.btnActive : {}) }} onClick={handlePlay} disabled={playing}>
          ▶ 재생
        </button>
        <button style={styles.btn} onClick={handlePause} disabled={!playing}>
          ⏸ 일시정지
        </button>
        <button style={styles.btn} onClick={handleReset}>
          ⏹ 처음으로
        </button>
        <div style={styles.speedWrap}>
          <label style={styles.label}>속도:</label>
          <select style={styles.selectSmall} value={speed} onChange={e => handleSpeedChange(Number(e.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
          </select>
        </div>
      </div>

      <div style={styles.progressWrap}>
        <span style={styles.time}>
          {formatTime(currentOffsetRef.current)} / {formatTime(totalDurationRef.current)}
        </span>
        <input type="range" min={0} max={1000} value={progress} onChange={e => handleSeek(Number(e.target.value))} style={styles.slider} />
      </div>

      <div style={styles.info}>
        획 수: {strokes.length} | 총 시간: {formatTime(totalDurationRef.current)}
      </div>

      <div style={{ marginTop: 16 }}>
        <button style={{ ...styles.btn, padding: '10px 30px', background: '#e94560' }} onClick={handleSaveAll} disabled={saving}>
          {saving ? saveProgress : '📥 4개 모두 저장'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvasWrap: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    display: 'inline-block',
    marginBottom: 16,
  },
  canvas: { display: 'block', borderRadius: 8 },
  row: {
    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'center', marginBottom: 8,
  },
  btn: {
    padding: '8px 20px', border: 'none', borderRadius: 6, background: '#0f3460', color: '#eee', cursor: 'pointer', fontSize: '0.9em',
  },
  btnActive: { background: '#e94560' },
  speedWrap: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85em', color: '#aaa' },
  label: { fontSize: '0.9em', color: '#aaa' },
  selectSmall: { padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#16213e', color: '#eee' },
  progressWrap: { marginTop: 8, width: '100%', maxWidth: 800, display: 'flex', alignItems: 'center', gap: 10 },
  time: { fontSize: '0.85em', color: '#aaa', minWidth: 100, textAlign: 'center' as const },
  slider: { flex: 1, height: 6, cursor: 'pointer' },
  info: { marginTop: 8, fontSize: '0.8em', color: '#666' },
};
