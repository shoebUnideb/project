import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, Clock3, FileText, Link as LinkIcon,
  ExternalLink, Copy, Check, Megaphone, Pencil, MessageCircle, Settings,
  ChevronRight, Globe, Upload, UserPlus, MoreHorizontal,
  CheckCircle2, Circle, Folder, CheckSquare, MessageSquare, Leaf,
  Plus, Trash2, X, Pin,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApiList, useApi } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import { sessionsApi } from '../../api/sessions';
import apiClient from '../../api/apiClient';
import type { WorkspaceChatMessage, WorkspaceMembers, WorkspaceResource, WorkspaceTask, MentorSession, WorkspaceEvent, FeedPost } from '../../types';
import Avatar from '../../components/ui/Avatar';
import { relativeTime } from '../../utils/time';
import WorkspaceFeed from '../../components/workspace/WorkspaceFeed';
import { ConfirmDialog } from './tasks/ConfirmDialog';

function fmt12h(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function shortTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60)  return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getFileInfo(r: WorkspaceResource): { iconBg: string; iconColor: string; typeLabel: string } {
  if (r.resource_type === 'link') return { iconBg: '#fdf3ec', iconColor: '#cf6535', typeLabel: 'Link' };
  if (r.resource_type === 'note') return { iconBg: '#fffbeb', iconColor: '#f59e0b', typeLabel: 'Note' };
  const ext = (r.file_url ?? r.file ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf')                             return { iconBg: '#fef2f2', iconColor: '#ef4444', typeLabel: 'PDF'     };
  if (['doc', 'docx'].includes(ext))             return { iconBg: '#fdf3ec', iconColor: '#cf6535', typeLabel: 'DOCX'    };
  if (['xls', 'xlsx'].includes(ext))             return { iconBg: '#f0fdf4', iconColor: '#22c55e', typeLabel: 'XLSX'    };
  if (['ppt', 'pptx'].includes(ext))             return { iconBg: '#fff7ed', iconColor: '#f97316', typeLabel: 'PPT'     };
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return { iconBg: '#f0fdfa', iconColor: '#0d9488', typeLabel: 'Image' };
  if (['zip','rar','7z'].includes(ext))          return { iconBg: '#faf5ff', iconColor: '#9333ea', typeLabel: 'Archive' };
  return { iconBg: '#f8fafc', iconColor: '#64748b', typeLabel: 'File' };
}

type ActivityKind = 'resource' | 'task' | 'message' | 'member';

function getActivityIcon(kind: ActivityKind): { bg: string; fg: string; icon: React.ReactNode } {
  switch (kind) {
    case 'resource': return { bg: '#f0fdf4', fg: '#16a34a', icon: <BookOpen size={13} />      };
    case 'task':     return { bg: '#fff7ed', fg: '#f97316', icon: <CheckSquare size={13} />   };
    case 'message':  return { bg: '#f5f3ff', fg: '#9333ea', icon: <MessageCircle size={13} /> };
    case 'member':   return { bg: '#fdf3ec', fg: '#cf6535', icon: <UserPlus size={13} />      };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function WorkspaceHome() {
  const { workspace, isOwner, isMentor, refetch } = useWorkspace();
  const canWrite = isOwner || isMentor;
  const navigate = useNavigate();

  const [editingAnn, setEditingAnn]             = useState(false);
  const [annDraft, setAnnDraft]                 = useState('');
  const [savingAnn, setSavingAnn]               = useState(false);
  const [editingWelcome, setEditingWelcome]     = useState(false);
  const [welcomeDraft, setWelcomeDraft]         = useState('');
  const [savingWelcome, setSavingWelcome]       = useState(false);
  const [tipDismissed, setTipDismissed]         = useState(false);
  const [resourceMenu, setResourceMenu]         = useState<number | null>(null);
  const [descExpanded, setDescExpanded]         = useState(false);
  const [pinnedPosts, setPinnedPosts]           = useState<FeedPost[]>([]);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<number | null>(null);
  const [deletingEvent, setDeletingEvent]       = useState(false);

  const handlePostsChange = useCallback((posts: FeedPost[]) => {
    setPinnedPosts(posts.filter(p => p.is_pinned));
  }, []);

  // Event state: null = closed, 0 = new, number = editing existing id
  const [eventFormId, setEventFormId]       = useState<number | null>(null);
  const [eventDraft, setEventDraft]         = useState({ title: '', date: '', start_time: '', end_time: '', description: '', link: '' });
  const [savingEvent, setSavingEvent]       = useState(false);

  const wid = workspace?.id ?? 0;
  const { data: resources }    = useApiList<WorkspaceResource>(() => workspacesApi.getResources(wid), [wid]);
  const { data: chatMessages } = useApiList<WorkspaceChatMessage>(() => workspacesApi.getChatMessages(wid), [wid]);
  const { data: membersData }  = useApi<WorkspaceMembers>(() => workspacesApi.getMembers(wid), [wid]);
  const { data: tasks }        = useApiList<WorkspaceTask>(() => workspacesApi.getTasks(wid), [wid]);
  const { data: sessions }     = useApiList<MentorSession>(() => sessionsApi.list());
  const { data: allEvents, refetch: refetchEvents } = useApiList<WorkspaceEvent>(() => workspacesApi.getEvents(wid), [wid]);

  const approved = membersData?.approved ?? [];
  const pending  = membersData?.pending  ?? [];

  // Last activity timestamp (short format e.g. "2h")
  const lastActivityStr = useMemo(() => {
    const stamps = [
      ...chatMessages.map(m => m.created_at),
      ...resources.map(r => r.created_at),
      ...approved.map(m => m.approved_at ?? m.requested_at),
    ].filter(Boolean) as string[];
    if (!stamps.length) return null;
    return shortTimeAgo(stamps.reduce((a, b) => (a > b ? a : b)));
  }, [chatMessages, resources, approved]);

  // Activity feed merged from all sources, sorted by date desc, top 5
  const activityFeed = useMemo(() => {
    type AI = { id: string; kind: ActivityKind; primary: string; secondary: string; personName?: string; time: string };
    const items: AI[] = [];

    resources.forEach(r => items.push({
      id:        `r${r.id}`,
      kind:      'resource',
      primary:   r.title,
      secondary: `was uploaded to Resources`,
      time:      r.created_at,
    }));

    tasks.forEach(t => items.push({
      id:        `t${t.id}`,
      kind:      'task',
      primary:   t.title,
      secondary: 'was updated',
      time:      t.updated_at,
    }));

    approved.forEach(m => {
      const name = `${m.student.user.first_name ?? ''} ${m.student.user.last_name ?? ''}`.trim() || m.student.user.username;
      items.push({
        id:         `m${m.id}`,
        kind:       'member',
        primary:    name,
        secondary:  'joined the workspace',
        personName: name,
        time:       m.approved_at ?? m.requested_at,
      });
    });

    return items.sort((a, b) => (b.time > a.time ? 1 : -1)).slice(0, 5);
  }, [resources, tasks, approved]);

  if (!workspace) return null;

  const base        = `/w/${workspace.slug}`;
  const createdLabel = new Date(workspace.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const showTip     = isOwner && !tipDismissed && (workspace.member_count <= 1 || workspace.resource_count === 0 || tasks.length === 0);
  const visibleResources = resources.filter(r => !r.is_hidden);

  // Next upcoming confirmed session
  const today = new Date().toISOString().slice(0, 10);
  const nextSession: MentorSession | null = sessions
    .filter(s => s.status === 'confirmed' && s.date >= today)
    .sort((a, b) => (a.date + a.start_time) > (b.date + b.start_time) ? 1 : -1)[0] ?? null;

  // Upcoming events (today or future), sorted
  const upcomingEvents = allEvents.filter(e => e.date >= today);

  const saveAnn = async () => {
    setSavingAnn(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.updateAnnouncement(workspace.id, annDraft);
      setEditingAnn(false);
      refetch();
    } finally {
      setSavingAnn(false);
    }
  };

  const saveWelcome = async () => {
    setSavingWelcome(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.updateWelcomeMessage(workspace.id, welcomeDraft);
      setEditingWelcome(false);
      refetch();
    } finally {
      setSavingWelcome(false);
    }
  };

  const saveEvent = async () => {
    setSavingEvent(true);
    try {
      await apiClient.initCsrf();
      const payload = {
        title:       eventDraft.title,
        date:        eventDraft.date        || null,
        start_time:  eventDraft.start_time  || null,
        end_time:    eventDraft.end_time     || null,
        description: eventDraft.description,
        link:        eventDraft.link,
      };
      if (eventFormId === 0) {
        await workspacesApi.createEvent(workspace!.id, payload);
      } else {
        await workspacesApi.updateEvent(workspace!.id, eventFormId!, payload);
      }
      setEventFormId(null);
      refetchEvents();
    } finally {
      setSavingEvent(false);
    }
  };

  const openNewEvent = () => {
    setEventDraft({ title: '', date: '', start_time: '', end_time: '', description: '', link: '' });
    setEventFormId(0);
  };

  const openEditEvent = (ev: WorkspaceEvent) => {
    setEventDraft({
      title:       ev.title,
      date:        ev.date,
      start_time:  ev.start_time ?? '',
      end_time:    ev.end_time   ?? '',
      description: ev.description,
      link:        ev.link,
    });
    setEventFormId(ev.id);
  };

  const deleteEvent = async (eid: number) => {
    setDeletingEvent(true);
    await apiClient.initCsrf();
    await workspacesApi.deleteEvent(workspace!.id, eid);
    setConfirmDeleteEventId(null);
    setDeletingEvent(false);
    refetchEvents();
  };

  return (
    <div className="flex gap-6 items-start">

      {confirmDeleteEventId !== null && (
        <ConfirmDialog
          title="Delete event?"
          message="This event will be permanently removed from the workspace."
          confirmLabel="Delete"
          variant="danger"
          loading={deletingEvent}
          onConfirm={() => deleteEvent(confirmDeleteEventId)}
          onCancel={() => setConfirmDeleteEventId(null)}
        />
      )}

      {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* 1 — Hero banner */}
        <div className="rounded-2xl overflow-hidden relative bg-primary-600">
          {workspace.cover_image_url && (
            <>
              <img
                src={workspace.cover_image_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.45) 100%)' }} />
            </>
          )}
          <div className="relative z-10 px-7 pt-6 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-[22px] font-extrabold leading-tight mb-2">
                  {workspace.name}
                </h1>
                {workspace.description && (
                  <div className="mb-4 max-w-xl">
                    <p className={`text-white/80 text-[13px] leading-relaxed whitespace-pre-wrap text-justify ${descExpanded ? '' : 'line-clamp-3'}`}>
                      {workspace.description}
                    </p>
                    {workspace.description.length > 160 && (
                      <button
                        onClick={() => setDescExpanded(v => !v)}
                        className="mt-1 text-[12px] text-white/60 hover:text-white font-medium transition-colors"
                      >
                        {descExpanded ? 'Show less' : 'View more'}
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-5 text-white/75 text-[12.5px] flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Users size={13} className="text-white/60" />
                    <strong className="text-white font-semibold">{workspace.member_count}</strong>
                    &nbsp;{workspace.member_count === 1 ? 'Member' : 'Members'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={13} className="text-white/60" />
                    <strong className="text-white font-semibold">{workspace.resource_count}</strong>
                    &nbsp;{workspace.resource_count === 1 ? 'Resource' : 'Resources'}
                  </span>
                  <span className="flex items-center gap-1.5 text-white/60">
                    <Clock3 size={13} />
                    Created on {createdLabel}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 shrink-0">
                <Avatar name={workspace.mentor_name} src={workspace.mentor_picture} size="lg" />
                {isOwner && (
                  <button
                    onClick={() => navigate(`${base}/settings`)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white text-[12px] font-semibold rounded-lg transition-colors"
                  >
                    <Settings size={12} /> Workspace settings
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2 — Feed (compose box + announcement/welcome slot + posts) */}
        <WorkspaceFeed workspaceId={workspace.id} onPostsChange={handlePostsChange}>
        {/* 3 — Announcement + Welcome */}
        <div className="grid grid-cols-2 gap-4">
          {/* Announcement */}
          {(workspace.announcement || canWrite) && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone size={15} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[10.5px] font-extrabold text-orange-500 uppercase tracking-widest">Announcement</p>
                    {canWrite && !editingAnn && (
                      <button
                        onClick={() => { setAnnDraft(workspace.announcement); setEditingAnn(true); }}
                        className="text-orange-400 hover:text-orange-600 transition-colors"
                      >
                        <Pencil size={10} />
                      </button>
                    )}
                  </div>

                  {editingAnn ? (
                    <div className="space-y-2">
                      <textarea
                        value={annDraft}
                        onChange={e => setAnnDraft(e.target.value)}
                        rows={4}
                        placeholder="Write an announcement…"
                        className="w-full text-[12.5px] px-2.5 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white resize-none"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={saveAnn}
                          disabled={savingAnn}
                          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-[11.5px] font-semibold rounded-lg transition-colors"
                        >
                          {savingAnn ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingAnn(false)}
                          className="px-3 py-1 text-orange-600 text-[11.5px] hover:bg-orange-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : workspace.announcement ? (
                    <>
                      <p className="text-[13px] text-gray-800 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                        {workspace.announcement}
                      </p>
                      <button className="mt-2.5 text-[12px] text-orange-500 hover:text-orange-700 font-medium transition-colors">
                        View all
                      </button>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-orange-400 italic">No announcement yet — click the pencil to add one.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Welcome message */}
          {(workspace.welcome_message || canWrite) && (
            <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10.5px] font-extrabold text-primary-600 uppercase tracking-widest">Welcome</p>
                {canWrite && !editingWelcome && (
                  <button
                    onClick={() => { setWelcomeDraft(workspace.welcome_message); setEditingWelcome(true); }}
                    className="text-primary-400 hover:text-primary-600 transition-colors"
                  >
                    <Pencil size={10} />
                  </button>
                )}
              </div>

              {editingWelcome ? (
                <div className="space-y-2">
                  <textarea
                    value={welcomeDraft}
                    onChange={e => setWelcomeDraft(e.target.value)}
                    rows={4}
                    placeholder="Write a welcome message for your members…"
                    className="w-full text-[12.5px] px-2.5 py-2 border border-primary-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white resize-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={saveWelcome}
                      disabled={savingWelcome}
                      className="px-3 py-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[11.5px] font-semibold rounded-lg transition-colors"
                    >
                      {savingWelcome ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingWelcome(false)}
                      className="px-3 py-1 text-primary-600 text-[11.5px] hover:bg-primary-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : workspace.welcome_message ? (
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {workspace.welcome_message}
                </p>
              ) : (
                <p className="text-[12.5px] text-primary-400 italic">No welcome message yet — click the pencil to add one.</p>
              )}
            </div>
          )}
        </div>
        </WorkspaceFeed>

        {/* 4 — Tip bar */}
        {showTip && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <Leaf size={14} className="text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-gray-800">Tip</span>
              <span className="text-[13px] text-gray-500"> · Complete your workspace by adding members, uploading important resources and creating tasks.</span>
            </div>
            <button
              onClick={() => setTipDismissed(true)}
              className="text-[12.5px] text-gray-500 hover:text-gray-900 font-medium transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

      </div>{/* end LEFT COLUMN */}

      {/* ── RIGHT SIDEBAR ───────────────────────────────────────────────── */}
      <div className="w-[288px] shrink-0 space-y-4">

        {/* 1 — Workspace overview (owner only) */}
        {isOwner && (
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-5">
          <p className="text-[15px] font-bold text-gray-900 mb-3.5">Workspace overview</p>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: 'Members',       value: String(workspace.member_count),   iconBg: '#fdf3ec', iconFg: '#cf6535', icon: <Users size={16} />       },
              { label: 'Resources',     value: String(workspace.resource_count), iconBg: '#f0fdf4', iconFg: '#22c55e', icon: <Folder size={16} />      },
              { label: 'Tasks',         value: String(tasks.length),             iconBg: '#fffbeb', iconFg: '#f59e0b', icon: <CheckSquare size={16} /> },
              { label: 'Last activity', value: lastActivityStr ?? '—',           iconBg: '#f5f3ff', iconFg: '#8b5cf6', icon: <Clock3 size={16} />      },
            ] as const).map((tile, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: tile.iconBg, color: tile.iconFg }}
                >
                  {tile.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[18px] font-extrabold text-gray-900 leading-none truncate">{tile.value}</p>
                  <p className="text-[10.5px] text-gray-400 font-medium mt-0.5">{tile.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* 2 — Pinned posts */}
        {pinnedPosts.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e0e0e0] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#f0f0f0]">
              <Pin size={13} className="text-amber-500 fill-amber-400 shrink-0" />
              <p className="text-[13px] font-bold text-gray-800">Pinned posts</p>
              <span className="ml-auto text-[11px] font-semibold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">
                {pinnedPosts.length}
              </span>
            </div>
            <div className="divide-y divide-[#f5f5f5]">
              {pinnedPosts.map(post => {
                const plain = post.body.replace(/<[^>]*>/g, '').trim();
                return (
                  <div key={post.id} className="flex items-start gap-2.5 px-4 py-3">
                    {post.image && (
                      <img
                        src={post.image}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-100"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-700 leading-snug line-clamp-2">{plain || '(image post)'}</p>
                      <p className="text-[10.5px] text-gray-400 mt-0.5">{relativeTime(post.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5 — Upcoming */}
        {(upcomingEvents.length > 0 || nextSession || canWrite) && (
          <div className="bg-white rounded-xl border border-[#e0e0e0] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <p className="text-[15px] font-bold text-gray-900">Upcoming</p>
              <div className="flex items-center gap-3">
                {upcomingEvents.length > 0 && (
                  <span className="text-[12px] text-gray-400 font-medium flex items-center gap-1">
                    View all <ChevronRight size={13} />
                  </span>
                )}
                {canWrite && eventFormId === null && (
                  <button
                    onClick={openNewEvent}
                    className="text-[11.5px] text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} /> Add event
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-[#f0f0f0]">
              {/* Inline event form (new or edit) */}
              {eventFormId !== null && (
                <div className="space-y-2.5 p-4 bg-gray-50">
                  <p className="text-[11.5px] font-bold text-gray-600 uppercase tracking-widest">
                    {eventFormId === 0 ? 'New event' : 'Edit event'}
                  </p>
                  <input
                    type="text"
                    placeholder="Event title *"
                    value={eventDraft.title}
                    onChange={e => setEventDraft(d => ({ ...d, title: e.target.value }))}
                    className="w-full text-[13px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  />
                  <input
                    type="date"
                    value={eventDraft.date}
                    onChange={e => setEventDraft(d => ({ ...d, date: e.target.value }))}
                    className="w-full text-[13px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1 font-medium">Start time</p>
                      <input
                        type="time"
                        value={eventDraft.start_time}
                        onChange={e => setEventDraft(d => ({ ...d, start_time: e.target.value }))}
                        className="w-full text-[13px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1 font-medium">End time</p>
                      <input
                        type="time"
                        value={eventDraft.end_time}
                        onChange={e => setEventDraft(d => ({ ...d, end_time: e.target.value }))}
                        className="w-full text-[13px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Short description (optional)"
                    value={eventDraft.description}
                    onChange={e => setEventDraft(d => ({ ...d, description: e.target.value }))}
                    className="w-full text-[13px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  />
                  <input
                    type="url"
                    placeholder="Meeting / join link (optional)"
                    value={eventDraft.link}
                    onChange={e => setEventDraft(d => ({ ...d, link: e.target.value }))}
                    className="w-full text-[13px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEvent}
                      disabled={savingEvent || !eventDraft.title || !eventDraft.date}
                      className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition-colors"
                    >
                      {savingEvent ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEventFormId(null)}
                      className="px-3 py-1.5 text-gray-600 text-[12px] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Event rows — new reference layout */}
              {upcomingEvents.map(ev => {
                const d = new Date(ev.date + 'T00:00:00');
                const monthStr = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const weekdayStr = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                let domain = '';
                if (ev.link) {
                  try { domain = new URL(ev.link).hostname.replace('www.', ''); } catch { domain = ev.link; }
                }
                return (
                  <div key={ev.id} className="flex items-center gap-0 px-5 py-4">
                    {/* Date column */}
                    <div className="flex flex-col items-center w-[44px] shrink-0">
                      <p className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest leading-none">{monthStr}</p>
                      <p className="text-[28px] font-black text-gray-900 leading-tight">{d.getDate()}</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest leading-none">{weekdayStr}</p>
                    </div>

                    {/* Vertical divider */}
                    <div className="w-px self-stretch bg-gray-200 mx-4 shrink-0" />

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13.5px] font-bold text-gray-900 leading-snug line-clamp-1 flex-1">{ev.title}</p>
                          {canWrite && eventFormId === null && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => openEditEvent(ev)} className="p-1 text-gray-300 hover:text-primary-600 transition-colors" title="Edit">
                                <Pencil size={11} />
                              </button>
                              <button onClick={() => setConfirmDeleteEventId(ev.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                        {domain && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <LinkIcon size={11} className="text-gray-400 shrink-0" />
                            <span className="text-[12px] text-gray-500 truncate">{domain}</span>
                          </div>
                        )}
                        {ev.start_time && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock3 size={11} className="text-gray-400 shrink-0" />
                            <span className="text-[12px] text-gray-500">
                              {fmt12h(ev.start_time)}{ev.end_time ? ` – ${fmt12h(ev.end_time)}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      {ev.link && (
                        <a href={ev.link} target="_blank" rel="noreferrer"
                          className="shrink-0 px-4 py-2 text-[12.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Next confirmed session fallback */}
              {upcomingEvents.length === 0 && nextSession && (() => {
                const d = new Date(nextSession.date + 'T00:00:00');
                const monthStr = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const weekdayStr = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                return (
                  <div className="flex items-center gap-0 px-5 py-4">
                    <div className="flex flex-col items-center w-[44px] shrink-0">
                      <p className="text-[10px] font-extrabold text-primary-600 uppercase tracking-widest leading-none">{monthStr}</p>
                      <p className="text-[28px] font-black text-gray-900 leading-tight">{d.getDate()}</p>
                      <p className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest leading-none">{weekdayStr}</p>
                    </div>
                    <div className="w-px self-stretch bg-gray-200 mx-4 shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-bold text-gray-900 leading-snug line-clamp-1">{nextSession.title || 'Session'}</p>
                        {nextSession.start_time && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock3 size={11} className="text-gray-400 shrink-0" />
                            <span className="text-[12px] text-gray-500">
                              {fmt12h(nextSession.start_time)}{nextSession.end_time ? ` – ${fmt12h(nextSession.end_time)}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      {nextSession.meeting_link && (
                        <a href={nextSession.meeting_link} target="_blank" rel="noreferrer"
                          className="shrink-0 px-4 py-2 text-[12.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Owner empty state */}
              {upcomingEvents.length === 0 && !nextSession && canWrite && eventFormId === null && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-[12.5px] text-gray-400 mb-3">No upcoming events yet</p>
                  <button
                    onClick={openNewEvent}
                    className="px-3.5 py-1.5 text-[12px] font-semibold text-white rounded-lg bg-primary-600 hover:bg-primary-700 transition-colors"
                  >
                    Schedule first event
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


        {/* 4 — Recent activity */}
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-4">
          <div className="mb-3">
            <p className="text-[13.5px] font-bold text-gray-900">Recent activity</p>
          </div>

          {activityFeed.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {activityFeed.map(item => {
                const ai = getActivityIcon(item.kind);
                return (
                  <div key={item.id} className="flex items-center gap-2.5">
                    {item.kind === 'member' ? (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-extrabold text-white bg-primary-600"
                      >
                        {(item.personName ?? 'U').charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: ai.bg, color: ai.fg }}
                      >
                        {ai.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate leading-snug">{item.primary}</p>
                      <p className="text-[11px] text-gray-400 truncate">{item.secondary}</p>
                    </div>
                    <span className="text-[10.5px] text-gray-400 shrink-0 whitespace-nowrap">
                      {relativeTime(item.time)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5 — Pinned resources */}
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13.5px] font-bold text-gray-900">Pinned resources</p>
            <Link
              to={`${base}/resources`}
              className="text-[11.5px] text-primary-600 hover:text-primary-800 font-medium flex items-center gap-0.5"
            >
              View all <ChevronRight size={11} />
            </Link>
          </div>

          {visibleResources.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-4">No resources yet</p>
          ) : (
            <div className="space-y-2">
              {visibleResources.slice(0, 5).map(r => {
                const fi  = getFileInfo(r);
                const url = r.resource_type === 'link' ? r.url : r.file_url;
                return (
                  <div key={r.id} className="flex items-center gap-2.5 group py-0.5 relative">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: fi.iconBg, color: fi.iconColor }}
                    >
                      {r.resource_type === 'link' ? <Globe size={13} /> : <FileText size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate leading-snug">{r.title}</p>
                      <p className="text-[11px] text-gray-400">{fi.typeLabel}</p>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setResourceMenu(resourceMenu === r.id ? null : r.id)}
                        className="p-1 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                      {resourceMenu === r.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e0e0e0] rounded-xl shadow-lg z-20 py-1.5 w-36">
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setResourceMenu(null)}
                              className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-gray-700 hover:bg-gray-50"
                            >
                              <ExternalLink size={12} /> Open
                            </a>
                          )}
                          <Link
                            to={`${base}/resources`}
                            onClick={() => setResourceMenu(null)}
                            className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-gray-700 hover:bg-gray-50"
                          >
                            <BookOpen size={12} /> All resources
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3 — Tasks overview */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e0e0e0] p-5">
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[15px] font-bold text-gray-900">Tasks overview</p>
              <Link to={`${base}/tasks`} className="text-[12px] text-primary-600 hover:text-primary-800 font-medium">
                View all
              </Link>
            </div>
            <div className="space-y-2.5">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  {t.my_submission_status === 'completed'
                    ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                    : <Circle size={15} className="text-gray-300 shrink-0" />
                  }
                  <p className={`text-[12.5px] flex-1 truncate ${t.my_submission_status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {t.title}
                  </p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: t.status === 'published' ? '#f0fdf4' : '#f1f5f9', color: t.status === 'published' ? '#16a34a' : '#475569' }}>
                    {t.status === 'published' ? 'Active' : t.status === 'draft' ? 'Draft' : 'Archived'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4 — Quick actions (owner only) */}
        {isOwner && (
        <div className="bg-white rounded-xl border border-[#e0e0e0] p-5">
          <p className="text-[15px] font-bold text-gray-900 mb-3.5">Quick actions</p>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: 'Add member',      to: `${base}/members`,   iconBg: '#fdf3ec', iconFg: '#cf6535', icon: <UserPlus size={16} />       },
              { label: 'Upload resource', to: `${base}/resources`, iconBg: '#f0fdf4', iconFg: '#22c55e', icon: <Upload size={16} />         },
              { label: 'Create task',     to: `${base}/tasks`,     iconBg: '#fffbeb', iconFg: '#f59e0b', icon: <CheckSquare size={16} />    },
              { label: 'Start chat',      to: `${base}/chat`,      iconBg: '#f5f3ff', iconFg: '#8b5cf6', icon: <MessageSquare size={16} /> },
            ] as const).map((a, i) => (
              <Link
                key={i}
                to={a.to}
                className="flex flex-col items-center gap-2 py-3.5 px-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-center"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: a.iconBg, color: a.iconFg }}
                >
                  {a.icon}
                </div>
                <p className="text-[12px] font-medium text-gray-700 leading-tight">{a.label}</p>
              </Link>
            ))}
          </div>
        </div>
        )}


      </div>{/* end RIGHT SIDEBAR */}

    </div>
  );
}
