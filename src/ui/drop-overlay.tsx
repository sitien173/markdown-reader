import { useEffect, useState } from 'react';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** Window-wide overlay while a file is dragged over the page. It never intercepts pointer events, so the drop still reaches the reader. */
export function DropOverlay() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setActive(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const end = () => {
      depth = 0;
      setActive(false);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', end);
    window.addEventListener('dragend', end);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', end);
      window.removeEventListener('dragend', end);
    };
  }, []);
  if (!active) return null;
  return (
    <div className="reader-drop-overlay" data-slot="drop-overlay" aria-hidden="true">
      <p>Drop a Markdown file to open it</p>
    </div>
  );
}
