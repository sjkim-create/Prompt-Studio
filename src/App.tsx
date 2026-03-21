import { useState, useEffect, useRef, useCallback } from 'react';
import type { Stroke, StrokeData } from './types';
import { FILES } from './files';
import LivePlayerTab from './tabs/LivePlayerTab';
import VideoTab from './tabs/VideoTab';
import PlanATab from './tabs/PlanATab';
import PlanBTab from './tabs/PlanBTab';

type TabId = 'live' | 'video1x' | 'video2x' | 'planA' | 'planB';

const TABS: { id: TabId; label: string }[] = [
  { id: 'live', label: '실시간 재생' },
  { id: 'video1x', label: '동영상 1x' },
  { id: 'video2x', label: '동영상 2x' },
  { id: 'planA', label: 'A안 이미지' },
  { id: 'planB', label: 'B안 이미지' },
];

interface Cache {
  video1x?: Blob;
  video2x?: Blob;
  planA?: Blob;
  planBOriginal?: Blob;
  planBMetadata?: Blob;
}

function App() {
  const [fileIdx, setFileIdx] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const cacheRef = useRef<Cache>({});

  const fileName = FILES[fileIdx].name.replace(/\s+/g, '_');

  useEffect(() => {
    const load = async () => {
      const resp = await fetch(FILES[fileIdx].path);
      const data: StrokeData[] = await resp.json();
      setStrokes(data[0].strokes);
      cacheRef.current = {};
      setActiveTab('live');
    };
    load();
  }, [fileIdx]);

  const setCacheVideo1x = useCallback((blob: Blob | undefined) => {
    cacheRef.current = { ...cacheRef.current, video1x: blob };
  }, []);
  const setCacheVideo2x = useCallback((blob: Blob | undefined) => {
    cacheRef.current = { ...cacheRef.current, video2x: blob };
  }, []);
  const setCachePlanA = useCallback((blob: Blob | undefined) => {
    cacheRef.current = { ...cacheRef.current, planA: blob };
  }, []);
  const setCachePlanB = useCallback((original: Blob | undefined, metadata: Blob | undefined) => {
    cacheRef.current = { ...cacheRef.current, planBOriginal: original, planBMetadata: metadata };
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>필기 획 재생기</h1>

      <div style={styles.fileRow}>
        <label style={styles.label}>파일 선택:</label>
        <select style={styles.select} value={fileIdx} onChange={e => setFileIdx(Number(e.target.value))}>
          {FILES.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
        </select>
      </div>

      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.tabContent}>
        {activeTab === 'live' && (
          <LivePlayerTab strokes={strokes} fileName={fileName} />
        )}
        {activeTab === 'video1x' && (
          <VideoTab
            strokes={strokes}
            speed={1}
            fileName={fileName}
            cachedBlob={cacheRef.current.video1x}
            onCacheUpdate={setCacheVideo1x}
          />
        )}
        {activeTab === 'video2x' && (
          <VideoTab
            strokes={strokes}
            speed={2}
            fileName={fileName}
            cachedBlob={cacheRef.current.video2x}
            onCacheUpdate={setCacheVideo2x}
          />
        )}
        {activeTab === 'planA' && (
          <PlanATab
            strokes={strokes}
            fileName={fileName}
            cachedBlob={cacheRef.current.planA}
            onCacheUpdate={setCachePlanA}
          />
        )}
        {activeTab === 'planB' && (
          <PlanBTab
            strokes={strokes}
            fileName={fileName}
            cachedOriginal={cacheRef.current.planBOriginal}
            cachedMetadata={cacheRef.current.planBMetadata}
            onCacheUpdate={setCachePlanB}
          />
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
    alignItems: 'center',
    minHeight: '100vh',
    padding: 20,
    background: '#1a1a2e',
    color: '#eee',
    fontFamily: "'Segoe UI', sans-serif",
  },
  title: {
    marginBottom: 12,
    fontSize: '1.4em',
    color: '#e0e0e0',
  },
  fileRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: '0.9em',
    color: '#aaa',
  },
  select: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#16213e',
    color: '#eee',
    fontSize: '0.9em',
    maxWidth: 500,
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  tab: {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    background: '#16213e',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9em',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#0f3460',
    color: '#fff',
    fontWeight: 'bold',
    borderBottom: '2px solid #e94560',
  },
  tabContent: {
    width: '100%',
    maxWidth: 850,
  },
};
