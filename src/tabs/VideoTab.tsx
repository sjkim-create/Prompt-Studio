import { useEffect, useState, useRef, useCallback } from 'react';
import type { Stroke } from '../types';
import { generateVideo } from '../export/exportVideo';
import { downloadBlob } from '../export/download';

interface Props {
  strokes: Stroke[];
  speed: number;
  fileName: string;
  cachedBlob?: Blob;
  onCacheUpdate: (blob: Blob | undefined) => void;
}

export default function VideoTab({ strokes, speed, fileName, cachedBlob, onCacheUpdate }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setVideoUrl(null);
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
      onCacheUpdate(blob);
    } catch (e) {
      console.error('Video generation failed:', e);
    } finally {
      setGenerating(false);
    }
  }, [strokes, speed, cleanup, onCacheUpdate]);

  // When tab activates or strokes change, use cache or generate
  useEffect(() => {
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      urlRef.current = url;
      setVideoUrl(url);
    } else if (strokes.length > 0) {
      generate();
    }
    return cleanup;
  }, [strokes]); // intentionally only on strokes change

  // Show cached blob when available
  useEffect(() => {
    if (cachedBlob && !videoUrl) {
      const url = URL.createObjectURL(cachedBlob);
      urlRef.current = url;
      setVideoUrl(url);
    }
  }, [cachedBlob]);

  const handleRefresh = useCallback(() => {
    onCacheUpdate(undefined);
    generate();
  }, [generate, onCacheUpdate]);

  const handleSave = useCallback(() => {
    if (cachedBlob) {
      downloadBlob(cachedBlob, `${fileName}_${speed}x.webm`);
    }
  }, [cachedBlob, fileName, speed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {generating && (
        <div style={styles.progressBox}>
          <div style={styles.progressText}>동영상 생성 중... {progress}%</div>
          <div style={styles.progressBarOuter}>
            <div style={{ ...styles.progressBarInner, width: `${progress}%` }} />
          </div>
        </div>
      )}

      {videoUrl && (
        <video
          src={videoUrl}
          controls
          style={styles.video}
          autoPlay={false}
        />
      )}

      {!generating && !videoUrl && strokes.length > 0 && (
        <div style={styles.placeholder}>동영상을 생성합니다...</div>
      )}

      <div style={styles.buttonRow}>
        <button style={styles.btn} onClick={handleSave} disabled={!cachedBlob}>
          📥 저장
        </button>
        <button style={styles.btn} onClick={handleRefresh} disabled={generating}>
          🔄 새로 고침
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  video: {
    maxWidth: 800,
    width: '100%',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    background: '#000',
  },
  progressBox: {
    padding: 30,
    textAlign: 'center' as const,
  },
  progressText: {
    fontSize: '1em',
    color: '#aaa',
    marginBottom: 10,
  },
  progressBarOuter: {
    width: 400,
    height: 8,
    background: '#333',
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  progressBarInner: {
    height: '100%',
    background: '#e94560',
    borderRadius: 4,
    transition: 'width 0.2s',
  },
  placeholder: {
    padding: 60,
    color: '#666',
    fontSize: '1em',
  },
  buttonRow: {
    marginTop: 16,
    display: 'flex',
    gap: 10,
  },
  btn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 6,
    background: '#0f3460',
    color: '#eee',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
};
