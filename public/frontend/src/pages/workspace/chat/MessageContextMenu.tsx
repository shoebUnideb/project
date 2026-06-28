import { useEffect } from 'react';

export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export function MessageContextMenu({ x, y, actions, onClose }: {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}) {
  const top  = Math.min(y, window.innerHeight - actions.length * 40 - 16);
  const left = Math.min(x, window.innerWidth - 176);

  useEffect(() => {
    window.addEventListener('scroll', onClose, true);
    return () => window.removeEventListener('scroll', onClose, true);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onMouseDown={onClose}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{ position: 'fixed', top, left, zIndex: 9999 }}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-[160px] overflow-hidden"
      >
        {actions.map((a, i) => (
          <button
            key={i}
            onMouseDown={e => { e.stopPropagation(); }}
            onClick={() => { a.onClick(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium transition-colors text-left ${
              a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="shrink-0 opacity-70">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
