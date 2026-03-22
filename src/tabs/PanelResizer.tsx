import { useCallback, useRef } from 'react';

interface Props {
  onResize: (delta: number) => void;
  /** 'left' = 왼쪽 패널 크기 조정, 'right' = 오른쪽 패널 크기 조정 */
  side: 'left' | 'right';
}

export default function PanelResizer({ onResize, side }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      // left 패널: 오른쪽으로 드래그하면 커짐 (+dx)
      // right 패널: 왼쪽으로 드래그하면 커짐 (-dx)
      onResize(side === 'left' ? dx : -dx);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize, side]);

  return (
    <div
      style={styles.resizer}
      onMouseDown={handleMouseDown}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  resizer: {
    width: 5,
    cursor: 'col-resize',
    background: '#333',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
};
