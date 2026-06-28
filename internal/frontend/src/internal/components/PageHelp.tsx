import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

export interface PageHelpSection {
  eyebrow: string;
  bullets?: string[];
  body?: string;
}

interface Props {
  title: string;
  sections: PageHelpSection[];
  width?: number;
}

export default function PageHelp({ title, sections, width = 420 }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - width - 16) });
    }
    setOpen(o => !o);
  };

  const renderBullet = (text: string, key: number) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <li key={key}>
        {parts.map((p, i) =>
          p.startsWith('**') && p.endsWith('**')
            ? <span key={i} className="font-semibold">{p.slice(2, -2)}</span>
            : <span key={i}>{p}</span>
        )}
      </li>
    );
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        title={title}
        aria-label="Help"
      >
        <HelpCircle size={14} />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-[13px] font-bold text-gray-900">{title}</p>
            <button onClick={() => setOpen(false)} className="p-1 rounded-md text-gray-400 hover:bg-gray-100">
              <X size={13} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-3.5 space-y-4">
            {sections.map((s, i) => (
              <section key={i}>
                <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{s.eyebrow}</p>
                {s.bullets && (
                  <ul className="space-y-1 text-[12px] text-gray-700 leading-relaxed list-disc pl-4">
                    {s.bullets.map((b, j) => renderBullet(b, j))}
                  </ul>
                )}
                {s.body && (
                  <p className="text-[12px] text-gray-700 leading-relaxed">{s.body}</p>
                )}
              </section>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
