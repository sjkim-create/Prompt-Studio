import { useEffect, useState, useRef, useCallback } from 'react';
import type { Stroke } from '../types';
import { renderMetadataImage } from '../export/renderMetadataImage';
import { downloadBlob, canvasToBlob } from '../export/download';
import { ALL_MODELS } from '../export/evaluateWithOpenAI';
import type { EvalContext } from '../evalTypes';
import ImagePopup from './ImagePopup';

interface Props {
  strokes: Stroke[];
  fileName: string;
  pdfPath: string;
  cachedBlob?: Blob;
  onCacheUpdate: (blob: Blob | undefined) => void;
  onEvalContextUpdate: (ctx: EvalContext) => void;
}

export default function PlanATab({ strokes, fileName, pdfPath, onCacheUpdate, onEvalContextUpdate }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [localBlob, setLocalBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [popupImage, setPopupImage] = useState(false);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setImageUrl(null);
    setLocalBlob(null);
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
      setLocalBlob(blob);
      onCacheUpdate(blob);
    } finally {
      setGenerating(false);
    }
  }, [strokes, cleanup, onCacheUpdate]);

  useEffect(() => {
    if (strokes.length > 0) generate();
    return cleanup;
  }, [strokes]);

  // 평가 컨텍스트 등록
  useEffect(() => {
    onEvalContextUpdate({
      source: 'A안 이미지',
      plan: 'A',
      imageBlobs: localBlob ? [localBlob] : undefined,
      pdfPath,
      availableModels: ALL_MODELS,
      canEvaluate: !!localBlob,
    });
  }, [localBlob, pdfPath, onEvalContextUpdate]);

  return (
    <div style={styles.root}>
      {generating && <div style={styles.placeholder}>이미지 생성 중...</div>}

      {imageUrl && (
        <img src={imageUrl} alt="Plan A" style={styles.image} onClick={() => setPopupImage(true)} />
      )}

      {popupImage && imageUrl && (
        <ImagePopup src={imageUrl} alt="Plan A" onClose={() => setPopupImage(false)} />
      )}

      <div style={styles.buttonRow}>
        <button style={styles.btn} onClick={() => localBlob && downloadBlob(localBlob, `${fileName}_planA.png`)} disabled={!localBlob}>
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
  image: { maxWidth: 800, width: '100%', maxHeight: 'calc(100vh - 280px)', objectFit: 'contain' as const, borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', background: '#fff', cursor: 'zoom-in' },
  placeholder: { padding: 60, color: '#666', fontSize: '1em' },
  buttonRow: { marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'center' },
  btn: { padding: '8px 20px', border: 'none', borderRadius: 6, background: '#0f3460', color: '#eee', cursor: 'pointer', fontSize: '0.9em' },
  pdfSection: { marginTop: 20, width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  pdfLabel: { fontSize: '0.85em', color: '#aaa', marginBottom: 8 },
  pdfViewer: { width: '100%', height: 600, border: '1px solid #333', borderRadius: 8, background: '#fff' },
};
