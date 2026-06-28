import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, ChevronDown, LogOut, User, Search,
  CheckSquare, CheckCircle2, ClipboardList, UserPlus, XCircle,
  MessageSquare, Newspaper, Calendar, Clock, Settings, X,
  Trash2, Users, AtSign,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/apiClient';
import { relativeTime } from '../../utils/time';
import GlobalSearchModal from '../ui/GlobalSearchModal';
import AppSwitcher from '../../internal/AppSwitcher';

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

// ── Notification type → icon + colour ────────────────────────────────────────
const NOTIF_META: Record<string, { icon: React.ReactNode; bg: string }> = {
  step_submitted:       { icon: <CheckSquare   size={15} />, bg: 'bg-primary-500' },
  step_reviewed:        { icon: <CheckCircle2  size={15} />, bg: 'bg-emerald-500' },
  app_status:           { icon: <ClipboardList size={15} />, bg: 'bg-violet-500'  },
  ws_request:           { icon: <UserPlus      size={15} />, bg: 'bg-amber-500'   },
  ws_approved:          { icon: <CheckCircle2  size={15} />, bg: 'bg-emerald-500' },
  ws_rejected:          { icon: <XCircle       size={15} />, bg: 'bg-red-500'     },
  ws_invite:            { icon: <UserPlus      size={15} />, bg: 'bg-indigo-500'  },
  new_message:          { icon: <MessageSquare size={15} />, bg: 'bg-indigo-500'  },
  feed_post:            { icon: <Newspaper     size={15} />, bg: 'bg-rose-500'    },
  session:              { icon: <Calendar      size={15} />, bg: 'bg-teal-500'    },
  deadline:             { icon: <Clock         size={15} />, bg: 'bg-orange-500'  },
  task_reminder:        { icon: <CheckSquare   size={15} />, bg: 'bg-amber-500'   },
  mention:              { icon: <AtSign        size={15} />, bg: 'bg-purple-500'  },
  peer_review_assigned: { icon: <Users         size={15} />, bg: 'bg-teal-500'    },
};
const DEFAULT_NOTIF_META = { icon: <Bell size={15} />, bg: 'bg-gray-400' };

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Page context label ────────────────────────────────────────────────────────
function getPageLabel(pathname: string): string {
  if (/^\/(student|mentor|admin)\/dashboard/.test(pathname)) return 'Dashboard';
  if (pathname.startsWith('/mentor/students'))               return 'Students';
  if (pathname.startsWith('/admin/users'))                   return 'Users';
  if (pathname.startsWith('/admin/assignments'))             return 'Assignments';
  if (pathname.startsWith('/admin/settings'))                return 'Settings';
  if (/\/profile/.test(pathname))                            return 'My Profile';
  if (/messages/.test(pathname))                             return 'Messages';
  if (pathname.startsWith('/workspaces'))                    return 'Workspaces';
  if (pathname.startsWith('/feed'))                          return 'Feed';
  if (pathname.startsWith('/marketplace'))                   return 'Marketplace';
  if (pathname.startsWith('/w/'))                            return 'Workspace';
  return '';
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifs, setNotifs]             = useState<Notif[]>([]);
  const [unread, setUnread]             = useState(0);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifRef    = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageLabel = getPageLabel(location.pathname);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(p => !p); }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false); setDropdownOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current    && !notifRef.current.contains(e.target as Node))    setNotifOpen(false);
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifs = async () => {
    try {
      const data = await apiClient.get<{ results: Notif[]; unread: number }>('/api/notifications/?limit=20');
      setNotifs(data.results);
      setUnread(data.unread);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifs();
    pollRef.current = setInterval(fetchNotifs, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  const handleBellClick = async () => {
    setNotifOpen(p => !p);
    setDropdownOpen(false);
    if (!notifOpen && unread > 0) {
      try {
        await apiClient.post('/api/notifications/read/', {});
        setUnread(0);
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch { /* ignore */ }
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.post('/api/notifications/read/', {});
      setUnread(0);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const clearRead = async () => {
    try {
      await apiClient.initCsrf();
      await apiClient.delete('/api/notifications/clear/');
      setNotifs(prev => prev.filter(n => !n.is_read));
    } catch { /* ignore */ }
  };

  const deleteNotif = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await apiClient.initCsrf();
      await apiClient.delete(`/api/notifications/${id}/`);
      setNotifs(prev => {
        const next = prev.filter(n => n.id !== id);
        const wasUnread = prev.find(n => n.id === id)?.is_read === false;
        if (wasUnread) setUnread(u => Math.max(0, u - 1));
        return next;
      });
    } catch { /* ignore */ }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.username[0].toUpperCase()
    : '';

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
    : user?.username ?? '';

  const homeRoute =
    user?.role === 'mentor'     ? '/mentor/dashboard' :
    user?.role === 'student'    ? '/feed' :
    user?.role === 'superadmin' ? '/admin/dashboard' : '/';

  const profileRoute =
    user?.role === 'student' ? '/student/profile' :
    user?.role === 'mentor'  ? '/mentor/profile'  : '/admin/settings';

  const hasRead = notifs.some(n => n.is_read);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 h-10 bg-primary-600 flex items-center px-4 gap-3">

        {/* Brand + page context */}
        <Link to={homeRoute} className="hidden sm:flex items-center gap-2.5 shrink-0 self-stretch py-1">
          <div className="bg-white rounded h-full flex items-center px-1.5">
            <img src="/gile.png" alt="GILE Foundation" className="h-full w-auto" />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">GILE Foundation</span>
        </Link>
        {pageLabel && (
          <>
            <span className="text-white/30 text-[13px] select-none hidden sm:block">|</span>
            <span className="text-[12.5px] text-white/70 hidden sm:block">{pageLabel}</span>
          </>
        )}

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-0.5">

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1 text-[12px] text-white/70 border border-white/25 rounded-md hover:border-white/60 hover:text-white transition-colors w-[160px] md:w-[220px]"
          >
            <Search size={12} className="shrink-0" />
            <span className="flex-1 text-left hidden md:block">Search pages...</span>
            <kbd className="hidden md:inline text-[10px] bg-white/10 text-white/70 px-1 rounded font-mono leading-4">⌘K</kbd>
          </button>

          {/* Apps switcher */}
          <AppSwitcher />

          {/* ── Bell + notification panel ─────────────────────── */}
          <div ref={notifRef} className="relative">
            <button
              onClick={handleBellClick}
              className="relative p-2 rounded-md text-white/70 hover:bg-white/[0.12] hover:text-white transition-colors"
            >
              <Bell size={15} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-primary-600">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">

                {/* Panel header */}
                <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
                  <p className="text-[15px] font-bold text-gray-900">Notifications</p>
                  <div className="flex items-center gap-2">
                    {notifs.some(n => !n.is_read) && (
                      <button onClick={markAllRead}
                        className="text-[12px] font-medium text-primary-600 hover:text-primary-700 hover:underline transition-colors">
                        Mark all read
                      </button>
                    )}
                    {hasRead && (
                      <button onClick={clearRead}
                        className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={11} /> Clear read
                      </button>
                    )}
                    <button className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <Settings size={13} />
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div className="max-h-[440px] overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <Bell size={22} className="text-gray-300" />
                      </div>
                      <p className="text-[13.5px] font-semibold text-gray-700">You're all caught up</p>
                      <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">
                        New activity will appear here
                      </p>
                    </div>
                  ) : notifs.map(n => {
                    const meta      = NOTIF_META[n.type] ?? DEFAULT_NOTIF_META;
                    const cleanBody = n.body ? stripHtml(n.body) : '';
                    return (
                      <div
                        key={n.id}
                        className={[
                          'relative flex items-start gap-3.5 px-5 py-3.5 group',
                          'hover:bg-gray-50 transition-colors',
                          !n.is_read ? 'bg-primary-50/40' : '',
                        ].join(' ')}
                      >
                        {/* Unread dot */}
                        {!n.is_read && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                        )}

                        {/* Clickable area */}
                        <button
                          onClick={() => { setNotifOpen(false); if (n.link) navigate(n.link); }}
                          className="flex items-start gap-3.5 flex-1 min-w-0 text-left"
                        >
                          <div className={`shrink-0 w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center text-white`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2">
                              {n.title}
                            </p>
                            {cleanBody && (
                              <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                                {cleanBody}
                              </p>
                            )}
                            <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
                              {relativeTime(n.created_at)}
                            </p>
                          </div>
                        </button>

                        {/* Delete button — visible on hover */}
                        <button
                          onClick={e => deleteNotif(e, n.id)}
                          className="shrink-0 mt-0.5 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          title="Dismiss"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Footer — see all */}
                <div className="border-t border-gray-100 px-5 py-3">
                  <Link
                    to="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-[12.5px] font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    See all notifications →
                  </Link>
                </div>

              </div>
            )}
          </div>

          {/* ── User dropdown ─────────────────────────────────── */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => { setDropdownOpen(p => !p); setNotifOpen(false); }}
              className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-md hover:bg-white/[0.12] transition-colors"
            >
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={displayName}
                  className="w-7 h-7 rounded-md object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-md bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {initials}
                </div>
              )}
              <ChevronDown size={11} className="text-white/70" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt={displayName} className="w-9 h-9 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-primary-600 text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{displayName}</p>
                    <p className="text-[11px] text-gray-400 capitalize">@{user?.username}</p>
                  </div>
                </div>
                <Link
                  to={profileRoute}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50"
                >
                  <User size={13} /> My Profile
                </Link>
                <button
                  onClick={() => { setDropdownOpen(false); setLogoutConfirm(true); }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50"
                >
                  <LogOut size={13} /> Log out
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {searchOpen && <GlobalSearchModal onClose={() => setSearchOpen(false)} />}

      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[340px] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-gray-900">Log out?</p>
                <p className="text-[12.5px] text-gray-500 mt-0.5">You'll be returned to the login screen.</p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setLogoutConfirm(false)}
                className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
