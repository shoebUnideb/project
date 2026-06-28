import {
  createContext, useContext, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

/* ── Preset definition ─────────────────────────────────────────── */

export interface ThemePreset {
  id: string;
  name: string;
  /** Hex of the 600 shade — used for buttons/links. */
  hex: string;
  /** Override swatch display color (for presets where 600 is intentionally darker than the recognizable color). */
  swatch?: string;
  /** If true, text on primary-coloured backgrounds should be dark, not white. */
  textLight: boolean;
  shades: Record<'50'|'100'|'200'|'300'|'400'|'500'|'600'|'700'|'800'|'900', string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  // ── Original 12 ────────────────────────────────────────────────
  {
    id: 'terracotta', name: 'Terracotta', hex: '#cf6535', textLight: false,
    shades: {
      '50':  '253 243 238', '100': '251 228 208', '200': '247 198 162',
      '300': '241 160 107', '400': '232 122 66',  '500': '217 104 56',
      '600': '207 101 53',  '700': '181 84 44',   '800': '146 66 34',
      '900': '118 52 27',
    },
  },
  {
    id: 'sapnavy', name: 'SAP Navy', hex: '#1164a3', textLight: false,
    shades: {
      '50':  '232 241 249', '100': '197 217 240', '200': '157 191 229',
      '300': '110 161 217', '400': '63 131 204',  '500': '26 107 181',
      '600': '17 100 163',  '700': '13 82 144',   '800': '10 64 112',
      '900': '7 48 82',
    },
  },
  {
    id: 'midnight', name: 'Midnight', hex: '#243e68', textLight: false,
    shades: {
      '50':  '236 239 245', '100': '204 211 226', '200': '165 179 204',
      '300': '122 145 179', '400': '82 114 160',  '500': '51 86 133',
      '600': '36 62 104',   '700': '26 47 82',    '800': '18 32 58',
      '900': '12 22 39',
    },
  },
  {
    id: 'slate', name: 'Slate', hex: '#4a6fa5', textLight: false,
    shades: {
      '50':  '237 241 250', '100': '210 220 240', '200': '179 197 228',
      '300': '143 171 214', '400': '106 144 196', '500': '74 119 174',
      '600': '74 111 165',  '700': '58 91 138',   '800': '45 70 110',
      '900': '32 51 82',
    },
  },
  {
    id: 'pearl', name: 'Pearl', hex: '#8b6f4f', textLight: false,
    shades: {
      '50':  '254 252 250', '100': '245 240 234', '200': '233 222 206',
      '300': '217 201 179', '400': '197 174 148', '500': '174 148 120',
      '600': '139 111 79',  '700': '115 91 61',   '800': '92 72 46',
      '900': '74 56 30',
    },
  },
  {
    id: 'emerald', name: 'Emerald', hex: '#059669', textLight: false,
    shades: {
      '50':  '236 253 245', '100': '209 250 229', '200': '167 243 208',
      '300': '110 231 183', '400': '52 211 153',  '500': '16 185 129',
      '600': '5 150 105',   '700': '4 120 87',    '800': '6 95 70',
      '900': '6 78 59',
    },
  },
  {
    id: 'forest', name: 'Forest', hex: '#166534', textLight: false,
    shades: {
      '50':  '240 253 244', '100': '220 252 231', '200': '187 247 208',
      '300': '134 239 172', '400': '74 222 128',  '500': '34 197 94',
      '600': '22 101 52',   '700': '21 83 45',    '800': '16 64 36',
      '900': '11 46 27',
    },
  },
  {
    id: 'amethyst', name: 'Amethyst', hex: '#7c3aed', textLight: false,
    shades: {
      '50':  '245 243 255', '100': '237 233 254', '200': '221 214 254',
      '300': '196 181 253', '400': '167 139 250', '500': '139 92 246',
      '600': '124 58 237',  '700': '109 40 217',  '800': '91 33 182',
      '900': '76 29 149',
    },
  },
  {
    id: 'crimson', name: 'Crimson', hex: '#dc2626', textLight: false,
    shades: {
      '50':  '254 242 242', '100': '254 226 226', '200': '254 202 202',
      '300': '252 165 165', '400': '248 113 113', '500': '239 68 68',
      '600': '220 38 38',   '700': '185 28 28',   '800': '153 27 27',
      '900': '127 29 29',
    },
  },
  {
    id: 'rose', name: 'Rose', hex: '#db2777', textLight: false,
    shades: {
      '50':  '253 242 248', '100': '252 231 243', '200': '251 207 232',
      '300': '249 168 212', '400': '244 114 182', '500': '236 72 153',
      '600': '219 39 119',  '700': '190 24 93',   '800': '157 23 77',
      '900': '131 24 67',
    },
  },
  {
    id: 'gold', name: 'Gold', hex: '#d97706', textLight: false,
    shades: {
      '50':  '255 251 235', '100': '254 243 199', '200': '253 230 138',
      '300': '252 211 77',  '400': '251 191 36',  '500': '245 158 11',
      '600': '217 119 6',   '700': '180 83 9',    '800': '146 64 14',
      '900': '120 53 15',
    },
  },
  {
    id: 'teal', name: 'Teal', hex: '#0891b2', textLight: false,
    shades: {
      '50':  '240 253 250', '100': '204 251 241', '200': '153 246 228',
      '300': '94 234 212',  '400': '45 212 191',  '500': '20 184 166',
      '600': '8 145 178',   '700': '14 116 144',  '800': '21 94 117',
      '900': '22 78 99',
    },
  },

  // ── Slack-inspired additions ────────────────────────────────────
  {
    id: 'kindofblue', name: 'Kind of Blue', hex: '#3a7ab0', textLight: false,
    shades: {
      '50':  '235 244 251', '100': '199 222 239', '200': '152 196 227',
      '300': '101 168 213', '400': '63 141 195',  '500': '47 120 178',
      '600': '58 122 176',  '700': '42 98 154',   '800': '30 77 122',
      '900': '20 58 94',
    },
  },
  {
    id: 'funkyfresh', name: 'Funky Fresh', hex: '#1a9481', textLight: false,
    shades: {
      '50':  '232 250 247', '100': '194 240 232', '200': '145 228 212',
      '300': '85 211 187',  '400': '41 189 164',  '500': '27 148 129',
      '600': '26 148 129',  '700': '18 118 103',  '800': '14 90 79',
      '900': '10 66 58',
    },
  },
  {
    id: 'jazzclub', name: 'Jazz Club', hex: '#8b2635', textLight: false,
    shades: {
      '50':  '251 233 235', '100': '245 197 203', '200': '237 154 164',
      '300': '226 102 111', '400': '212 64 80',   '500': '192 34 53',
      '600': '139 38 53',   '700': '116 30 44',   '800': '92 23 34',
      '900': '71 15 25',
    },
  },
  {
    // 600 is dark enough for white text; swatch shows the true lime-green
    id: 'electricfusion', name: 'Electric Fusion', hex: '#6b8b12', swatch: '#addc2e', textLight: false,
    shades: {
      '50':  '242 249 219', '100': '225 241 165', '200': '204 228 108',
      '300': '175 210 56',  '400': '144 187 22',  '500': '110 157 14',
      '600': '107 139 18',  '700': '83 109 14',   '800': '62 81 10',
      '900': '45 60 7',
    },
  },
  {
    // 600 is dark enough for white text; swatch shows the golden mustard
    id: 'brassy', name: 'Brassy', hex: '#8b6914', swatch: '#d4af37', textLight: false,
    shades: {
      '50':  '252 248 225', '100': '248 237 179', '200': '241 218 126',
      '300': '232 195 68',  '400': '214 169 25',  '500': '178 136 18',
      '600': '139 105 20',  '700': '112 82 16',   '800': '86 62 12',
      '900': '64 46 8',
    },
  },
  {
    id: 'sunglassesinside', name: 'Sunglasses Inside', hex: '#4a2296', textLight: false,
    shades: {
      '50':  '242 236 248', '100': '221 208 239', '200': '191 170 228',
      '300': '158 128 212', '400': '125 89 192',  '500': '94 56 170',
      '600': '74 34 150',   '700': '58 24 120',   '800': '45 17 80',
      '900': '30 10 56',
    },
  },
  {
    id: 'aubergine', name: 'Aubergine', hex: '#4a154b', textLight: false,
    shades: {
      '50':  '246 236 246', '100': '231 204 234', '200': '207 165 211',
      '300': '179 122 188', '400': '151 79 163',  '500': '122 46 138',
      '600': '74 21 75',    '700': '59 16 64',    '800': '45 11 49',
      '900': '30 8 33',
    },
  },
  {
    id: 'clementine', name: 'Clementine', hex: '#d4531a', textLight: false,
    shades: {
      '50':  '253 240 233', '100': '250 217 198', '200': '245 184 152',
      '300': '238 144 96',  '400': '229 106 48',  '500': '217 74 20',
      '600': '212 83 26',   '700': '184 66 20',   '800': '147 49 14',
      '900': '115 37 11',
    },
  },
  {
    // 600 is amber-dark for white text; swatch shows the bright banana yellow
    id: 'banana', name: 'Banana', hex: '#a16207', swatch: '#fcd34d', textLight: false,
    shades: {
      '50':  '255 253 230', '100': '254 249 195', '200': '254 240 138',
      '300': '253 224 71',  '400': '250 204 21',  '500': '234 179 8',
      '600': '161 98 7',    '700': '133 77 6',    '800': '107 58 5',
      '900': '82 44 4',
    },
  },
  {
    id: 'jade', name: 'Jade', hex: '#2d6a4f', textLight: false,
    shades: {
      '50':  '232 245 238', '100': '195 230 210', '200': '147 206 179',
      '300': '90 181 147',  '400': '46 154 118',  '500': '27 132 97',
      '600': '45 106 79',   '700': '34 83 60',    '800': '24 64 48',
      '900': '15 46 34',
    },
  },
  {
    id: 'lagoon', name: 'Lagoon', hex: '#2e6b8a', textLight: false,
    shades: {
      '50':  '233 243 248', '100': '197 224 238', '200': '150 199 225',
      '300': '96 170 207',  '400': '53 144 189',  '500': '27 122 173',
      '600': '46 107 138',  '700': '33 85 120',   '800': '23 66 100',
      '900': '15 45 74',
    },
  },
  {
    id: 'barbra', name: 'Barbra', hex: '#be4f7a', textLight: false,
    shades: {
      '50':  '252 237 244', '100': '248 210 229', '200': '243 175 208',
      '300': '234 133 183', '400': '224 90 156',  '500': '210 66 135',
      '600': '190 79 122',  '700': '162 57 102',  '800': '130 40 80',
      '900': '100 26 60',
    },
  },
  {
    id: 'gray', name: 'Gray', hex: '#64748b', textLight: false,
    shades: {
      '50':  '248 249 250', '100': '241 245 249', '200': '226 232 240',
      '300': '203 213 225', '400': '148 163 184', '500': '100 116 139',
      '600': '100 116 139', '700': '71 85 105',   '800': '51 65 85',
      '900': '30 41 59',
    },
  },
  {
    id: 'moodindigo', name: 'Mood Indigo', hex: '#1f3166', textLight: false,
    shades: {
      '50':  '235 240 248', '100': '201 211 236', '200': '160 176 222',
      '300': '113 141 206', '400': '72 109 190',  '500': '45 81 174',
      '600': '31 49 102',   '700': '24 40 82',    '800': '17 30 64',
      '900': '12 21 48',
    },
  },
  {
    id: 'tritanopia', name: 'Tritanopia', hex: '#1a1a2e', textLight: false,
    shades: {
      '50':  '232 232 238', '100': '191 191 209', '200': '145 145 179',
      '300': '99 99 149',   '400': '61 61 120',   '500': '37 37 92',
      '600': '26 26 46',    '700': '20 20 40',    '800': '14 14 28',
      '900': '8 8 18',
    },
  },
  {
    id: 'protanopia', name: 'Protanopia & Deuteranopia', hex: '#3d2868', textLight: false,
    shades: {
      '50':  '240 235 248', '100': '212 197 238', '200': '180 154 226',
      '300': '144 112 212', '400': '109 78 196',  '500': '80 53 176',
      '600': '61 40 104',   '700': '47 30 82',    '800': '35 22 64',
      '900': '23 14 46',
    },
  },
];

export const DEFAULT_PRESET = THEME_PRESETS[0];

/* ── Helpers ───────────────────────────────────────────────────── */

function applyPreset(preset: ThemePreset) {
  const root = document.documentElement;
  (Object.keys(preset.shades) as Array<keyof typeof preset.shades>).forEach(shade => {
    root.style.setProperty(`--p-${shade}`, preset.shades[shade]);
  });
  root.setAttribute('data-theme-text', preset.textLight ? 'dark' : 'white');
}

export function getPresetById(id: string): ThemePreset {
  return THEME_PRESETS.find(p => p.id === id) ?? DEFAULT_PRESET;
}

/* ── Context ───────────────────────────────────────────────────── */

interface ThemeContextValue {
  theme: ThemePreset;
  setTheme: (id: string) => Promise<void>;
  font: FontPreset;
  setFont: (id: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateSettings } = useAuth();

  const currentPreset = getPresetById(user?.theme_color ?? 'aubergine');
  const currentFont   = getFontById(user?.font_style ?? 'lato');

  useEffect(() => {
    applyPreset(currentPreset);
  }, [currentPreset]);

  useEffect(() => {
    applyFont(currentFont);
  }, [currentFont]);

  const setTheme = useCallback(async (id: string) => {
    const preset = getPresetById(id);
    applyPreset(preset);
    await updateSettings({ theme_color: id });
  }, [updateSettings]);

  const setFont = useCallback(async (id: string) => {
    const font = getFontById(id);
    applyFont(font);
    await updateSettings({ font_style: id });
  }, [updateSettings]);

  return (
    <ThemeContext.Provider value={{ theme: currentPreset, setTheme, font: currentFont, setFont }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/* ══════════════════════════════════════════════════════════════════
   FONT SYSTEM
   ══════════════════════════════════════════════════════════════════ */

export interface FontPreset {
  id: string;
  name: string;
  stack: string;
  url?: string;
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'arial',      name: 'Arial',                       stack: 'Arial, Helvetica, sans-serif' },
  { id: 'atkinson',   name: 'Atkinson Hyperlegible Next',  stack: '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&display=swap' },
  { id: 'comic_sans', name: 'Comic Sans',                  stack: '"Comic Sans MS", cursive' },
  { id: 'georgia',    name: 'Georgia',                     stack: 'Georgia, serif' },
  { id: 'lato',       name: 'Lato (Default)',               stack: '"Lato", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' },
  { id: 'noto_sans',  name: 'Noto Sans',                   stack: '"Noto Sans", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap' },
  { id: 'open_dyslexic', name: 'OpenDyslexic',             stack: '"OpenDyslexic", sans-serif',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.min.css' },
  { id: 'roboto_mono', name: 'Roboto Mono',                stack: '"Roboto Mono", monospace',
    url: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;600;700&display=swap' },
  { id: 'system',     name: 'San Francisco Pro (System)',  stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
];

export function loadFontUrl(id: string, url: string) {
  const linkId = `font-link-${id}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

export function applyFont(font: FontPreset) {
  if (font.url) loadFontUrl(font.id, font.url);
  document.documentElement.style.setProperty('--font-family', font.stack);
}

export function getFontById(id: string): FontPreset {
  return FONT_PRESETS.find(f => f.id === id) ?? FONT_PRESETS.find(f => f.id === 'lato')!;
}
