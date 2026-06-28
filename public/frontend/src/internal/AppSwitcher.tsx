import { useRef, useState, useEffect } from 'react';
import { LayoutGrid, GraduationCap, Building2, Check } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';

const INTERNAL_PORTAL_URL = 'http://localhost:5174';

interface AppDef {
  id: string;
  name: string;
  description: string;
  requiresInternalAccess?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
}

function isOrgPath(pathname: string) {
  return pathname.startsWith('/org');
}

export default function AppSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const btnClass = variant === 'light'
    ? 'p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors'
    : 'p-2 rounded-md text-white/70 hover:bg-white/[0.12] hover:text-white transition-colors';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeId = isOrgPath(location.pathname) ? 'internal' : 'mentorship';

  async function switchToInternal() {
    try {
      const res = await apiClient.post<{ code: string }>('/api/auth/sso/init/');
      window.location.href = `${INTERNAL_PORTAL_URL}/auth/callback?code=${res.code}`;
    } catch {
      window.open(`${INTERNAL_PORTAL_URL}/login`, '_blank');
    }
  }

  const APPS: AppDef[] = [
    {
      id: 'mentorship',
      name: 'Mentorship Platform',
      description: 'Learning & workspaces',
      icon: <GraduationCap size={22} className="text-white" />,
      iconBg: 'bg-violet-600',
      onClick: () => navigate('/feed'),
    },
    {
      id: 'internal',
      name: 'GILE Internal Portal',
      description: 'Org ops & volunteers',
      requiresInternalAccess: true,
      icon: <Building2 size={22} className="text-white" />,
      iconBg: 'bg-teal-600',
      onClick: switchToInternal,
    },
  ];

  const visibleApps = APPS.filter(
    app => !app.requiresInternalAccess || user?.has_internal_access || user?.role === 'superadmin',
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        title="Switch app"
        className={btnClass}
      >
        <LayoutGrid size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[240px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 pt-3.5 pb-2">
            <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">
              Switch to
            </p>
          </div>

          <div className="px-2 pb-2 flex flex-col gap-0.5">
            {visibleApps.map(app => {
              const isActive = app.id === activeId;
              return (
                <button
                  key={app.id}
                  onClick={() => { if (!isActive) app.onClick(); setOpen(false); }}
                  className={[
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors',
                    isActive ? 'bg-gray-100' : 'hover:bg-gray-50 cursor-pointer',
                  ].join(' ')}
                >
                  <div className={`w-10 h-10 rounded-xl ${app.iconBg} flex items-center justify-center shrink-0`}>
                    {app.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{app.name}</p>
                    <p className="text-[11.5px] text-gray-400">{app.description}</p>
                  </div>
                  {isActive && <Check size={14} className="text-gray-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
