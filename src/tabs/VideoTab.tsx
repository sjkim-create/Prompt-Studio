import { useEffect, useState, useRef, useCallback } from 'react';
import type { Stroke } from '../types';
import { generateVideo } from '../export/exportVideo';
import { downloadBlob } from '../export/download';
import { VIDEO_MODELS } from '../export/evaluateWithOpenAI';
import type { EvalContext } from '../evalTypes';

interface Props {
  strokes: Stroke[];
  speed: number;
  fileName: string;
  pdfPath: string;
  cachedBlob?: Blob;
  onCacheUpdate: (blob: Blob | undefined) => void;
  onEvalContextUpdate: (ctx: EvalContext) => void;
}

export default function VideoTab({ strokes, speed, fileName, pdfPath, cachedBlob, onCacheUpdate, onEvalContextUpdate }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [localBlob, setLocalBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setVideoUrl(null); setLocalBlob(null);
  }, []);

  const generate = useCallback(async () => {
    if (strokes.length === 0) return;
    cleanup();
    setGenerating(true);
    setProgress(0);
    try {
      const blob = await generateVideo(strokes, speed, pct => setProgress(pct));
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setVideoUrl(url);
      setLocalBlob(blob);
      onCacheUpdate(blob);
    } catch (e) {
      console.error('Video generation failed:', e);
    } finally {
      setGenerating(false);
    }
  }, [strokes, speed, cleanup, onCacheUpdate]);

  useEffect(() => {
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      urlRef.current = url;
      setVideoUrl(url);
      setLocalBlob(cachedBlob);
    } else if (strokes.length > 0) {
      generate();
    }
    return cleanup;
  }, [strokes]);

  useEffect(() => {
    if (cachedBlob && !videoUrl) {
      const url = URL.createObjectURL(cachedBlob);
      urlRef.current = url;
      setVideoUrl(url);
      setLocalBlob(cachedBlob);
    }
  }, [cachedBlob]);

  useEffect(() => {
    onEvalContextUpdate({
      source: `동영상 ${speed}x`,
      plan: 'video',
      videoBlob: localBlob ?? undefined,
      speed,
      pdfPath,
      availableModels: VIDEO_MODELS,
      canEvaluate: !!localBlob,
    });
  }, [localBlob, pdfPath, speed, onEvalContextUpdate]);

  return (
    <div style={styles.root}>
      {generating && (
        <div style={styles.progressBox}>
          <div style={styles.progressText}>동영상 생성 중... {progress}%</div>
          <div style={styles.progressBarOuter}>
            <div style={{ ...styles.progressBarInner, width: `${progress}%` }} />
          </div>
        </div>
      )}

      {videoUrl && <video src={videoUrl} controls style={styles.video} autoPlay={false} />}

      {!generating && !videoUrl && strokes.length > 0 && (
        <div style={styles.placeholder}>동영상을 생성합니다...</div>
      )}

      <div style={styles.buttonRow}>
        <button style={styles.btn} onClick={() => localBlob && downloadBlob(localBlob, `${fileName}_${speed}x.webm`)} disabled={!localBlob}>
          📥 저장
        </button>
        <button style={styles.btn} onClick={() => { onCacheUpdate(undefined); generate(); }} disabled={generating}>
          🔄 새로 고침
        </button>
      </div>

      <div style={styles.pdfSection}>
        <div style={styles.pdfLabel}>문제 정보 + 채점 기준</div>
        <iframe src={`${pdfPath}#toolbar=1&navpanes=0`} style={styles.pdfViewer} title="문제 정보 + 채점 기준" />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  video: { maxWidth: 800, width: '100%', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', background: '#000' },
  progressBox: { padding: 30, textAlign: 'center' as const },
  progressText: { fontSize: '1em', color: '#aaa', marginBottom: 10 },
  progressBarOuter: { width: 400, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' as const },
  progressBarInner: { height: '100%', background: '#e94560', borderRadius: 4, transition: 'width 0.2s' },
  placeholder: { padding: 60, color: '#666', fontSize: '1em' },
  buttonRow: { marginTop: 16, display: 'flex', gap: 10 },
  btn: { padding: '8px 20px', border: 'none', borderRadius: 6, background: '#0f3460', color: '#eee', cursor: 'pointer', fontSize: '0.9em' },
  pdfSection: { marginTop: 20, width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  pdfLabel: { fontSize: '0.85em', color: '#aaa', marginBottom: 8 },
  pdfViewer: { width: '100%', height: 600, border: '1px solid #333', borderRadius: 8, background: '#fff' },
};
