import { useState, useEffect, useRef, useCallback } from 'react';
import type { Stroke, StrokeData } from './types';
import { FILES } from './files';
import type { EvalContext, EvalHistoryEntry, AttachedFileInfo } from './evalTypes';
import { evaluateWithOpenAI, loadPromptText, DEFAULT_MODEL, DEFAULT_VIDEO_MODEL, ALL_MODELS } from './export/evaluateWithOpenAI';
import type { EvaluateResult, PlanType } from './export/evaluateWithOpenAI';
import { loadAllHistory, saveHistoryEntry, loadEditedPrompt, saveEditedPrompt, clearEditedPrompt } from './db';
import LivePlayerTab from './tabs/LivePlayerTab';
import VideoTab from './tabs/VideoTab';
import PlanATab from './tabs/PlanATab';
import PlanBTab from './tabs/PlanBTab';
import PromptSidebar from './tabs/PromptSidebar';
import PanelResizer from './tabs/PanelResizer';
import EvaluationPanel from './tabs/EvaluationPanel';

type TabId = 'live' | 'video1x' | 'video2x' | 'planA' | 'planB';

const TABS: { id: TabId; label: string }[] = [
  { id: 'planA', label: 'A안 이미지' },
  { id: 'planB', label: 'B안 이미지' },
  { id: 'video1x', label: '동영상 1x' },
  { id: 'video2x', label: '동영상 2x' },
  { id: 'live', label: '실시간 재생' },
];

interface Cache {
  video1x?: Blob;
  video2x?: Blob;
  planA?: Blob;
  planBOriginal?: Blob;
  planBMetadata?: Blob;
}

function tabToPlanType(tab: TabId): PlanType | null {
  switch (tab) {
    case 'planA': return 'A';
    case 'planB': return 'B';
    case 'video1x': case 'video2x': return 'video';
    default: return null;
  }
}

function tabToSpeed(tab: TabId): number | undefined {
  if (tab === 'video1x') return 1;
  if (tab === 'video2x') return 2;
  return undefined;
}

function tabToPromptKey(tab: TabId): string {
  if (tab === 'video1x' || tab === 'video2x') return 'video';
  if (tab === 'planB') return 'B';
  return 'A';
}

function App() {
  const [fileIdx, setFileIdx] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('planA');
  const cacheRef = useRef<Cache>({});

  // 공유 평가 상태
  const [evalContext, setEvalContext] = useState<EvalContext | null>(null);
  const [history, setHistory] = useState<EvalHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [runningCount, setRunningCount] = useState(0);
  const [leftWidth, setLeftWidth] = useState(340);
  const [rightWidth, setRightWidth] = useState(460);
  const [evalProgress, setEvalProgress] = useState('');
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

  // 프롬프트 사이드바
  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const originalPromptRef = useRef('');

  const fileName = FILES[fileIdx].name.replace(/\s+/g, '_');
  const pdfPath = FILES[fileIdx].pdfPath;

  // DB에서 히스토리 로드
  useEffect(() => {
    loadAllHistory().then(setHistory).catch(console.error);
  }, []);

  // 파일 로드
  useEffect(() => {
    const load = async () => {
      const resp = await fetch(FILES[fileIdx].path);
      const data: StrokeData[] = await resp.json();
      setStrokes(data[0].strokes);
      cacheRef.current = {};
      setActiveTab('planA');
    };
    load();
  }, [fileIdx]);

  // 탭 전환 시 프롬프트 로딩 + 모델 조정
  useEffect(() => {
    const plan = tabToPlanType(activeTab);
    if (!plan) { setPromptText(''); return; }

    const key = tabToPromptKey(activeTab);
    const speed = tabToSpeed(activeTab);

    setPromptLoading(true);
    (async () => {
      const saved = await loadEditedPrompt(key).catch(() => null);
      if (saved) {
        setPromptText(saved);
        originalPromptRef.current = await loadPromptText(plan, speed);
      } else {
        const text = await loadPromptText(plan, speed);
        setPromptText(text);
        originalPromptRef.current = text;
      }
      setPromptLoading(false);
    })();

    // video 탭이면 Gemini로 자동 전환
    if (plan === 'video') {
      const currentModel = ALL_MODELS.find(m => m.id === selectedModel);
      if (!currentModel || currentModel.provider !== 'gemini') {
        setSelectedModel(DEFAULT_VIDEO_MODEL);
      }
    }
  }, [activeTab]);

  // 프롬프트 편집 저장 (debounce)
  useEffect(() => {
    if (promptLoading || !promptText) return;
    const key = tabToPromptKey(activeTab);
    const timer = setTimeout(() => {
      if (promptText !== originalPromptRef.current) {
        saveEditedPrompt(key, promptText).catch(console.error);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [promptText, activeTab, promptLoading]);

  const handlePromptReset = useCallback(async () => {
    const plan = tabToPlanType(activeTab);
    if (!plan) return;
    const key = tabToPromptKey(activeTab);
    await clearEditedPrompt(key).catch(console.error);
    const text = await loadPromptText(plan, tabToSpeed(activeTab));
    setPromptText(text);
    originalPromptRef.current = text;
  }, [activeTab]);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth(w => Math.max(200, Math.min(600, w + delta)));
  }, []);
  const handleRightResize = useCallback((delta: number) => {
    setRightWidth(w => Math.max(280, Math.min(700, w + delta)));
  }, []);

  // 첨부 파일 목록
  const attachedFiles: AttachedFileInfo[] = [];
  if (evalContext) {
    if (evalContext.imageBlobs) {
      evalContext.imageBlobs.forEach((b, i) => {
        const label = evalContext.plan === 'A' ? '메타데이터 이미지' : i === 0 ? '원본 필기' : '메타데이터';
        attachedFiles.push({ label, type: 'image', size: b.size });
      });
    }
    if (evalContext.videoBlob) {
      attachedFiles.push({ label: `동영상 ${evalContext.speed}x`, type: 'video', size: evalContext.videoBlob.size });
    }
    attachedFiles.push({ label: '문제 정보 + 채점 기준.pdf', type: 'pdf' });
  }

  // 평가 실행 (병렬 가능)
  const handleEvaluate = useCallback(async () => {
    if (!evalContext?.canEvaluate) return;
    const ctx = { ...evalContext };
    const model = selectedModel;
    const prompt = promptText;
    const file = FILES[fileIdx].name;

    setRunningCount(c => c + 1);
    setEvalError(null);
    setEvalProgress('준비 중...');
    setStreamingContent('');
    setSelectedHistoryId(null);
    try {
      const result: EvaluateResult = await evaluateWithOpenAI({
        plan: ctx.plan,
        model,
        imageBlobs: ctx.imageBlobs,
        videoBlob: ctx.videoBlob,
        speed: ctx.speed,
        pdfPath: ctx.pdfPath,
        customPrompt: prompt,
        onProgress: setEvalProgress,
        onStream: setStreamingContent,
      });
      setStreamingContent(null);
      const modelInfo = ALL_MODELS.find(m => m.id === result.model);
      const entry: EvalHistoryEntry = {
        id: `${Date.now()}`,
        source: ctx.source,
        modelId: result.model,
        modelLabel: modelInfo?.label ?? result.model,
        timestamp: Date.now(),
        content: result.content,
        usage: result.usage,
        costUsd: result.costUsd,
        promptText: prompt,
        fileName: file,
      };
      setHistory(prev => [entry, ...prev]);
      setSelectedHistoryId(entry.id);
      await saveHistoryEntry(entry).catch(console.error);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : String(err));
      setStreamingContent(null);
    } finally {
      setRunningCount(c => c - 1);
      setEvalProgress('');
    }
  }, [evalContext, selectedModel, promptText, fileIdx]);

  // 캐시 콜백
  const setCacheVideo1x = useCallback((b: Blob | undefined) => { cacheRef.current = { ...cacheRef.current, video1x: b }; }, []);
  const setCacheVideo2x = useCallback((b: Blob | undefined) => { cacheRef.current = { ...cacheRef.current, video2x: b }; }, []);
  const setCachePlanA = useCallback((b: Blob | undefined) => { cacheRef.current = { ...cacheRef.current, planA: b }; }, []);
  const setCachePlanB = useCallback((o: Blob | undefined, m: Blob | undefined) => { cacheRef.current = { ...cacheRef.current, planBOriginal: o, planBMetadata: m }; }, []);

  const handleEvalContextUpdate = useCallback((ctx: EvalContext) => {
    setEvalContext(ctx);
  }, []);

  const isEvalTab = activeTab !== 'live';
  const evaluating = runningCount > 0;
  const streamingModelLabel = ALL_MODELS.find(m => m.id === selectedModel)?.label ?? selectedModel;

  return (
    <div style={styles.container}>
      <div style={styles.headerBar}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>필기 획 재생기</h1>
          <div style={styles.fileRow}>
            <label style={styles.label}>파일:</label>
            <select style={styles.select} value={fileIdx} onChange={e => setFileIdx(Number(e.target.value))}>
              {FILES.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
            </select>
          </div>
          <div style={styles.tabBar}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.mainArea}>
        {/* 왼쪽 프롬프트 사이드바 */}
        {isEvalTab && (
          <>
            <div style={{ width: leftWidth, flexShrink: 0, display: 'flex' }}>
              <PromptSidebar
                promptText={promptText}
                onPromptChange={setPromptText}
                loading={promptLoading}
                attachedFiles={attachedFiles}
                onReset={handlePromptReset}
              />
            </div>
            <PanelResizer side="left" onResize={handleLeftResize} />
          </>
        )}

        {/* 가운데 탭 콘텐츠 */}
        <div style={styles.centerPane}>
          {activeTab === 'planA' && (
            <PlanATab strokes={strokes} fileName={fileName} pdfPath={pdfPath}
              cachedBlob={cacheRef.current.planA} onCacheUpdate={setCachePlanA}
              onEvalContextUpdate={handleEvalContextUpdate} />
          )}
          {activeTab === 'planB' && (
            <PlanBTab strokes={strokes} fileName={fileName} pdfPath={pdfPath}
              cachedOriginal={cacheRef.current.planBOriginal} cachedMetadata={cacheRef.current.planBMetadata}
              onCacheUpdate={setCachePlanB} onEvalContextUpdate={handleEvalContextUpdate} />
          )}
          {activeTab === 'video1x' && (
            <VideoTab strokes={strokes} speed={1} fileName={fileName} pdfPath={pdfPath}
              cachedBlob={cacheRef.current.video1x} onCacheUpdate={setCacheVideo1x}
              onEvalContextUpdate={handleEvalContextUpdate} />
          )}
          {activeTab === 'video2x' && (
            <VideoTab strokes={strokes} speed={2} fileName={fileName} pdfPath={pdfPath}
              cachedBlob={cacheRef.current.video2x} onCacheUpdate={setCacheVideo2x}
              onEvalContextUpdate={handleEvalContextUpdate} />
          )}
          {activeTab === 'live' && (
            <LivePlayerTab strokes={strokes} fileName={fileName} />
          )}
        </div>

        {/* 오른쪽 평가 패널 */}
        {isEvalTab && (
          <>
            <PanelResizer side="right" onResize={handleRightResize} />
            <div style={{ width: rightWidth, flexShrink: 0, display: 'flex' }}>
              <EvaluationPanel
                history={history}
                selectedId={selectedHistoryId}
                onSelect={setSelectedHistoryId}
                streamingContent={streamingContent}
                streamingModelLabel={streamingModelLabel}
                availableModels={evalContext?.availableModels ?? ALL_MODELS}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                onEvaluate={handleEvaluate}
                evaluating={evaluating}
                evalProgress={evalProgress}
                evalError={evalError}
                canEvaluate={evalContext?.canEvaluate ?? false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#1a1a2e',
    color: '#eee',
    fontFamily: "'Segoe UI', sans-serif",
    overflow: 'hidden',
  },
  headerBar: {
    padding: '8px 16px 0',
    flexShrink: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.2em',
    color: '#e0e0e0',
  },
  fileRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  label: {
    fontSize: '0.85em',
    color: '#aaa',
  },
  select: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#16213e',
    color: '#eee',
    fontSize: '0.85em',
    maxWidth: 300,
  },
  tabBar: {
    display: 'flex',
    gap: 3,
    alignItems: 'center',
  },
  tab: {
    padding: '6px 14px',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: '2px solid transparent',
    borderRadius: '6px 6px 0 0',
    background: '#16213e',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.8em',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#0f3460',
    color: '#fff',
    fontWeight: 'bold',
    borderBottom: '2px solid #e94560',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
  },
  centerPane: {
    flex: 1,
    overflow: 'auto',
    padding: '0 10px',
    minWidth: 0,
  },
};
