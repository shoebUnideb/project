import { useState } from 'react';
import { Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ExternalLink, FileText,
  Link as LinkIcon, StickyNote, CheckCircle2, Clock,
  Users, BookOpen, ClipboardList, UserCheck, XCircle, Megaphone, Pencil, Download, Layers, MessageCircle,
  Target, Calendar, MapPin, Globe, Lock, EyeOff, Zap, Copy, Check,
  GraduationCap, Clock3, Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi, useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { WorkspaceResource, WorkspaceMembership } from '../../types';
import { relativeTime } from '../../utils/time';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import ProgressBar from '../../components/ui/ProgressBar';
import AddResourceModal from '../../components/ui/AddResourceModal';
import WorkspaceChatPanel from '../../components/ui/WorkspaceChatPanel';
import CreateWorkspaceModal from '../../components/ui/CreateWorkspaceModal';

type Tab = 'resources' | 'members' | 'tasks' | 'chat';

const COLOR_GRADIENT: Record<string, string> = {
  blue:    'from-primary-500 to-primary-700',
  indigo:  'from-indigo-500 to-indigo-700',
  purple:  'from-purple-500 to-purple-700',
  teal:    'from-teal-500 to-teal-700',
  green:   'from-green-500 to-green-700',
  emerald: 'from-emerald-500 to-emerald-700',
  orange:  'from-orange-500 to-orange-700',
  red:     'from-red-500 to-red-700',
  pink:    'from-pink-500 to-pink-700',
  amber:   'from-amber-500 to-amber-700',
  cyan:    'from-cyan-500 to-cyan-700',
  slate:   'from-slate-500 to-slate-700',
  violet:  'from-violet-500 to-violet-700',
  rose:    'from-rose-500 to-rose-700',
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  file: <FileText size={16} />,
  link: <LinkIcon size={16} />,
  note: <StickyNote size={16} />,
};

// ── Resources Tab ────────────────────────────────

function ResourceCard({
  resource,
  canDelete,
  onDelete,
}: {
  resource: WorkspaceResource;
  canDelete: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <Card padding="md" className={`flex items-start gap-3 ${resource.is_template ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${resource.is_template ? 'bg-amber-100 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>
        {resource.is_template ? <Layers size={16} /> : RESOURCE_ICONS[resource.resource_type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13.5px] font-semibold text-gray-900">{resource.title}</p>
              {resource.is_template && (
                <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                  Template
                </span>
              )}
            </div>
            {resource.description && (
              <p className="text-[12px] text-gray-500 mt-0.5">{resource.description}</p>
            )}
          </div>
          {canDelete && (
            <button onClick={() => onDelete(resource.id)}
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {resource.resource_type === 'link' && resource.url && (
          <a href={resource.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-[12px] text-primary-600 hover:underline">
            <ExternalLink size={11} /> Open link
          </a>
        )}
        {resource.resource_type === 'file' && resource.file_url && (
          <a href={resource.file_url} target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1 mt-2 text-[12px] hover:underline ${resource.is_template ? 'text-amber-600' : 'text-primary-600'}`}>
            {resource.is_template ? <Download size={11} /> : <ExternalLink size={11} />}
            {resource.is_template ? 'Download template' : 'Download'}
          </a>
        )}
        {resource.resource_type === 'note' && resource.body && (
          <p className="mt-2 text-[12.5px] text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
            {resource.body}
          </p>
        )}

        <p className="text-[11px] text-gray-400 mt-2">
          Posted by {resource.posted_by.first_name || resource.posted_by.username} · {relativeTime(resource.created_at)}
        </p>
      </div>
    </Card>
  );
}

// ── Members Tab ─────────────────────────────────

function MemberRow({
  membership,
  isMentor,
  workspaceId,
}: {
  membership: WorkspaceMembership;
  isMentor: boolean;
  workspaceId: number;
}) {
  const name = `${membership.student.user.first_name} ${membership.student.user.last_name}`.trim()
    || membership.student.user.username;
  const taskCount    = membership.workspace_task_count;
  const taskApproved = membership.workspace_task_approved;
  const progress     = taskCount > 0 ? Math.round((taskApproved / taskCount) * 100) : 0;

  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={membership.student.profile_picture} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <p className="text-[13.5px] font-semibold text-gray-900 truncate">{name}</p>
            {taskCount > 0 && (
              <span className="shrink-0 text-[11px] text-gray-400">{taskApproved}/{taskCount} tasks done</span>
            )}
          </div>
          {membership.student.headline && (
            <p className="text-[12px] text-gray-400 truncate">{membership.student.headline}</p>
          )}
          {taskCount > 0 && (
            <div className="mt-2">
              <ProgressBar value={progress} />
            </div>
          )}
        </div>
        {isMentor && (
          <Link
            to={`/mentor/students/${membership.student.id}`}
            className="shrink-0 px-3 py-1.5 text-[12px] font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            View profile
          </Link>
        )}
      </div>
    </Card>
  );
}

// ── Batch Task Creation ──────────────────────────

function CreateBatchTaskForm({
  workspaceId,
  onCreated,
}: {
  workspaceId: number;
  onCreated: () => void;
}) {
  const [title, setTitle]     = useState('');
  const [desc, setDesc]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.initCsrf();
      const task = await workspacesApi.createTask(workspaceId, { title: title.trim(), description: desc.trim() });
      await workspacesApi.assignTask(workspaceId, task.id, 'all');
      setTitle('');
      setDesc('');
      onCreated();
    } catch {
      setError('Failed to create task. Make sure there are approved members.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="md" className="mb-4 bg-primary-50 border border-primary-100">
      <p className="text-[12px] font-semibold text-primary-700 mb-3 uppercase tracking-wide">
        Create task for all members
      </p>
      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}
      <div className="space-y-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
        <button
          onClick={submit}
          disabled={loading || !title.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[12.5px] font-semibold rounded-lg transition-colors"
        >
          <Plus size={13} />
          {loading ? 'Creating…' : 'Push task to all members'}
        </button>
      </div>
    </Card>
  );
}

// ── Individual Task Form ─────────────────────────

function CreateIndividualTaskForm({
  workspaceId,
  members,
  onCreated,
}: {
  workspaceId: number;
  members: WorkspaceMembership[];
  onCreated: () => void;
}) {
  const [open, setOpen]             = useState(false);
  const [studentId, setStudentId]   = useState<number | ''>('');
  const [title, setTitle]           = useState('');
  const [desc, setDesc]             = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const submit = async () => {
    if (!title.trim() || !studentId) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.initCsrf();
      const task = await workspacesApi.createTask(workspaceId, { title: title.trim(), description: desc.trim() });
      await workspacesApi.assignTask(workspaceId, task.id, [Number(studentId)]);
      setTitle('');
      setDesc('');
      setStudentId('');
      setOpen(false);
      onCreated();
    } catch {
      setError('Failed to assign task.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[12.5px] font-medium text-primary-600 hover:text-primary-800 mb-4"
      >
        <Plus size={13} /> Assign to individual member
      </button>
    );
  }

  return (
    <Card padding="md" className="mb-4 bg-gray-50 border border-gray-200">
      <p className="text-[12px] font-semibold text-gray-600 mb-3 uppercase tracking-wide">
        Assign task to one member
      </p>
      {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}
      <div className="space-y-2">
        <select
          value={studentId}
          onChange={e => setStudentId(Number(e.target.value) || '')}
          className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">Select a member…</option>
          {members.map(m => {
            const name = `${m.student.user.first_name} ${m.student.user.last_name}`.trim() || m.student.user.username;
            return <option key={m.student.id} value={m.student.id}>{name}</option>;
          })}
        </select>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={loading || !title.trim() || !studentId}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white text-[12.5px] font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Assigning…' : 'Assign task'}
          </button>
          <button onClick={() => setOpen(false)}
            className="px-3 py-2 text-[12.5px] text-gray-500 hover:text-gray-800 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────

// ── (InviteLinkCard removed — invite system not yet active) ──────────────

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const workspaceId = Number(id);

  const [tab, setTab]               = useState<Tab>('resources');
  const [showAddResource, setShow]  = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft]     = useState('');
  const [savingAnnouncement, setSavingAnnouncement]   = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const { data: workspace, loading: loadingWs, refetch: refetchWorkspace } = useApi(
    () => workspacesApi.get(workspaceId), [workspaceId]
  );
  const { data: resources, refetch: refetchResources } = useApiList(
    () => workspacesApi.getResources(workspaceId), [workspaceId]
  );
  const { data: membersData, refetch: refetchMembers } = useApi(
    () => workspacesApi.getMembers(workspaceId), [workspaceId]
  );
  const { data: tasks, refetch: refetchTasks } = useApiList(
    () => workspacesApi.getTasks(workspaceId), [workspaceId]
  );

  if (loadingWs) return <p className="text-gray-400 text-center py-20">Loading…</p>;
  if (!workspace) return <p className="text-gray-400 text-center py-20">Workspace not found.</p>;

  const isMentorOwner = workspace.my_status === 'owner';
  const isMember      = workspace.my_status === 'approved' || isMentorOwner;

  if (workspace.slug && isMember) {
    return <Navigate to={`/w/${workspace.slug}`} replace />;
  }
  const gradient      = COLOR_GRADIENT[workspace.accent_color] ?? COLOR_GRADIENT.blue;

  const approvedMembers: WorkspaceMembership[] = membersData?.approved ?? [];
  const pendingMembers:  WorkspaceMembership[] = membersData?.pending  ?? [];

  const handleSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.updateAnnouncement(workspaceId, announcementDraft);
      setEditingAnnouncement(false);
      refetchWorkspace();
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleDeleteResource = async (rid: number) => {    await apiClient.initCsrf();
    await workspacesApi.deleteResource(workspaceId, rid);
    refetchResources();
  };

  const handleMemberAction = async (mid: number, action: 'approve' | 'reject') => {
    await apiClient.initCsrf();
    await workspacesApi.memberAction(workspaceId, mid, action);
    refetchMembers();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this workspace? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.delete(workspaceId);
      navigate('/workspaces');
    } finally {
      setDeleting(false);
    }
  };

  const tabCls = (t: Tab) =>
    `flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors ${
      tab === t ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate('/workspaces')}
          className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> All Workspaces
        </button>
        {isMentorOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Pencil size={13} /> Edit workspace
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Hero banner */}
      <div className={`relative bg-gradient-to-r ${gradient} rounded-xl overflow-hidden mb-6`}>
        {workspace.cover_image_url && (
          <img src={workspace.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        )}
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {workspace.icon_emoji && <span className="text-2xl">{workspace.icon_emoji}</span>}
                <h1 className="text-white text-[22px] font-bold leading-tight">{workspace.name}</h1>
                {workspace.workspace_status !== 'active' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    workspace.workspace_status === 'winding_down' ? 'bg-amber-400/90 text-white' : 'bg-white/30 text-white'
                  }`}>
                    {workspace.workspace_status === 'winding_down' ? 'Winding Down' : 'Archived'}
                  </span>
                )}
              </div>
              {workspace.description && (
                <p className="text-white/80 text-[13.5px] mt-1 leading-relaxed max-w-xl">{workspace.description}</p>
              )}
              {workspace.goal && (
                <div className="flex items-center gap-1.5 mt-2 text-white/90 text-[13px]">
                  <Target size={13} />
                  <span>{workspace.goal}</span>
                </div>
              )}
              <div className="flex items-center flex-wrap gap-4 mt-3 text-white/70 text-[12px]">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {workspace.member_count}{workspace.max_members ? `/${workspace.max_members}` : ''} members
                </span>
                <span className="flex items-center gap-1"><BookOpen size={12} />{workspace.resource_count} resources</span>
                {workspace.target_country && (
                  <span className="flex items-center gap-1"><Target size={12} />{workspace.target_country}</span>
                )}
                {workspace.target_deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    Deadline: {new Date(workspace.target_deadline).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {workspace.language && (
                  <span className="flex items-center gap-1"><Globe size={12} />{workspace.language}</span>
                )}
                {workspace.auto_accept && (
                  <span className="flex items-center gap-1"><Zap size={12} />Auto-join on</span>
                )}
                {workspace.privacy !== 'public' && (
                  <span className="flex items-center gap-1">
                    {workspace.privacy === 'secret' ? <EyeOff size={12} /> : <Lock size={12} />}
                    {workspace.privacy === 'secret' ? 'Secret' : 'Private'}
                  </span>
                )}
              </div>
              {workspace.tags_list.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {workspace.tags_list.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-white/20 text-white text-[11px] font-medium rounded-full">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <Avatar name={workspace.mentor_name} src={workspace.mentor_picture} size="lg" />
          </div>
        </div>
      </div>

      {/* Info cards row */}
      {isMember && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {workspace.office_hours && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <Clock3 size={16} className="text-primary-500 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Office Hours</p>
                <p className="text-[12.5px] text-gray-700 font-medium">{workspace.office_hours}</p>
              </div>
            </div>
          )}
          {workspace.level && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <Layers size={16} className="text-primary-500 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Level</p>
                <p className="text-[12.5px] text-gray-700 font-medium capitalize">{workspace.level}</p>
              </div>
            </div>
          )}
          {workspace.pinned_url && (
            <a href={workspace.pinned_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 transition-colors"
            >
              <LinkIcon size={16} className="text-primary-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Pinned Link</p>
                <p className="text-[12.5px] text-primary-600 font-medium truncate">
                  {workspace.pinned_url_title || 'Open resource'}
                </p>
              </div>
              <ExternalLink size={11} className="text-gray-300 shrink-0 ml-auto" />
            </a>
          )}
          {workspace.related_workspace && workspace.related_workspace_name && (
            <Link to={`/workspaces/${workspace.related_workspace}`}
              className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 transition-colors"
            >
              <Info size={16} className="text-primary-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Related Workspace</p>
                <p className="text-[12.5px] text-primary-600 font-medium truncate">{workspace.related_workspace_name}</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Announcement banner */}
      {isMember && (workspace.announcement || isMentorOwner) && (
        <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <Megaphone size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11.5px] font-semibold text-amber-700 uppercase tracking-widest">Announcement</p>
                {isMentorOwner && !editingAnnouncement && (
                  <button
                    onClick={() => { setAnnouncementDraft(workspace.announcement); setEditingAnnouncement(true); }}
                    className="text-amber-500 hover:text-amber-700 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              {editingAnnouncement ? (
                <div className="space-y-2">
                  <textarea
                    value={announcementDraft}
                    onChange={e => setAnnouncementDraft(e.target.value)}
                    rows={3}
                    placeholder="Write an announcement for all members…"
                    className="w-full px-3 py-2 text-[13px] border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAnnouncement}
                      disabled={savingAnnouncement}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-[12px] font-semibold rounded-lg transition-colors"
                    >
                      {savingAnnouncement ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingAnnouncement(false)}
                      className="px-3 py-1.5 text-amber-700 text-[12px] font-medium hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : workspace.announcement ? (
                <p className="text-[13px] text-amber-900 leading-relaxed whitespace-pre-wrap">{workspace.announcement}</p>
              ) : (
                <p className="text-[13px] text-amber-600 italic">
                  No announcement yet. Click the pencil to add one.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Welcome message — shown to non-owner members */}
      {isMember && !isMentorOwner && workspace.welcome_message && (
        <div className="mb-5 p-4 rounded-xl bg-primary-50 border border-primary-100">
          <p className="text-[11.5px] font-semibold text-primary-700 uppercase tracking-widest mb-1">Welcome</p>
          <p className="text-[13px] text-primary-900 leading-relaxed whitespace-pre-wrap">{workspace.welcome_message}</p>
        </div>
      )}

      {/* Access guard */}
      {!isMember ? (
        <Card>
          <p className="text-[13px] text-gray-500 text-center py-8">
            {workspace.my_status === 'pending'
              ? 'Your join request is pending approval from the mentor.'
              : workspace.my_status === 'rejected'
              ? 'Your join request was not approved.'
              : 'You need to join this workspace to view its contents.'}
          </p>
        </Card>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button className={tabCls('resources')} onClick={() => setTab('resources')}>
              <BookOpen size={13} /> Resources
            </button>
            <button className={tabCls('members')} onClick={() => setTab('members')}>
              <Users size={13} /> Members
              {pendingMembers.length > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingMembers.length}
                </span>
              )}
            </button>
            <button className={tabCls('tasks')} onClick={() => setTab('tasks')}>
              <ClipboardList size={13} /> Tasks
            </button>
            <button className={tabCls('chat')} onClick={() => setTab('chat')}>
              <MessageCircle size={13} /> Chat
            </button>
          </div>

          {/* ── RESOURCES TAB ── */}
          {tab === 'resources' && (
            <>
              {isMentorOwner && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShow(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    <Plus size={14} /> Add resource
                  </button>
                </div>
              )}
              {resources.length === 0 ? (
                <Card>
                  <p className="text-[13px] text-gray-400 text-center py-8">
                    No resources yet.{isMentorOwner ? ' Add files, links, or notes for your members.' : ''}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {resources.map(r => (
                    <ResourceCard key={r.id} resource={r}
                      canDelete={isMentorOwner}
                      onDelete={handleDeleteResource} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── MEMBERS TAB ── */}
          {tab === 'members' && (
            <div className="space-y-4">
              {/* Pending requests — mentor only */}
              {isMentorOwner && pendingMembers.length > 0 && (
                <div>
                  <h3 className="text-[12px] font-semibold text-amber-600 uppercase tracking-widest mb-2">
                    Join requests ({pendingMembers.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingMembers.map(m => {
                      const name = `${m.student.user.first_name} ${m.student.user.last_name}`.trim() || m.student.user.username;
                      return (
                        <Card key={m.id} padding="md">
                          <div className="flex items-center gap-3">
                            <Avatar name={name} src={m.student.profile_picture} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13.5px] font-semibold text-gray-900">{name}</p>
                              <p className="text-[11.5px] text-gray-400">Requested {relativeTime(m.requested_at)}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleMemberAction(m.id, 'approve')}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[12px] font-semibold rounded-lg transition-colors"
                              >
                                <UserCheck size={12} /> Approve
                              </button>
                              <button
                                onClick={() => handleMemberAction(m.id, 'reject')}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[12px] font-semibold rounded-lg transition-colors"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Approved members */}
              <div>
                <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Members ({approvedMembers.length})
                </h3>
                {approvedMembers.length === 0 ? (
                  <Card>
                    <p className="text-[13px] text-gray-400 text-center py-8">
                      No approved members yet.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {approvedMembers.map(m => (
                      <MemberRow key={m.id} membership={m} isMentor={isMentorOwner} workspaceId={workspaceId} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TASKS TAB ── */}
          {tab === 'tasks' && (
            <div>
              {isMentorOwner ? (
                <>
                  <CreateBatchTaskForm workspaceId={workspaceId} onCreated={refetchTasks} />
                  {approvedMembers.length > 0 && (
                    <CreateIndividualTaskForm
                      workspaceId={workspaceId}
                      members={approvedMembers}
                      onCreated={refetchTasks}
                    />
                  )}

                  {tasks.length === 0 ? (
                    <Card>
                      <p className="text-[13px] text-gray-400 text-center py-8">
                        No tasks yet. Create a task above to push it to all members.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map(task => {
                        const dest = workspace.slug ? `/w/${workspace.slug}/tasks/${task.id}` : '#';
                        return (
                          <Link key={task.id} to={dest}>
                            <Card hoverable padding="md">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13.5px] font-semibold text-gray-900">{task.title}</p>
                                  <p className="text-[11.5px] text-gray-400 mt-0.5">
                                    {task.submitted_count} submitted · {task.completed_count} completed · Updated {relativeTime(task.updated_at)}
                                  </p>
                                </div>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  task.status === 'published' ? 'bg-green-100 text-green-700' :
                                  task.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                                  'bg-red-100 text-red-600'
                                }`}>
                                  {task.status === 'published' ? 'Active' : task.status === 'draft' ? 'Draft' : 'Archived'}
                                </span>
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                tasks.length === 0 ? (
                  <Card>
                    <p className="text-[13px] text-gray-400 text-center py-8">No tasks assigned yet.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tasks.map(task => {
                      const dest = workspace.slug ? `/w/${workspace.slug}/tasks/${task.id}` : '#';
                      const sub = task.my_submission_status;
                      return (
                        <Link key={task.id} to={dest}>
                          <Card hoverable padding="md">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-semibold text-gray-900">{task.title}</p>
                                <p className="text-[12px] text-gray-400 mt-0.5">Updated {relativeTime(task.updated_at)}</p>
                              </div>
                              {sub && (
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  sub === 'completed'      ? 'bg-emerald-100 text-emerald-700' :
                                  sub === 'needs_revision' ? 'bg-red-100 text-red-700' :
                                  sub === 'submitted' || sub === 'resubmitted' ? 'bg-amber-100 text-amber-700' :
                                  'bg-primary-100 text-primary-700'
                                }`}>
                                  {sub === 'completed'      ? 'Completed' :
                                   sub === 'needs_revision' ? 'Needs revision' :
                                   sub === 'submitted'      ? 'Submitted' :
                                   sub === 'resubmitted'    ? 'Resubmitted' : 'In progress'}
                                </span>
                              )}
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {/* ── CHAT TAB ── */}
          {tab === 'chat' && workspace && (
            <WorkspaceChatPanel workspaceId={workspace.id} />
          )}
        </>
      )}

      {showAddResource && (
        <AddResourceModal
          workspaceId={workspaceId}
          onClose={() => setShow(false)}
          onAdded={() => { setShow(false); refetchResources(); }}
        />
      )}
      {showEdit && workspace && (
        <CreateWorkspaceModal
          mode="edit"
          initial={workspace}
          onClose={() => setShowEdit(false)}
          onCreated={() => { setShowEdit(false); refetchWorkspace(); }}
        />
      )}
    </div>
  );
}
