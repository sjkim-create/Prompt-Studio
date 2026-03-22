import { useCallback, useEffect, useRef, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { downloadBlob } from '../export/download';
import type { EvalHistoryEntry } from '../evalTypes';
import type { ModelInfo } from '../export/evaluateWithOpenAI';

interface Props {
  history: EvalHistoryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  streamingContent: string | null;
  streamingModelLabel?: string;
  // 모델 선택 + 평가
  availableModels: ModelInfo[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onEvaluate: () => void;
  evaluating: boolean;
  evalProgress: string;
  evalError: string | null;
  canEvaluate: boolean;
}

function fixMarkdownTables(md: string): string {
  return md.replace(/\|([^|\n]+\|){2,}/g, (match) => {
    if (match.includes('\n')) return match;
    return match.replace(/\|\s*\|/g, '|\n|');
  });
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EvaluationPanel({
  history, selectedId, onSelect, streamingContent, streamingModelLabel,
  availableModels, selectedModel, onModelChange, onEvaluate, evaluating, evalProgress, evalError, canEvaluate,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isStreaming = streamingContent !== null;

  const selected = useMemo(
    () => history.find(h => h.id === selectedId) ?? null,
    [history, selectedId],
  );

  // 히스토리 항목이 선택되면 그것을 표시, 아니면 스트리밍 표시
  const showingHistory = selectedId !== null && selected !== null;
  const displayMarkdown = showingHistory ? selected.content : (isStreaming ? streamingContent : selected?.content ?? '');
  const fixedMarkdown = useMemo(() => fixMarkdownTables(displayMarkdown), [displayMarkdown]);

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayMarkdown, isStreaming]);

  const handleDownload = useCallback(() => {
    if (!displayMarkdown) return;
    const label = isStreaming ? streamingModelLabel : selected?.modelLabel;
    const source = selected?.source ?? 'eval';
    const blob = new Blob([displayMarkdown], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${source}_${label ?? 'eval'}.md`);
  }, [displayMarkdown, isStreaming, streamingModelLabel, selected]);

  // optgroup으로 모델 분류
  const openaiModels = availableModels.filter(m => m.provider === 'openai');
  const geminiModels = availableModels.filter(m => m.provider === 'gemini');

  return (
    <div style={styles.panel}>
      {/* 헤더: 모델 선택 + 평가 버튼 */}
      <div style={styles.header}>
        <div style={styles.evalControls}>
          <select
            style={styles.modelSelect}
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            disabled={evaluating}
          >
            {openaiModels.length > 0 && (
              <optgroup label="OpenAI">
                {openaiModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            )}
            {geminiModels.length > 0 && (
              <optgroup label="Google Gemini">
                {geminiModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            )}
          </select>
          <button
            style={{
              ...styles.evalBtn,
              ...(!canEvaluate ? styles.btnDisabled : {}),
            }}
            onClick={onEvaluate}
            disabled={!canEvaluate}
          >
            {evaluating ? '🤖 추가 평가' : '🤖 평가하기'}
          </button>
        </div>
      </div>

      {/* 진행/에러 표시 */}
      {evaluating && evalProgress && (
        <div style={styles.progressBar}>{evalProgress}</div>
      )}
      {evalError && (
        <div style={styles.errorBar}>❌ {evalError}</div>
      )}

      {/* 히스토리 풀다운 */}
      <div style={styles.historyRow}>
        <select
          style={styles.historySelect}
          value={showingHistory ? selectedId ?? '' : (isStreaming ? '__streaming__' : '')}
          onChange={e => {
            const v = e.target.value;
            if (v === '__streaming__') onSelect('');
            else onSelect(v);
          }}
        >
          {isStreaming && (
            <option value="__streaming__">⏳ {streamingModelLabel} — 수신 중...</option>
          )}
          {history.map(h => (
            <option key={h.id} value={h.id}>
              [{h.source}] {h.modelLabel} — {formatTimestamp(h.timestamp)}
            </option>
          ))}
          {history.length === 0 && !isStreaming && (
            <option value="" disabled>평가 기록 없음</option>
          )}
        </select>
      </div>

      {/* 토큰/비용 바 */}
      {!isStreaming && selected?.usage && selected.costUsd !== null && (
        <div style={styles.usageBar}>
          <span>입력: <b>{selected.usage.promptTokens.toLocaleString()}</b></span>
          <span>출력: <b>{selected.usage.completionTokens.toLocaleString()}</b></span>
          <span>합계: <b>{selected.usage.totalTokens.toLocaleString()}</b></span>
          <span>${selected.costUsd.toFixed(4)} (≈₩{Math.round(selected.costUsd * 1450).toLocaleString()})</span>
        </div>
      )}

      {/* 마크다운 본문 */}
      <div style={styles.content} ref={contentRef}>
        {fixedMarkdown ? (
          <div className="eval-markdown">
            <Markdown remarkPlugins={[remarkGfm]}>{fixedMarkdown}</Markdown>
          </div>
        ) : (
          <div style={styles.placeholder}>모델을 선택하고 "평가하기"를 클릭하세요.</div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div style={styles.footer}>
        <button style={styles.footerBtn} onClick={handleDownload} disabled={!displayMarkdown || isStreaming}>
          📥 .md 다운로드
        </button>
        <button
          style={styles.footerBtn}
          onClick={() => navigator.clipboard.writeText(displayMarkdown)}
          disabled={!displayMarkdown || isStreaming}
        >
          📋 복사
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e2e',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: '1px solid #333',
    flexShrink: 0,
    gap: 8,
  },
  evalControls: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flex: 1,
  },
  modelSelect: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#16213e',
    color: '#eee',
    fontSize: '0.8em',
    cursor: 'pointer',
    minWidth: 0,
  },
  evalBtn: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 6,
    background: '#e94560',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '0.8em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  progressBar: {
    padding: '4px 14px',
    background: '#2a2a3e',
    color: '#e9a560',
    fontSize: '0.78em',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  errorBar: {
    padding: '4px 14px',
    background: '#3a1a1a',
    color: '#ff6b6b',
    fontSize: '0.78em',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  historyRow: {
    padding: '4px 10px',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  historySelect: {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#16213e',
    color: '#eee',
    fontSize: '0.78em',
    cursor: 'pointer',
  },
  usageBar: {
    display: 'flex',
    gap: 10,
    padding: '5px 14px',
    background: '#16213e',
    borderBottom: '1px solid #333',
    fontSize: '0.72em',
    color: '#aaa',
    flexWrap: 'wrap' as const,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '14px',
  },
  placeholder: {
    color: '#555',
    fontSize: '0.85em',
    textAlign: 'center' as const,
    marginTop: 40,
  },
  footer: {
    display: 'flex',
    gap: 8,
    padding: '8px 14px',
    borderTop: '1px solid #333',
    flexShrink: 0,
  },
  footerBtn: {
    flex: 1,
    padding: '6px 10px',
    border: 'none',
    borderRadius: 6,
    background: '#0f3460',
    color: '#eee',
    cursor: 'pointer',
    fontSize: '0.8em',
  },
};
