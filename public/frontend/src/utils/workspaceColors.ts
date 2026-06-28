export const WORKSPACE_COLORS = {
  blue:    { bg: '#2563eb', light: '#eff6ff',  label: 'Blue'    },
  indigo:  { bg: '#4f46e5', light: '#eef2ff',  label: 'Indigo'  },
  purple:  { bg: '#7c3aed', light: '#f5f3ff',  label: 'Purple'  },
  teal:    { bg: '#0d9488', light: '#f0fdfa',  label: 'Teal'    },
  green:   { bg: '#16a34a', light: '#f0fdf4',  label: 'Green'   },
  emerald: { bg: '#059669', light: '#ecfdf5',  label: 'Emerald' },
  orange:  { bg: '#ea580c', light: '#fff7ed',  label: 'Orange'  },
  red:     { bg: '#dc2626', light: '#fef2f2',  label: 'Red'     },
  pink:    { bg: '#db2777', light: '#fdf2f8',  label: 'Pink'    },
  amber:   { bg: '#d97706', light: '#fffbeb',  label: 'Amber'   },
  cyan:    { bg: '#0891b2', light: '#ecfeff',  label: 'Cyan'    },
  slate:   { bg: '#475569', light: '#f8fafc',  label: 'Slate'   },
} as const;

export type WorkspaceColorKey = keyof typeof WORKSPACE_COLORS;

export function getWorkspaceColor(key: string): { bg: string; light: string; label: string } {
  return (WORKSPACE_COLORS as Record<string, { bg: string; light: string; label: string }>)[key]
    ?? WORKSPACE_COLORS.blue;
}
