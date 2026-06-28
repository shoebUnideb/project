import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { relativeTime } from '../../utils/time';

interface OrgNotif {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_COLOR: Record<string, string> = {
  // Access
  access_granted:        'bg-teal-500',
  access_revoked:        'bg-red-500',
  role_changed:          'bg-amber-500',
  department_assigned:   'bg-blue-500',
  // Onboarding
  onboarding_started:    'bg-teal-600',
  task_assigned:         'bg-indigo-500',
  task_overdue:          'bg-red-600',
  // Documents
  document_approved:     'bg-emerald-500',
  document_rejected:     'bg-red-400',
  agreement_posted:      'bg-violet-500',
  // Training
  training_assigned:     'bg-purple-500',
  // Events
  event_scheduled:       'bg-orange-400',
  checkin_due:           'bg-orange-500',
  // Contributions
  contribution_approved: 'bg-emerald-600',
  // Recruitment
  recruitment_request:   'bg-indigo-400',
  application_reviewed:  'bg-teal-600',
};

const TYPE_EMOJI: Record<string, string> = {
  // Access
  access_granted:        '🎉',
  access_revoked:        '🚫',
  role_changed:          '🔄',
  department_assigned:   '🏢',
  // Onboarding
  onboarding_started:    '🚀',
  task_assigned:         '📌',
  task_overdue:          '⚠️',
  // Documents
  document_approved:     '✅',
  document_rejected:     '❌',
  agreement_posted:      '📄',
  // Training
  training_assigned:     '🎓',
  // Events
  event_scheduled:       '📅',
  checkin_due:           '🔔',
  // Contributions
  contribution_approved: '⭐',
  // Recruitment
  recruitment_request:   '👋',
  application_reviewed:  '📋',
};

export default function OrgNotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState<OrgNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetch = async () => {
    try {
      const data = await apiClient.get<{ results: OrgNotif[]; unread: number }>('/api/org/notifications/');
      setNotifs(data.results);
      setUnread(data.unread);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetch();
    pollRef.current = setInterval(fetch, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleOpen = async () => {
    setOpen(p => !p);
    if (!open && unread > 0) {
      try {
        await apiClient.post('/api/org/notifications/', {});
        setUnread(0);
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch { /* ignore */ }
    }
  };

  const dismiss = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/api/org/notifications/${id}/`);
      setNotifs(prev => {
        const wasUnread = prev.find(n => n.id === id)?.is_read === false;
        if (wasUnread) setUnread(u => Math.max(0, u - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch { /* ignore */ }
  };

  const clearRead = async () => {
    const readIds = notifs.filter(n => n.is_read).map(n => n.id);
    await Promise.all(readIds.map(id => apiClient.delete(`/api/org/notifications/${id}/`).catch(() => {})));
    setNotifs(prev => prev.filter(n => !n.is_read));
  };

  const hasRead = notifs.some(n => n.is_read);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        title="Internal notifications"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-teal-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
            <p className="text-[15px] font-bold text-gray-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={async () => {
                    await apiClient.post('/api/org/notifications/', {});
                    setUnread(0);
                    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
                  }}
                  className="flex items-center gap-1 text-[12px] font-medium text-teal-600 hover:text-teal-700 hover:underline"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              {hasRead && (
                <button
                  onClick={clearRead}
                  className="flex items-center gap-1 text-[12px] font-medium text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={11} /> Clear read
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Bell size={20} className="text-gray-300" />
                </div>
                <p className="text-[13.5px] font-semibold text-gray-700">All caught up</p>
                <p className="text-[12px] text-gray-400 mt-1">Internal portal activity will appear here</p>
              </div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                className={[
                  'relative flex items-start gap-3.5 px-5 py-3.5 group hover:bg-gray-50 transition-colors',
                  !n.is_read ? 'bg-teal-50/40' : '',
                ].join(' ')}
              >
                {!n.is_read && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                )}

                <button
                  onClick={() => { setOpen(false); if (n.link) navigate(n.link); }}
                  className="flex items-start gap-3.5 flex-1 min-w-0 text-left"
                >
                  <div className={`shrink-0 w-9 h-9 rounded-full ${TYPE_COLOR[n.type] ?? 'bg-gray-400'} flex items-center justify-center text-[16px]`}>
                    {TYPE_EMOJI[n.type] ?? '🔔'}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2">{n.title}</p>
                    {n.body && (
                      <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1.5 font-medium">{relativeTime(n.created_at)}</p>
                  </div>
                </button>

                <button
                  onClick={e => dismiss(e, n.id)}
                  className="shrink-0 mt-0.5 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
