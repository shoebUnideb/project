import { Check } from 'lucide-react';
import { THEME_PRESETS, useTheme } from '../../context/ThemeContext';

const GROUPS = [
  { label: 'Classic', ids: ['terracotta','sapnavy','midnight','slate','pearl','emerald','forest','amethyst','crimson','rose','gold','teal'] },
  { label: 'Signature', ids: ['kindofblue','funkyfresh','jazzclub','electricfusion','brassy','sunglassesinside'] },
  { label: 'Single color', ids: ['aubergine','clementine','banana','jade','lagoon','barbra','gray','moodindigo'] },
  { label: 'Accessible', ids: ['tritanopia','protanopia'] },
];

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-semibold text-gray-700">Theme color</p>
      {GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.ids.map(id => {
              const preset = THEME_PRESETS.find(p => p.id === id);
              if (!preset) return null;
              const active = preset.id === theme.id;
              const swatchColor = preset.swatch ?? preset.hex;
              return (
                <button
                  key={preset.id}
                  title={preset.name}
                  onClick={() => setTheme(preset.id)}
                  className="relative w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                  style={{
                    backgroundColor: swatchColor,
                    outline: active ? '2.5px solid #111827' : '2.5px solid transparent',
                    outlineOffset: '2px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.12)',
                  }}
                >
                  {active && (
                    <Check
                      size={12}
                      strokeWidth={3}
                      className="absolute inset-0 m-auto"
                      style={{ color: preset.textLight ? '#111827' : '#ffffff' }}
                    />
                  )}
                  <span className="sr-only">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-gray-400">
        Active: <span className="font-semibold text-gray-600">{theme.name}</span>
      </p>
    </div>
  );
}
