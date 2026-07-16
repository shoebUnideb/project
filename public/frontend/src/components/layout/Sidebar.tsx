import { useRef, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList,
  MessageSquare, Settings, Store, LayoutGrid, Newspaper, ChevronRight, X,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import type { Role, Workspace } from '../../types';
import Avatar from '../ui/Avatar';
import ThemePicker from '../ui/ThemePicker';
import FontPicker from '../ui/FontPicker';

interface NavItem { label: string; to: string; icon: React.ReactNode }

const NAV_ITEMS: Record<Role, NavItem[]> = {
  student: [
    { label: 'Feed',        to: '/feed',              icon: <Newspaper size={16} /> },
    { label: 'Dashboard',   to: '/student/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'Messages',    to: '/messages',          icon: <MessageSquare size={16} /> },
    { label: 'Directory',    to: '/marketplace',       icon: <Store size={16} /> },
    { label: 'Workspaces',  to: '/workspaces',        icon: <LayoutGrid size={16} /> },
  ],
  mentor: [
    { label: 'Dashboard',   to: '/mentor/dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'My Students', to: '/mentor/students',  icon: <Users size={16} /> },
    { label: 'Feed',        to: '/feed',             icon: <Newspaper size={16} /> },
    { label: 'Workspaces',  to: '/workspaces',       icon: <LayoutGrid size={16} /> },
    { label: 'Messages',    to: '/mentor/messages',  icon: <MessageSquare size={16} /> },
    { label: 'Directory',   to: '/marketplace',      icon: <Store size={16} /> },
  ],
  superadmin: [
    { label: 'Dashboard',    to: '/admin/dashboard',    icon: <LayoutDashboard size={16} /> },
    { label: 'Users',        to: '/admin/users',        icon: <Users size={16} /> },
    { label: 'Assignments',  to: '/admin/assignments',  icon: <ClipboardList size={16} /> },
    { label: 'Feed',         to: '/feed',               icon: <Newspaper size={16} /> },
    { label: 'Workspaces',   to: '/workspaces',         icon: <LayoutGrid size={16} /> },
    { label: 'Messages',     to: '/admin/messages',     icon: <MessageSquare size={16} /> },
    { label: 'Directory',    to: '/marketplace',        icon: <Store size={16} /> },
    { label: 'Settings',     to: '/admin/settings',     icon: <Settings size={16} /> },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  student: 'Student', mentor: 'Mentor', superadmin: 'Admin',
};

function Tooltip({ label }: { label: string }) {
  return (
    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
      {label}
    </span>
  );
}

function WorkspacesNavItem({ item, isActive, collapsed }: { item: NavItem; isActive: boolean; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const { data: allWorkspaces } = useApiList<Workspace>(() => workspacesApi.list(), []);
  const joined = allWorkspaces.filter(w => w.my_status === 'owner' || w.my_status === 'approved' || w.my_status === 'mentor');

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.right + 4 });
    }
    setOpen(true);
  };
  const hide = () => {
    timerRef.current = setTimeout(() => setOpen(false), 150);
  };

  const flyout = open && joined.length > 0 && (
    <div
      className="fixed z-[999] w-56 bg-white border border-gray-200 rounded-xl shadow-2xl py-1 overflow-hidden"
      style={{ left: pos.left, top: pos.top }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1.5">
        My Workspaces
      </p>
      <div className="max-h-72 overflow-y-auto">
        {joined.map(w => (
          <button
            key={w.id}
            onClick={() => { setOpen(false); navigate(`/w/${w.slug}`); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
          >
            {w.logo_url ? (
              <img src={w.logo_url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-md bg-primary-100 flex items-center justify-center text-primary-700 text-[12px] shrink-0">
                {w.icon_emoji || w.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-gray-900 truncate leading-tight">{w.name}</p>
              <p className="text-[10.5px] text-gray-400 truncate">{w.my_status === 'owner' ? 'Owner' : w.my_status === 'mentor' ? 'Mentor' : 'Member'}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="border-t border-gray-100 mt-1 px-3 py-2">
        <button
          onClick={() => { setOpen(false); navigate('/workspaces'); }}
          className="text-[11.5px] text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          View all workspaces →
        </button>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <div ref={btnRef} className="relative flex justify-center" onMouseEnter={show} onMouseLeave={hide}>
        <div
          onClick={() => navigate(item.to)}
          className={[
            'flex items-center justify-center w-9 h-9 rounded-lg transition-colors relative group/tip cursor-pointer',
            isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          ].join(' ')}
        >
          <span className="shrink-0">{item.icon}</span>
          <Tooltip label={item.label} />
        </div>
        {flyout}
      </div>
    );
  }

  return (
    <div ref={btnRef} className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <NavLink
        to={item.to}
        className={[
          'flex items-center gap-2.5 px-2.5 py-1 rounded-md text-[12.5px] font-medium transition-colors',
          isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        ].join(' ')}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {joined.length > 0 && <ChevronRight size={12} className="opacity-50" />}
      </NavLink>
      {flyout}
    </div>
  );
}

interface SidebarProps {
  width?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ width, collapsed = false, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appearanceOpen) return;
    function handler(e: MouseEvent) {
      if (appearanceRef.current && !appearanceRef.current.closest('[data-appearance-root]')?.contains(e.target as Node)) {
        setAppearanceOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [appearanceOpen]);

  if (!user) return null;

  const items = NAV_ITEMS[user.role] ?? [];
  const displayName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username;

  return (
    <aside
      className="fixed top-10 bottom-0 left-0 z-20 flex flex-col bg-white border-r border-gray-200 overflow-hidden transition-all duration-200"
      style={{ width: width ?? 204 }}
    >
      {/* Role label */}
      <div className={['px-4 py-2.5 shrink-0', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed
          ? <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          : (
            <span className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400">
              {ROLE_LABEL[user.role]}
            </span>
          )
        }
      </div>

      {/* Nav */}
      <nav className={['flex-1 overflow-y-auto px-2 py-2', collapsed ? 'flex flex-col items-center gap-1' : 'space-y-0.5'].join(' ')}>
        {items.map(item => item.label === 'Workspaces' ? (
          <WorkspacesNavItem
            key={item.to}
            item={item}
            collapsed={collapsed}
            isActive={location.pathname === '/workspaces' || location.pathname.startsWith('/workspaces/')}
          />
        ) : collapsed ? (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center justify-center w-9 h-9 rounded-lg transition-colors relative group/tip',
                isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <Tooltip label={item.label} />
          </NavLink>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-2.5 py-1 rounded-md text-[12.5px] font-medium transition-colors',
                isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="relative px-3.5 py-3 bg-gray-50 border-t border-gray-100 shrink-0" data-appearance-root>
        {collapsed ? (
          <div className="flex justify-center">
            <Avatar name={displayName} src={user.profile_picture ?? undefined} size="sm" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar name={displayName} src={user.profile_picture ?? undefined} size="sm" />
            <span className="text-[11.5px] text-gray-600 truncate flex-1">{displayName}</span>
            <button
              onClick={() => setAppearanceOpen(o => !o)}
              title="Appearance settings"
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Settings size={14} />
            </button>
          </div>
        )}

        {/* Appearance popup */}
        {appearanceOpen && !collapsed && (
          <div
            ref={appearanceRef}
            className="fixed bottom-16 left-0 w-[50vw] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-[13px] font-bold text-gray-900">Appearance</p>
              <button
                onClick={() => setAppearanceOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
              <ThemePicker />
              <div>
                <p className="text-[12px] font-semibold text-gray-700 mb-2">Font style</p>
                <FontPicker upward />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className={[
          'flex items-center py-2.5 border-t border-gray-100 text-[12px] font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0',
          collapsed ? 'justify-center px-0' : 'gap-1.5 px-3',
        ].join(' ')}
      >
        {collapsed
          ? <ChevronRight size={14} />
          : <><ChevronLeft size={14} /><span>Collapse</span></>
        }
      </button>
    </aside>
  );
}
