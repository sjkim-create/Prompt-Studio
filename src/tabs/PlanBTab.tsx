import { useEffect, useState, useRef, useCallback } from 'react';
import type { Stroke } from '../types';
import { renderMetadataImage } from '../export/renderMetadataImage';
import { renderOriginalImage } from '../export/renderOriginalImage';
import { downloadBlob, canvasToBlob } from '../export/download';

interface Props {
  strokes: Stroke[];
  fileName: string;
  cachedOriginal?: Blob;
  cachedMetadata?: Blob;
  onCacheUpdate: (original: Blob | undefined, metadata: Blob | undefined) => void;
}

export default function PlanBTab({ strokes, fileName, cachedOriginal, cachedMetadata, onCacheUpdate }: Props) {
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [metaUrl, setMetaUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const origUrlRef = useRef<string | null>(null);
  const metaUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (origUrlRef.current) URL.revokeObjectURL(origUrlRef.current);
    if (metaUrlRef.current) URL.revokeObjectURL(metaUrlRef.current);
    origUrlRef.current = null;
    metaUrlRef.current = null;
    setOrigUrl(null);
    setMetaUrl(null);
  }, []);

  const generate = useCallback(async () => {
    if (strokes.length === 0) return;
    cleanup();
    setGenerating(true);
    try {
      const origCanvas = renderOriginalImage(strokes);
      const origBlob = await canvasToBlob(origCanvas);
      const oUrl = URL.createObjectURL(origBlob);
      origUrlRef.current = oUrl;
      setOrigUrl(oUrl);

      const metaCanvas = renderMetadataImage(strokes);
      const metaBlob = await canvasToBlob(metaCanvas);
      const mUrl = URL.createObjectURL(metaBlob);
      metaUrlRef.current = mUrl;
      setMetaUrl(mUrl);

      onCacheUpdate(origBlob, metaBlob);
    } finally {
      setGenerating(false);
    }
  }, [strokes, cleanup, onCacheUpdate]);

  useEffect(() => {
    if (cachedOriginal && cachedMetadata) {
      const oUrl = URL.createObjectURL(cachedOriginal);
      const mUrl = URL.createObjectURL(cachedMetadata);
      origUrlRef.current = oUrl;
      metaUrlRef.current = mUrl;
      setOrigUrl(oUrl);
      setMetaUrl(mUrl);
    } else if (strokes.length > 0) {
      generate();
    }
    return cleanup;
  }, [strokes]);

  useEffect(() => {
    if (cachedOriginal && !origUrl) {
      const oUrl = URL.createObjectURL(cachedOriginal);
      origUrlRef.current = oUrl;
      setOrigUrl(oUrl);
    }
    if (cachedMetadata && !metaUrl) {
      const mUrl = URL.createObjectURL(cachedMetadata);
      metaUrlRef.current = mUrl;
      setMetaUrl(mUrl);
    }
  }, [cachedOriginal, cachedMetadata]);

  const handleRefresh = useCallback(() => {
    onCacheUpdate(undefined, undefined);
    generate();
  }, [generate, onCacheUpdate]);

  const handleSave = useCallback(() => {
    if (cachedOriginal) downloadBlob(cachedOriginal, `${fileName}_planB_original.png`);
    if (cachedMetadata) downloadBlob(cachedMetadata, `${fileName}_planB_metadata.png`);
  }, [cachedOriginal, cachedMetadata, fileName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {generating && <div style={styles.placeholder}>이미지 생성 중...</div>}

      {(origUrl || metaUrl) && (
        <div style={styles.imageRow}>
          <div style={styles.imageCol}>
            <div style={styles.imageLabel}>원본 필기</div>
            {origUrl && <img src={origUrl} alt="Original" style={styles.image} />}
          </div>
          <div style={styles.imageCol}>
            <div style={styles.imageLabel}>메타데이터 (색상 순서 + 딜레이)</div>
            {metaUrl && <img src={metaUrl} alt="Metadata" style={styles.image} />}
          </div>
        </div>
      )}

      <div style={styles.buttonRow}>
        <button style={styles.btn} onClick={handleSave} disabled={!cachedOriginal}>
          📥 2개 저장
        </button>
        <button style={styles.btn} onClick={handleRefresh} disabled={generating}>
          🔄 새로 고침
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  imageRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  imageCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: '0.85em',
    color: '#aaa',
    marginBottom: 6,
  },
  image: {
    maxWidth: 390,
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
