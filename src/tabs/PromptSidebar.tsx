import { useCallback } from 'react';
import { downloadBlob } from '../export/download';
import type { AttachedFileInfo } from '../evalTypes';

interface Props {
  promptText: string;
  onPromptChange: (text: string) => void;
  loading: boolean;
  attachedFiles: AttachedFileInfo[];
  onReset: () => void;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const typeIcons: Record<string, string> = {
  image: '🖼️',
  video: '🎬',
  pdf: '📄',
};

export default function PromptSidebar({ promptText, onPromptChange, loading, attachedFiles, onReset }: Props) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([promptText], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, 'prompt_edited.md');
  }, [promptText]);

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>프롬프트</span>
      </div>

      <div style={styles.textArea}>
        {loading ? (
          <div style={styles.loading}>로딩 중...</div>
        ) : (
          <textarea
            style={styles.textarea}
            value={promptText}
            onChange={e => onPromptChange(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      <div style={styles.actions}>
        <button style={styles.actionBtn} onClick={handleDownload} disabled={!promptText}>
          📥 다운로드
        </button>
        <button style={styles.actionBtn} onClick={onReset}>
          🔄 초기화
        </button>
      </div>

      <div style={styles.filesSection}>
        <div style={styles.filesTitle}>첨부 파일</div>
        {attachedFiles.map((f, i) => (
          <div key={i} style={styles.fileItem}>
            <span>{typeIcons[f.type] ?? '📎'} {f.label}</span>
            {f.size !== undefined && <span style={styles.fileSize}>{formatSize(f.size)}</span>}
          </div>
        ))}
        {attachedFiles.length === 0 && (
          <div style={styles.noFiles}>첨부 파일 없음</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e2e',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '0.95em',
    fontWeight: 'bold',
    color: '#e0e0e0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '1.1em',
    cursor: 'pointer',
    padding: '2px 6px',
  },
  textArea: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    background: '#16213e',
    color: '#ccc',
    border: 'none',
    padding: '10px',
    fontFamily: "'Consolas', 'Monaco', monospace",
    fontSize: '0.75em',
    lineHeight: 1.5,
    outline: 'none',
  },
  loading: {
    padding: 20,
    color: '#666',
    fontSize: '0.85em',
    textAlign: 'center' as const,
  },
  actions: {
    display: 'flex',
    gap: 6,
    padding: '8px 10px',
    borderTop: '1px solid #333',
    flexShrink: 0,
  },
  actionBtn: {
    flex: 1,
    padding: '5px 8px',
    border: 'none',
    borderRadius: 6,
    background: '#0f3460',
    color: '#eee',
    cursor: 'pointer',
    fontSize: '0.78em',
  },
  filesSection: {
    borderTop: '1px solid #333',
    padding: '8px 10px',
    flexShrink: 0,
    maxHeight: 150,
    overflow: 'auto',
  },
  filesTitle: {
    fontSize: '0.8em',
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: 6,
  },
  fileItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75em',
    color: '#ccc',
    padding: '3px 0',
  },
  fileSize: {
    color: '#666',
  },
  noFiles: {
    fontSize: '0.75em',
    color: '#555',
  },
};
