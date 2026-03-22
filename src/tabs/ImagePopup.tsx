import { useCallback, useRef, useState } from 'react';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export default function ImagePopup({ src, alt, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !dragging.current) {
      onClose();
    }
  }, [onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => {
      const next = prev * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      return Math.min(Math.max(next, 0.2), 10);
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setTimeout(() => { dragging.current = false; }, 0);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <div
      style={styles.backdrop}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <button style={styles.closeBtn} onClick={onClose}>✕</button>
      <div style={styles.zoomInfo}>{Math.round(scale * 100)}% (스크롤: 확대/축소, 더블클릭: 초기화)</div>
      <img
        src={src}
        alt={alt}
        style={{
          ...styles.image,
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        draggable={false}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(0,0,0,0.5)',
    border: 'none',
    color: '#fff',
    fontSize: '1.5em',
    cursor: 'pointer',
    padding: '4px 12px',
    borderRadius: 8,
    zIndex: 1,
  },
  zoomInfo: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.6)',
    color: '#aaa',
    padding: '4px 14px',
    borderRadius: 6,
    fontSize: '0.8em',
    zIndex: 1,
  },
  image: {
    maxWidth: '95vw',
    maxHeight: '95vh',
    objectFit: 'contain' as const,
    transformOrigin: 'center center',
    transition: 'none',
    userSelect: 'none',
  },
};
