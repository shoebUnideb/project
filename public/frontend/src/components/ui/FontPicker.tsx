import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { FONT_PRESETS, getFontById, loadFontUrl, applyFont } from '../../context/ThemeContext';
import { useTheme } from '../../context/ThemeContext';

export default function FontPicker({ upward = false }: { upward?: boolean }) {
  const { font, setFont } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Pre-load all fonts so each option renders in its own typeface
  useEffect(() => {
    FONT_PRESETS.forEach(f => { if (f.url) loadFontUrl(f.id, f.url); });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative w-full max-w-xs" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-[13.5px] font-medium text-gray-800 bg-white transition-all ${
          open ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 hover:border-gray-300'
        }`}
        style={{ fontFamily: font.stack }}
      >
        <span>{font.name}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1.5 ${upward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          {FONT_PRESETS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => { applyFont(f); setFont(f.id); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                f.id === font.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-800 hover:bg-gray-50'
              }`}
              style={{ fontFamily: f.stack }}
            >
              <span className="text-[13.5px]">{f.name}</span>
              {f.id === font.id && <Check size={13} className="text-primary-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
