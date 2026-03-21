import { useEffect, useState, useRef, useCallback } from 'react';
import type { Stroke } from '../types';
import { renderMetadataImage } from '../export/renderMetadataImage';
import { downloadBlob, canvasToBlob } from '../export/download';

interface Props {
  strokes: Stroke[];
  fileName: string;
  cachedBlob?: Blob;
  onCacheUpdate: (blob: Blob | undefined) => void;
}

export default function PlanATab({ strokes, fileName, cachedBlob, onCacheUpdate }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setImageUrl(null);
  }, []);

  const generate = useCallback(async () => {
    if (strokes.length === 0) return;
    cleanup();
    setGenerating(true);
    try {
      const canvas = renderMetadataImage(strokes);
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setImageUrl(url);
      onCacheUpdate(blob);
    } finally {
      setGenerating(false);
    }
  }, [strokes, cleanup, onCacheUpdate]);

  useEffect(() => {
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      urlRef.current = url;
      setImageUrl(url);
    } else if (strokes.length > 0) {
      generate();
    }
    return cleanup;
  }, [strokes]);

  useEffect(() => {
    if (cachedBlob && !imageUrl) {
      const url = URL.createObjectURL(cachedBlob);
      urlRef.current = url;
      setImageUrl(url);
    }
  }, [cachedBlob]);

  const handleRefresh = useCallback(() => {
    onCacheUpdate(undefined);
    generate();
  }, [generate, onCacheUpdate]);

  const handleSave = useCallback(() => {
    if (cachedBlob) {
      downloadBlob(cachedBlob, `${fileName}_planA.png`);
    }
  }, [cachedBlob, fileName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {generating && <div style={styles.placeholder}>이미지 생성 중...</div>}

      {imageUrl && (
        <img src={imageUrl} alt="Plan A metadata" style={styles.image} />
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
  image: {
    maxWidth: 800,
    width: '100%',
    borderRadius: 8,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    background: '#fff',
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
