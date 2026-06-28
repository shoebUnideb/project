import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckSquare, CheckCircle2, ClipboardList, UserPlus, XCircle,
  MessageSquare, Newspaper, Calendar, Clock, Users, AtSign,
  Trash2, X, Check,
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import { relativeTime } from '../../utils/time';

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

interface NotifResponse {
  results: Notif[];
  unread: number;
  total: number;
  page: number;
  has_more: boolean;
}

const NOTIF_META: Record<string, { icon: React.ReactNode; bg: string }> = {
  step_submitted:       { icon: <CheckSquare   size={16} />, bg: 'bg-primary-500' },
  step_reviewed:        { icon: <CheckCircle2  size={16} />, bg: 'bg-emerald-500' },
  app_status:           { icon: <ClipboardList size={16} />, bg: 'bg-violet-500'  },
  ws_request:           { icon: <UserPlus      size={16} />, bg: 'bg-amber-500'   },
  ws_approved:          { icon: <CheckCircle2  size={16} />, bg: 'bg-emerald-500' },
  ws_rejected:          { icon: <XCircle       size={16} />, bg: 'bg-red-500'     },
  ws_invite:            { icon: <UserPlus      size={16} />, bg: 'bg-indigo-500'  },
  new_message:          { icon: <MessageSquare size={16} />, bg: 'bg-indigo-500'  },
  feed_post:            { icon: <Newspaper     size={16} />, bg: 'bg-rose-500'    },
  session:              { icon: <Calendar      size={16} />, bg: 'bg-teal-500'    },
  deadline:             { icon: <Clock         size={16} />, bg: 'bg-orange-500'  },
  task_reminder:        { icon: <CheckSquare   size={16} />, bg: 'bg-amber-500'   },
  mention:              { icon: <AtSign        size={16} />, bg: 'bg-purple-500'  },
  peer_review_assigned: { icon: <Users         size={16} />, bg: 'bg-teal-500'    },
};
const DEFAULT_META = { icon: <Bell size={16} />, bg: 'bg-gray-400' };

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [hasMore, setHasMore]   = useState(false);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unread, setUnread]     = useState(0);

  const load = useCallback(async (p: number, append: boolean) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const data = await apiClient.get<NotifResponse>(
        `/api/notifications/?page=${p}&limit=${PAGE_SIZE}`
      );
      setNotifs(prev => append ? [...prev, ...data.results] : data.results);
      setHasMore(data.has_more);
      setUnread(data.unread);
      setPage(p);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1, false); }, [load]);

  const markAllRead = async () => {
    try {
      await apiClient.post('/api/notifications/read/', {});
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  const clearRead = async () => {
    try {
      await apiClient.initCsrf();
      await apiClient.delete('/api/notifications/clear/');
      setNotifs(prev => prev.filter(n => !n.is_read));
    } catch { /* ignore */ }
  };

  const deleteOne = async (id: number) => {
    try {
      await apiClient.initCsrf();
      await apiClient.delete(`/api/notifications/${id}/`);
      setNotifs(prev => {
        const wasUnread = prev.find(n => n.id === id)?.is_read === false;
        if (wasUnread) setUnread(u => Math.max(0, u - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch { /* ignore */ }
  };

  const handleClick = (n: Notif) => {
    if (!n.is_read) {
      apiClient.post('/api/notifications/read/', { ids: [n.id] });
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread(u => Math.max(0, u - 1));
    }
    if (n.link) navigate(n.link);
  };

  const hasRead = notifs.some(n => n.is_read);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Notifications</h1>
          {unread > 0 && (
            <p className="text-[13px] text-gray-500 mt-0.5">{unread} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold text-primary-600 border border-primary-200 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
              <Check size={13} /> Mark all read
            </button>
          )}
          {hasRead && (
            <button onClick={clearRead}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold text-gray-500 border border-gray-200 bg-white hover:text-red-500 hover:border-red-200 rounded-lg transition-colors">
              <Trash2 size={13} /> Clear read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {notifs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Bell size={26} className="text-gray-300" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">All caught up</p>
          <p className="text-[13px] text-gray-400 mt-1">New activity will appear here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifs.map(n => {
            const meta      = NOTIF_META[n.type] ?? DEFAULT_META;
            const cleanBody = n.body ? stripHtml(n.body) : '';
            return (
              <div
                key={n.id}
                className={[
                  'relative flex items-start gap-4 p-4 rounded-xl border group cursor-pointer transition-all',
                  !n.is_read
                    ? 'bg-primary-50/50 border-primary-100 hover:bg-primary-50'
                    : 'bg-white border-gray-100 hover:bg-gray-50',
                ].join(' ')}
                onClick={() => handleClick(n)}
              >
                {/* Unread dot */}
                {!n.is_read && (
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500" />
                )}

                {/* Icon */}
                <div className={`shrink-0 w-10 h-10 rounded-full ${meta.bg} flex items-center justify-center text-white`}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13.5px] leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {n.title}
                  </p>
                  {cleanBody && (
                    <p className="text-[12.5px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
                      {cleanBody}
                    </p>
                  )}
                  <p className="text-[11.5px] text-gray-400 mt-1.5">
                    {relativeTime(n.created_at)}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); deleteOne(n.id); }}
                  className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => load(page + 1, true)}
            disabled={loadingMore}
            className="px-5 py-2.5 text-[13px] font-semibold text-primary-600 border border-primary-200 bg-white hover:bg-primary-50 rounded-xl transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

    </div>
  );
}
