import { useEffect, useState, useRef, useCallback } from 'react';
import type { Stroke } from '../types';
import { renderMetadataImage } from '../export/renderMetadataImage';
import { renderOriginalImage } from '../export/renderOriginalImage';
import { downloadBlob, canvasToBlob } from '../export/download';
import { ALL_MODELS } from '../export/evaluateWithOpenAI';
import type { EvalContext } from '../evalTypes';
import ImagePopup from './ImagePopup';

interface Props {
  strokes: Stroke[];
  fileName: string;
  pdfPath: string;
  cachedOriginal?: Blob;
  cachedMetadata?: Blob;
  onCacheUpdate: (original: Blob | undefined, metadata: Blob | undefined) => void;
  onEvalContextUpdate: (ctx: EvalContext) => void;
}

export default function PlanBTab({ strokes, fileName, pdfPath, onCacheUpdate, onEvalContextUpdate }: Props) {
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [metaUrl, setMetaUrl] = useState<string | null>(null);
  const [localOrigBlob, setLocalOrigBlob] = useState<Blob | null>(null);
  const [localMetaBlob, setLocalMetaBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const origUrlRef = useRef<string | null>(null);
  const metaUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (origUrlRef.current) URL.revokeObjectURL(origUrlRef.current);
    if (metaUrlRef.current) URL.revokeObjectURL(metaUrlRef.current);
    origUrlRef.current = null; metaUrlRef.current = null;
    setOrigUrl(null); setMetaUrl(null);
    setLocalOrigBlob(null); setLocalMetaBlob(null);
  }, []);

  const generate = useCallback(async () => {
    if (strokes.length === 0) return;
    cleanup();
    setGenerating(true);
    try {
      const origCanvas = renderOriginalImage(strokes);
      const origBlob = await canvasToBlob(origCanvas);
      const oUrl = URL.createObjectURL(origBlob);
      origUrlRef.current = oUrl; setOrigUrl(oUrl); setLocalOrigBlob(origBlob);

      const metaCanvas = renderMetadataImage(strokes);
      const metaBlob = await canvasToBlob(metaCanvas);
      const mUrl = URL.createObjectURL(metaBlob);
      metaUrlRef.current = mUrl; setMetaUrl(mUrl); setLocalMetaBlob(metaBlob);

      onCacheUpdate(origBlob, metaBlob);
    } finally {
      setGenerating(false);
    }
  }, [strokes, cleanup, onCacheUpdate]);

  useEffect(() => {
    if (strokes.length > 0) generate();
    return cleanup;
  }, [strokes]);

  useEffect(() => {
    onEvalContextUpdate({
      source: 'B안 이미지',
      plan: 'B',
      imageBlobs: localOrigBlob && localMetaBlob ? [localOrigBlob, localMetaBlob] : undefined,
      pdfPath,
      availableModels: ALL_MODELS,
      canEvaluate: !!localOrigBlob && !!localMetaBlob,
    });
  }, [localOrigBlob, localMetaBlob, pdfPath, onEvalContextUpdate]);

  const handleSave = useCallback(() => {
    if (localOrigBlob) downloadBlob(localOrigBlob, `${fileName}_planB_original.png`);
    if (localMetaBlob) downloadBlob(localMetaBlob, `${fileName}_planB_metadata.png`);
  }, [localOrigBlob, localMetaBlob, fileName]);

  return (
    <div style={styles.root}>
      {generating && <div style={styles.placeholder}>이미지 생성 중...</div>}

      {(origUrl || metaUrl) && (
        <div style={styles.imageRow}>
          <div style={styles.imageCol}>
            <div style={styles.imageLabel}>원본 필기</div>
            {origUrl && <img src={origUrl} alt="Original" style={styles.image} onClick={() => setPopupImage(origUrl)} />}
          </div>
          <div style={styles.imageCol}>
            <div style={styles.imageLabel}>메타데이터 (색상 순서 + 딜레이)</div>
            {metaUrl && <img src={metaUrl} alt="Metadata" style={styles.image} onClick={() => setPopupImage(metaUrl)} />}
          </div>
        </div>
      )}

      {popupImage && <ImagePopup src={popupImage} alt="Plan B" onClose={() => setPopupImage(null)} />}

      <div style={styles.buttonRow}>
        <button style={styles.btn} onClick={handleSave} disabled={!localOrigBlob}>📥 2개 저장</button>
        <button style={styles.btn} onClick={() => { onCacheUpdate(undefined, undefined); generate(); }} disabled={generating}>🔄 새로 고침</button>
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
  imageRow: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, justifyContent: 'center' },
  imageCol: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  imageLabel: { fontSize: '0.85em', color: '#aaa', marginBottom: 6 },
  image: { maxWidth: 390, width: '100%', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', background: '#fff', cursor: 'zoom-in' },
  placeholder: { padding: 60, color: '#666', fontSize: '1em' },
  buttonRow: { marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'center' },
  btn: { padding: '8px 20px', border: 'none', borderRadius: 6, background: '#0f3460', color: '#eee', cursor: 'pointer', fontSize: '0.9em' },
  pdfSection: { marginTop: 20, width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  pdfLabel: { fontSize: '0.85em', color: '#aaa', marginBottom: 8 },
  pdfViewer: { width: '100%', height: 600, border: '1px solid #333', borderRadius: 8, background: '#fff' },
};
