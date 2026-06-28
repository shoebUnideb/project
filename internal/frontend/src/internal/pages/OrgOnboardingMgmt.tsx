import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Search, Calendar, Clock, Download, MoreHorizontal,
  ChevronDown, ChevronUp, Info, FileText, Upload, CheckCircle2,
  AlertCircle, Trash2, RotateCcw, Bell, Edit3, Paperclip,
  ExternalLink, Send, MessageSquare, Users, TrendingUp,
  Building2, RefreshCw, Ban, ListChecks, StickyNote, Check,
  ArrowRight, GraduationCap, BookOpen, Activity, User as UserIcon,
  Shield, ClipboardList, Link as LinkIcon, Video, HelpCircle, FileCode,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { useOrg } from '../context/OrgContext';
import {
  orgApi, commentsApi, auditApi, docApi, trainingApi, formBuilderApi,
  type OnboardingInstance, type OnboardingTemplate,
  type OrgMember, type TaskInstance, type TaskComment,
  type OnboardingStatus, type TaskStatus,
  type Department, type AuditLogEntry, type TaskFormField,
  type FormFieldType,
} from '../api/orgApi';
import { relativeTime } from '../../utils/time';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

// ── Constants ─────────────────────────────────────────────────────────────────

type RowAction = 'remind' | 'reset' | 'archive' | 'restore' | 'delete';

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const STATUS_LABEL: Record<OnboardingStatus, string> = {
  pending: 'Pending', active: 'In Progress', paused: 'Paused',
  completed: 'Completed', archived: 'Archived',
};
const TASK_TYPE_LABEL: Record<string, string> = {
  info: 'Info', form: 'Form', upload: 'Upload', approval: 'Approval', meeting: 'Meeting',
};
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not Started', in_progress: 'In Progress',
  completed: 'Completed', overdue: 'Overdue', blocked: 'Blocked',
};
const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  info:     <Info size={12} />,
  form:     <FileText size={12} />,
  upload:   <Upload size={12} />,
  approval: <CheckCircle2 size={12} />,
  meeting:  <Calendar size={12} />,
};
const TASK_STATUS_OPTS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
  { value: 'blocked',     label: 'Blocked'     },
  { value: 'overdue',     label: 'Overdue'     },
];
const GRAY = ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRelative(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 2)    return 'Just now';
  if (mins < 60)   return `${mins}m ago`;
  if (hrs  < 24)   return `${hrs}h ago`;
  if (days < 30)   return `${days}d ago`;
  return fmtDate(iso);
}
function pctOf(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
function initials(name: string) {
  const p = name.trim().split(' ');
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function isOverdue(inst: OnboardingInstance) {
  if (inst.status === 'completed' || inst.status === 'archived') return false;
  if (inst.due_date && new Date(inst.due_date) < new Date()) return true;
  return inst.tasks.some(
    t => t.status === 'overdue' || (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'),
  );
}
function exportCSV(instances: OnboardingInstance[]) {
  const rows = [
    ['Member', 'Email', 'Template', 'Status', 'Progress %', 'Start Date', 'Due Date', 'Manager', 'Buddy'],
    ...instances.map(i => [
      i.user.display_name, i.user.email, i.template_name ?? '',
      STATUS_LABEL[i.status], String(i.progress_pct),
      i.start_date, i.due_date ?? '', i.manager_name ?? '', i.buddy_name ?? '',
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'onboarding-report.csv';
  a.click();
}

function computeAnalytics(instances: OnboardingInstance[]) {
  const total      = instances.length;
  const completed  = instances.filter(i => i.status === 'completed').length;
  const active     = instances.filter(i => i.status === 'active').length;
  const paused     = instances.filter(i => i.status === 'paused').length;
  const pending    = instances.filter(i => i.status === 'pending').length;
  const completionRate = pctOf(completed, total);

  const withDates = instances.filter(i => i.status === 'completed' && i.completed_at);
  const avgDays   = withDates.length > 0
    ? Math.round(withDates.reduce((s, i) => s + daysBetween(i.start_date, i.completed_at!), 0) / withDates.length)
    : 0;

  const allTasks       = instances.flatMap(i => i.tasks.map(t => ({ t, inst: i })));
  const totalTasks     = allTasks.length;
  const completedTasks = allTasks.filter(({ t }) => t.status === 'completed').length;
  const overdueCount   = instances.filter(isOverdue).length;
  const overdueTaskCount = allTasks.filter(
    ({ t }) => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date(),
  ).length;

  return { total, completed, active, paused, pending, completionRate, avgDays, totalTasks, completedTasks, overdueCount, overdueTaskCount, allTasks };
}

// ── Dropdown (matches OrgTemplateHub pattern) ────────────────────────────────

type DropdownOption = { value: string; label: string };

function Dropdown({
  value, options, placeholder, onChange, align = 'left',
}: {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (v: string) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg text-gray-600 bg-white hover:border-gray-400 whitespace-nowrap transition-colors"
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1 max-h-[280px] overflow-y-auto`}>
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${!value ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
          >
            {placeholder}
          </button>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${o.value === value ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusDotClass(status: OnboardingStatus | 'overdue') {
  switch (status) {
    case 'active':    return 'bg-gray-700';
    case 'pending':   return 'bg-gray-400';
    case 'completed': return 'bg-gray-900';
    case 'paused':    return 'bg-gray-300';
    case 'archived':  return 'bg-gray-300';
    case 'overdue':   return 'bg-gray-600';
    default:          return 'bg-gray-400';
  }
}

// ── Create Onboarding Modal ───────────────────────────────────────────────────

function CreateOnboardingModal({
  templates, members, onClose, onCreated,
}: {
  templates: OnboardingTemplate[];
  members: OrgMember[];
  onClose: () => void;
  onCreated: (o: OnboardingInstance) => void;
}) {
  const [userSearch, setUserSearch] = useState('');
  const [userId, setUserId]         = useState<number | null>(null);
  const [userName, setUserName]     = useState('');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [startDate, setStartDate]   = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate]       = useState('');
  const [buddyId, setBuddyId]       = useState<number | ''>('');
  const [managerId, setManagerId]   = useState<number | ''>('');
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const filtered     = members.filter(m => {
    const q = userSearch.toLowerCase();
    return m.user.display_name.toLowerCase().includes(q) || m.user.username.toLowerCase().includes(q);
  });
  const showDropdown = userSearch.length > 0 && !userId;

  const handleSave = async () => {
    if (!userId) { setError('Select a member.'); return; }
    if (!startDate) { setError('Start date is required.'); return; }
    setSaving(true); setError('');
    try {
      const result = await orgApi.createOnboarding({
        user_id: userId, template_id: templateId || null,
        start_date: startDate, due_date: dueDate || null,
        buddy_id: buddyId || null, manager_id: managerId || null,
        welcome_message: welcomeMsg,
      });
      onCreated(result); onClose();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; user_id?: string[] } };
      setError(err?.data?.detail ?? err?.data?.user_id?.[0] ?? 'Failed to create onboarding.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[520px] max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">Create Onboarding</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          {/* Member picker */}
          <div className="relative">
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Member <span className="text-red-400">*</span></label>
            {userId ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-xl bg-gray-50">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-700 shrink-0">{initials(userName)}</div>
                <span className="flex-1 text-[13px] font-medium text-gray-800">{userName}</span>
                <button onClick={() => { setUserId(null); setUserName(''); setUserSearch(''); }} className="p-0.5 text-gray-400 hover:text-gray-700"><X size={13} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus
                  placeholder="Search members by name..." className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10 max-h-44 overflow-y-auto">
                    {filtered.length === 0 ? <div className="px-3 py-2.5 text-[12.5px] text-gray-400">No members found</div>
                      : filtered.slice(0, 8).map(m => (
                        <button key={m.id} onClick={() => { setUserId(m.user.id); setUserName(m.user.display_name); setUserSearch(''); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left">
                          {m.user.profile_picture
                            ? <img src={m.user.profile_picture} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                            : <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{initials(m.user.display_name)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-gray-800 truncate">{m.user.display_name}</p>
                            <p className="text-[11px] text-gray-400 truncate">{m.role.name}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Template */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Template <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">No template (blank onboarding)</option>
              {templates.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.task_count} tasks)</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Start Date <span className="text-red-400">*</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>

          {/* Buddy / Manager */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Buddy <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={buddyId} onChange={e => setBuddyId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Not assigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.user.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Manager <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={managerId} onChange={e => setManagerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Not assigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.user.display_name}</option>)}
              </select>
            </div>
          </div>

          {/* Welcome message */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
              Welcome Message <span className="text-gray-400 font-normal">(shown to member)</span>
            </label>
            <textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} rows={3}
              placeholder={`Welcome, {name}! We're excited to have you on board.`}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
            <p className="text-[11px] text-gray-400 mt-1">Use <code className="bg-gray-100 px-1 rounded">{'{name}'}</code> to personalise.</p>
          </div>
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Onboarding'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Onboarding Modal ─────────────────────────────────────────────────────

function EditOnboardingModal({
  inst, members, onClose, onSaved,
}: {
  inst: OnboardingInstance;
  members: OrgMember[];
  onClose: () => void;
  onSaved: (o: OnboardingInstance) => void;
}) {
  const findId = (name: string | null) => {
    if (!name) return '' as const;
    const m = members.find(m => m.user.display_name === name);
    return m ? m.id : ('' as const);
  };

  const [status, setStatus]     = useState<OnboardingStatus>(inst.status);
  const [dueDate, setDueDate]   = useState(inst.due_date ?? '');
  const [buddyId, setBuddyId]   = useState<number | ''>(findId(inst.buddy_name));
  const [managerId, setManagerId] = useState<number | ''>(findId(inst.manager_name));
  const [welcomeMsg, setWelcomeMsg] = useState(inst.welcome_message ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const result = await orgApi.updateOnboarding(inst.id, {
        status, due_date: dueDate || null,
        buddy_id: buddyId || null, manager_id: managerId || null,
        welcome_message: welcomeMsg,
      });
      onSaved(result); onClose();
    } catch { setError('Failed to save changes.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[480px] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">Edit Onboarding</h3>
            <p className="text-[12px] text-gray-400">{inst.user.display_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as OnboardingStatus)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
              {(['pending','active','paused','completed','archived'] as OnboardingStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Buddy</label>
              <select value={buddyId} onChange={e => setBuddyId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Not assigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.user.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Manager</label>
              <select value={managerId} onChange={e => setManagerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                <option value="">Not assigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.user.display_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Welcome Message</label>
            <textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
          </div>
        </div>

        {error && <p className="mt-3 text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Type Help ────────────────────────────────────────────────────────────

const TASK_TYPE_HELP: Record<string, { title: string; body: string }> = {
  info: {
    title: 'Info task',
    body: 'Reference material for the new hire — links, a video, body text, or an attached file. To change the content, open the 3-dot menu → Edit task on this instance, or update the parent template and assign again to future hires.',
  },
  form: {
    title: 'Form task',
    body: 'Questions the new hire fills out. Their responses appear here once submitted. To edit the questions, use the 3-dot menu → Manage form questions, or update the template and assign again to future hires.',
  },
  upload: {
    title: 'Upload task',
    body: 'The new hire uploads a file (e.g. signed offer letter, ID). You can also upload on their behalf using the upload control below. To change instructions, use the 3-dot menu → Edit task, or update the template and re-assign.',
  },
  meeting: {
    title: 'Meeting task',
    body: 'A meeting the new hire is expected to attend. Add a Zoom / Meet / Teams link and an agenda via the 3-dot menu → Edit task. The member will see a "Join Meeting" button. To change defaults, update the template and assign again.',
  },
  approval: {
    title: 'Approval task',
    body: 'The member sees an "awaiting approval" state until you Approve or Reject from the controls below. Use this for sign-offs, background checks, or any step a recruiter must verify before the new hire can proceed.',
  },
};

function TaskTypeHelp({ task_type }: { task_type: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const help = TASK_TYPE_HELP[task_type] || TASK_TYPE_HELP.info;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const togglePopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 296) });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={togglePopover}
        className="shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-gray-300 hover:text-gray-700 transition-colors"
        title="How to manage this task type"
        aria-label="Help"
      >
        <HelpCircle size={11} />
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 288 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-3.5"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[11.5px] font-bold text-gray-900 mb-1">{help.title}</p>
          <p className="text-[11.5px] text-gray-600 leading-relaxed">{help.body}</p>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Admin Task Row ────────────────────────────────────────────────────────────

function AdminTaskRow({
  task, onboardingId, onUpdated, onEdit, onEditFormFields, onDelete, forceOpen = false,
}: {
  task: TaskInstance;
  onboardingId: number;
  onUpdated: (t: TaskInstance) => void;
  onEdit: () => void;
  onEditFormFields: () => void;
  onDelete: () => void;
  forceOpen?: boolean;
}) {
  const [open, setOpen]               = useState(forceOpen);
  const [comments, setComments]       = useState<TaskComment[]>([]);
  const [commLoaded, setCommLoaded]   = useState(false);
  const [commLoading, setCommLoading] = useState(false);
  const [newComment, setNewComment]   = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [noteDraft, setNoteDraft]     = useState(task.notes ?? '');
  const [noteSaving, setNoteSaving]   = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });

  const isApproval    = task.task_type === 'approval';
  const needsDecision = isApproval && task.status !== 'completed' && task.status !== 'blocked';
  const hasForm       = (task.form_fields ?? []).length > 0;
  const hasResponses  = hasForm && (task.form_fields ?? []).some(f => f.response !== null && f.response !== '');

  async function loadComments() {
    if (commLoaded) return;
    setCommLoading(true);
    try { const d = await commentsApi.getComments(onboardingId, task.id); setComments(d); setCommLoaded(true); }
    catch { /* ignore */ } finally { setCommLoading(false); }
  }

  const handleToggle = () => { if (forceOpen) return; if (!open) loadComments(); setOpen(o => !o); };

  useEffect(() => { if (forceOpen && !commLoaded) loadComments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [forceOpen]);

  const changeStatus = async (s: TaskStatus) => {
    setShowStatusMenu(false);
    if (s === task.status) return;
    setStatusSaving(true);
    try { const u = await orgApi.updateTaskInstance(onboardingId, task.id, { status: s }); onUpdated(u); }
    catch { /* ignore */ } finally { setStatusSaving(false); }
  };

  const saveNote = async () => {
    if (noteDraft === task.notes) return;
    setNoteSaving(true);
    try { const u = await orgApi.updateTaskInstance(onboardingId, task.id, { notes: noteDraft }); onUpdated(u); }
    catch { /* ignore */ } finally { setNoteSaving(false); }
  };

  const postComment = async () => {
    if (!newComment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const c = await commentsApi.postComment(onboardingId, task.id, newComment.trim());
      setComments(p => [...p, c]); setNewComment('');
    } catch { /* ignore */ } finally { setPostingComment(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setUploadError('File too large (max 25MB).'); return; }
    setUploading(true); setUploadError('');
    try {
      const u = await orgApi.uploadTaskFile(onboardingId, task.id, file);
      onUpdated(u);
    } catch { setUploadError('Upload failed. Please try again.'); } finally { setUploading(false); }
  };

  const openStatusMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusBtnRef.current) {
      const r = statusBtnRef.current.getBoundingClientRect();
      setStatusMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setShowStatusMenu(p => !p);
  };

  const statusColor = {
    not_started: 'text-gray-400', in_progress: 'text-gray-700',
    completed: 'text-gray-900', overdue: 'text-red-600', blocked: 'text-amber-600',
  }[task.status] ?? 'text-gray-500';

  return (
    <div className={`rounded-xl overflow-hidden ${forceOpen ? '' : 'border border-gray-200'}`}>
      {/* Header row */}
      <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${forceOpen ? 'rounded-xl border border-gray-200 bg-gray-50/60' : 'cursor-pointer hover:bg-gray-50'}`} onClick={handleToggle}>
        <span className="shrink-0 text-gray-400">{TASK_TYPE_ICON[task.task_type]}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-snug truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-400">{TASK_TYPE_LABEL[task.task_type]}</span>
            <TaskTypeHelp task_type={task.task_type} />
            {task.phase && <><span className="text-gray-300">·</span><span className="text-[11px] text-gray-400">{task.phase}</span></>}
            {task.due_date && (
              <><span className="text-gray-300">·</span>
              <span className={`text-[11px] ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-500' : 'text-gray-400'}`}>
                Due {fmtDate(task.due_date)}
              </span></>
            )}
            {hasResponses && <><span className="text-gray-300">·</span><span className="text-[11px] text-gray-500 font-medium">Form submitted</span></>}
          </div>
        </div>

        {/* Status button */}
        <div className="relative shrink-0">
          <button ref={statusBtnRef} onClick={openStatusMenu} disabled={statusSaving}
            className={`flex items-center gap-1 text-[11.5px] font-semibold ${statusColor} hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors`}>
            {TASK_STATUS_LABEL[task.status]}
            {!statusSaving ? <ChevronDown size={11} /> : <RefreshCw size={10} className="animate-spin" />}
          </button>
          {showStatusMenu && createPortal(
            <div style={{ position: 'fixed', top: statusMenuPos.top, left: statusMenuPos.left, zIndex: 9999 }}
              className="w-36 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
              onMouseDown={e => e.stopPropagation()}>
              {TASK_STATUS_OPTS.map(opt => (
                <button key={opt.value} onClick={() => changeStatus(opt.value)}
                  className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 transition-colors ${task.status === opt.value ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>

        {!forceOpen && (open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />)}

        <TaskRowMenu task={task} onEdit={onEdit} onEditFormFields={onEditFormFields} onDelete={onDelete} />
      </div>

      {/* Expanded content */}
      {open && (
        <div className={`space-y-3 ${forceOpen ? 'pt-3' : 'px-4 pb-4 pt-3 border-t border-gray-100 space-y-4'}`}>
          {task.description && (
            forceOpen ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            ) : (
              <p className="text-[12.5px] text-gray-600 leading-relaxed">{task.description}</p>
            )
          )}

          {/* Info-type rich content from template */}
          {task.task_type === 'info' && (task.content_url || task.content_body || task.content_file_url) && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-3">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={11} /> Reference Material
              </p>
              {task.content_url && (() => {
                const ytId = getYouTubeId(task.content_url);
                return ytId ? (
                  <div className="rounded-xl overflow-hidden aspect-video bg-black">
                    <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <a href={task.content_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[12.5px] font-semibold rounded-xl hover:bg-gray-50">
                    <LinkIcon size={12} /> Open Link <ExternalLink size={11} className="text-gray-400" />
                  </a>
                );
              })()}
              {task.content_body && (
                <p className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{task.content_body}</p>
              )}
              {task.content_file_url && (
                <a href={task.content_file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[12.5px] font-semibold rounded-xl hover:bg-gray-50">
                  <Paperclip size={12} /> Download Attachment <ExternalLink size={11} className="text-gray-400" />
                </a>
              )}
            </div>
          )}

          {/* Meeting-type details — always shown for meeting tasks so the admin can add a link */}
          {task.task_type === 'meeting' && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Video size={11} /> Meeting Details
              </p>
              {task.content_url ? (
                <a href={task.content_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[12.5px] font-semibold rounded-xl hover:bg-gray-50 break-all">
                  <Video size={12} /> Join Meeting <ExternalLink size={11} className="text-gray-400" />
                </a>
              ) : (
                <button onClick={onEdit}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 text-[12.5px] font-semibold rounded-xl">
                  <Plus size={12} /> Add meeting link
                </button>
              )}
              {task.content_body && (
                <p className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{task.content_body}</p>
              )}
            </div>
          )}

          {/* Form-type question structure (read-only, admin view) */}
          {task.task_type === 'form' && (task.form_fields ?? []).length > 0 && !hasResponses && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-3">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={11} /> Form Questions <span className="text-gray-400">· {(task.form_fields ?? []).length} field{(task.form_fields ?? []).length !== 1 ? 's' : ''}</span>
              </p>
              {(task.form_fields ?? []).map(field => (
                <div key={field.id} className="space-y-1">
                  <p className="text-[12px] font-semibold text-gray-700">
                    {field.question}{field.required && <span className="text-gray-400 ml-1">*</span>}
                    <span className="text-[10.5px] font-normal text-gray-400 ml-2 uppercase tracking-wider">{field.field_type}</span>
                  </p>
                  {field.field_type === 'choice' && (field.options ?? []).length > 0 && (
                    <p className="text-[11.5px] text-gray-500">Options: {(field.options ?? []).join(' · ')}</p>
                  )}
                </div>
              ))}
              <p className="text-[11.5px] text-gray-400 italic">Awaiting member responses.</p>
            </div>
          )}

          {/* Approval decision */}
          {isApproval && needsDecision && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <AlertCircle size={14} className="text-gray-500 shrink-0" />
              <p className="flex-1 text-[12.5px] text-gray-600">Member is awaiting your approval for this task.</p>
              <button onClick={() => changeStatus('completed')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg">
                <Check size={12} /> Approve
              </button>
              <button onClick={() => changeStatus('blocked')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg">
                <Ban size={12} /> Reject
              </button>
            </div>
          )}
          {isApproval && task.status === 'completed' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-[12.5px] text-gray-700">
              <CheckCircle2 size={13} className="text-gray-900" /> Approved
            </div>
          )}
          {isApproval && task.status === 'blocked' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-[12.5px] text-gray-700">
              <Ban size={13} /> Rejected
            </div>
          )}

          {/* Form responses (admin read-only view) */}
          {hasForm && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={11} /> Member Form Responses
              </p>
              <div className="divide-y divide-gray-200">
                {(task.form_fields ?? []).map(field => (
                  <div key={field.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-[11.5px] font-semibold text-gray-600">{field.question}</p>
                    <p className="text-[12.5px] text-gray-800 mt-0.5">
                      {field.response ? field.response : <span className="italic text-gray-400">Not answered yet</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload attachment */}
          {task.task_type === 'upload' && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2.5">
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip size={11} /> Attachment
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                className="hidden"
                onChange={handleUpload}
              />
              {task.attachment_url ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a href={task.attachment_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100">
                    <Paperclip size={13} /> View Uploaded File <ExternalLink size={11} className="text-gray-400" />
                  </a>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl disabled:opacity-50">
                    <Upload size={12} /> {uploading ? 'Uploading…' : 'Replace File'}
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full flex flex-col items-center justify-center gap-1.5 px-3 py-5 text-[12.5px] font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl disabled:opacity-50 transition-colors">
                  <Upload size={16} className="text-gray-500" />
                  <span>{uploading ? 'Uploading…' : 'Upload Document or Image'}</span>
                  <span className="text-[10.5px] font-normal text-gray-400">PDF, Word, Excel, PNG, JPG · up to 25 MB</span>
                </button>
              )}
              {uploadError && <p className="text-[11.5px] text-gray-700">{uploadError}</p>}
            </div>
          )}

          {/* Admin notes */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2">
            <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">
              <StickyNote size={11} /> Admin Notes
            </label>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} onBlur={saveNote} rows={2}
              placeholder="Internal notes (not visible to member)…"
              className="w-full px-3 py-2 text-[12.5px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none text-gray-700 placeholder:text-gray-300" />
            {noteSaving && <p className="text-[11px] text-gray-400">Saving…</p>}
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2.5">
            <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={11} /> Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {commLoading && <p className="text-[12px] text-gray-400">Loading…</p>}
            {commLoaded && comments.length === 0 && <p className="text-[12px] text-gray-400">No comments yet.</p>}
            {comments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {comments.map(c => (
                  <div key={c.id} className={`flex gap-2 ${c.is_mine ? 'flex-row-reverse' : ''}`}>
                    {c.author_picture
                      ? <img src={c.author_picture} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" />
                      : <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{c.author_name.slice(0, 2).toUpperCase()}</div>
                    }
                    <div className={`flex flex-col max-w-[78%] ${c.is_mine ? 'items-end' : 'items-start'}`}>
                      <div className={`px-3 py-1.5 rounded-2xl text-[12.5px] leading-relaxed ${c.is_mine ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>{c.body}</div>
                      <span className="text-[10.5px] text-gray-400 mt-0.5 px-1">
                        {c.is_mine ? 'You' : c.author_name} · {relativeTime(c.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Add a comment…"
                className="flex-1 px-3 py-2 text-[12.5px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300" />
              <button onClick={postComment} disabled={!newComment.trim() || postingComment}
                className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40 transition-colors">
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onboarding Detail Drawer ──────────────────────────────────────────────────

function OnboardingDetailDrawer({
  inst, members, onClose, onUpdated, onDeleted,
}: {
  inst: OnboardingInstance;
  members: OrgMember[];
  onClose: () => void;
  onUpdated: (o: OnboardingInstance) => void;
  onDeleted: (id: number) => void;
}) {
  const [tasks, setTasks]       = useState<TaskInstance[]>(inst.tasks);
  const [taskIndex, setTaskIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'postcard' | 'list'>('postcard');
  const [actionSaving, setActionSaving] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<RowAction | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ open: boolean; task: TaskInstance | null }>({ open: false, task: null });
  const [formBuilder, setFormBuilder] = useState<TaskInstance | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskInstance | null>(null);
  const [toast, setToast]       = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Group tasks by phase
  const phaseGroups = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, TaskInstance[]> = {};
    [...tasks].sort((a, b) => {
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1; if (b.due_date) return 1; return a.id - b.id;
    }).forEach(t => {
      const ph = t.phase?.trim() || 'General';
      if (!order.includes(ph)) order.push(ph);
      if (!map[ph]) map[ph] = [];
      map[ph].push(t);
    });
    return order.map(ph => ({ phase: ph, tasks: map[ph] }));
  }, [tasks]);

  // Flat sorted list (same order as phaseGroups) for postcard pagination
  const flatTasks = useMemo(() => phaseGroups.flatMap(g => g.tasks.map(t => ({ task: t, phase: g.phase }))), [phaseGroups]);

  useEffect(() => {
    if (taskIndex >= flatTasks.length) setTaskIndex(Math.max(0, flatTasks.length - 1));
  }, [flatTasks.length, taskIndex]);

  const current = flatTasks[taskIndex];
  const currentPhaseTasks = current ? phaseGroups.find(g => g.phase === current.phase)?.tasks ?? [] : [];
  const positionInPhase = current ? currentPhaseTasks.findIndex(t => t.id === current.task.id) + 1 : 0;

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progressPct    = tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : inst.progress_pct;

  const handleTaskUpdated = (updated: TaskInstance) => {
    const next = tasks.map(t => t.id === updated.id ? updated : t);
    setTasks(next);
    onUpdated({ ...inst, tasks: next, progress_pct: next.length > 0 ? Math.round(next.filter(t => t.status === 'completed').length / next.length * 100) : 0 });
  };

  const handleTaskSaved = (saved: TaskInstance, created: boolean) => {
    const next = created ? [...tasks, saved] : tasks.map(t => t.id === saved.id ? saved : t);
    setTasks(next);
    onUpdated({ ...inst, tasks: next, progress_pct: next.length > 0 ? Math.round(next.filter(t => t.status === 'completed').length / next.length * 100) : 0 });
    setToast(created ? 'Task added' : 'Task updated');
  };

  const handleTaskDelete = async (target: TaskInstance) => {
    try {
      await orgApi.deleteTaskInstance(inst.id, target.id);
      const next = tasks.filter(t => t.id !== target.id);
      setTasks(next);
      onUpdated({ ...inst, tasks: next, progress_pct: next.length > 0 ? Math.round(next.filter(t => t.status === 'completed').length / next.length * 100) : 0 });
      setToast('Task removed');
    } catch { setToast('Failed to remove task'); }
    finally { setDeleteTask(null); }
  };

  const handleFormFieldsChanged = (taskId: number, fields: TaskFormField[]) => {
    const next = tasks.map(t => t.id === taskId ? { ...t, form_fields: fields } : t);
    setTasks(next);
    onUpdated({ ...inst, tasks: next });
  };

  const doAction = async (action: 'remind' | 'reset' | 'archive' | 'restore' | 'delete') => {
    setActionSaving(action);
    try {
      if (action === 'remind') { await orgApi.remindOnboarding(inst.id); setToast('Reminder sent'); }
      else if (action === 'reset') { const u = await orgApi.resetOnboarding(inst.id); onUpdated(u); setTasks(u.tasks); setToast('Onboarding reset'); }
      else if (action === 'archive') { const u = await orgApi.updateOnboarding(inst.id, { status: 'archived' }); onUpdated(u); setToast('Archived'); }
      else if (action === 'restore') { const u = await orgApi.updateOnboarding(inst.id, { status: 'active' }); onUpdated(u); setToast('Restored'); }
      else if (action === 'delete') { await orgApi.deleteOnboarding(inst.id); onDeleted(inst.id); onClose(); }
    } catch { setToast('Something went wrong'); } finally { setActionSaving(''); setPendingConfirm(null); }
  };

  const overdueCount = tasks.filter(t => t.status === 'overdue' || (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed')).length;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Centered modal — 90% of viewport */}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl flex border border-gray-200 overflow-hidden w-[90vw] h-[90vh] pointer-events-auto">

          {/* ── Left sidebar ─────────────────────────────────────────────── */}
          <aside className="w-[320px] shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col">
            {/* Member header */}
            <div className="h-[44px] shrink-0 flex items-center px-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2.5 w-full">
                {inst.user.profile_picture
                  ? <img src={inst.user.profile_picture} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                  : <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[10.5px] font-bold text-gray-700 shrink-0">{initials(inst.user.display_name)}</div>
                }
                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                  <p className="text-[12.5px] font-bold text-gray-900 truncate">{inst.user.display_name}</p>
                  <p className="text-[10.5px] text-gray-400 truncate">{inst.user.email}</p>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Progress card */}
              <div className="bg-white rounded-xl border border-gray-200 p-3.5">
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">{STATUS_LABEL[inst.status]}</p>
                    <p className="text-[10.5px] text-gray-400">{completedCount}/{tasks.length} tasks complete</p>
                  </div>
                  <p className="text-[22px] font-bold text-gray-900 leading-none tabular-nums">{progressPct}%</p>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-700 mt-2.5 pt-2.5 border-t border-gray-100">
                    <AlertCircle size={11} /> {overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue
                  </div>
                )}
              </div>

              {/* Meta info */}
              <div className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Details</p>
                {[
                  { label: 'Template',    value: inst.template_name ?? 'Custom onboarding' },
                  { label: 'Start date',  value: fmtDate(inst.start_date) },
                  { label: 'Due date',    value: inst.due_date ? fmtDate(inst.due_date) : '—' },
                  { label: 'Manager',     value: inst.manager_name ?? '—' },
                  { label: 'Buddy',       value: inst.buddy_name ?? '—' },
                  { label: 'Assigned by', value: inst.assigned_by_name ?? '—' },
                  { label: 'Created',     value: fmtDate(inst.created_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <span className="text-[11.5px] text-gray-400 shrink-0">{label}</span>
                    <span className="text-[12px] font-medium text-gray-800 text-right truncate">{value}</span>
                  </div>
                ))}
              </div>

              {/* Welcome message */}
              {inst.welcome_message && (
                <div className="bg-white rounded-xl border border-gray-200 p-3.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Welcome Message</p>
                  <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{inst.welcome_message}</p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <button onClick={() => setPendingConfirm('remind')} disabled={!!actionSaving}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                  <Bell size={11} /> Remind
                </button>
                <button onClick={() => setPendingConfirm('reset')} disabled={!!actionSaving}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                  <RotateCcw size={11} /> Reset
                </button>
                {inst.status !== 'archived' ? (
                  <button onClick={() => setPendingConfirm('archive')} disabled={!!actionSaving}
                    className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                    Archive
                  </button>
                ) : (
                  <button onClick={() => setPendingConfirm('restore')} disabled={!!actionSaving}
                    className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                    <RefreshCw size={11} /> Restore
                  </button>
                )}
                <button onClick={() => setShowEdit(true)}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                  <Edit3 size={11} /> Edit
                </button>
              </div>
              <button onClick={() => setPendingConfirm('delete')} disabled={!!actionSaving}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11.5px] font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50">
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </aside>

          {/* ── Right main panel ─────────────────────────────────────────── */}
          <section className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="h-[44px] shrink-0 flex items-center justify-between gap-4 px-5 border-b border-gray-200">
              <div className="min-w-0 flex items-baseline gap-2">
                <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider">Tasks</p>
                <p className="text-[12.5px] font-bold text-gray-900">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                  <span className="text-[11px] font-medium text-gray-400 ml-1.5">· {completedCount} completed</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setViewMode('postcard')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${viewMode === 'postcard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Focused
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    List
                  </button>
                </div>
                <button onClick={() => setTaskEditor({ open: true, task: null })}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg">
                  <Plus size={12} /> Add Task
                </button>
                <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
              </div>
            </div>

            {/* Tasks — postcard (one at a time) or list (all stacked) */}
            {viewMode === 'postcard' ? (
            <div className="flex-1 min-h-0 flex flex-col px-6 py-4">
              {flatTasks.length === 0 || !current ? (
                <p className="text-[13px] text-gray-400 text-center py-12">No tasks assigned.</p>
              ) : (
                <>
                  {/* Phase + position eyebrow */}
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">{current.phase}</p>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10.5px] text-gray-400">{positionInPhase} of {currentPhaseTasks.length} in phase</span>
                  </div>

                  {/* Postcard — scrollable inner area */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <AdminTaskRow
                      key={current.task.id}
                      task={current.task}
                      onboardingId={inst.id}
                      onUpdated={handleTaskUpdated}
                      onEdit={() => setTaskEditor({ open: true, task: current.task })}
                      onEditFormFields={() => setFormBuilder(current.task)}
                      onDelete={() => setDeleteTask(current.task)}
                      forceOpen
                    />
                  </div>

                  {/* Pagination — fixed footer below the postcard */}
                  <div className="flex items-center justify-between mt-4 shrink-0">
                    <button
                      onClick={() => setTaskIndex(i => Math.max(0, i - 1))}
                      disabled={taskIndex === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowRight size={13} className="rotate-180" /> Previous
                    </button>
                    <p className="text-[12px] text-gray-500">
                      Task <span className="font-semibold text-gray-900">{taskIndex + 1}</span> of {flatTasks.length}
                    </p>
                    <button
                      onClick={() => setTaskIndex(i => Math.min(flatTasks.length - 1, i + 1))}
                      disabled={taskIndex >= flatTasks.length - 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next <ArrowRight size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
            ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {tasks.length === 0 ? (
                <p className="text-[13px] text-gray-400 text-center py-12">No tasks assigned.</p>
              ) : (
                <div className="space-y-5">
                  {phaseGroups.map(({ phase, tasks: pTasks }) => (
                    <div key={phase}>
                      {phaseGroups.length > 1 && (
                        <div className="flex items-center gap-2 mb-2.5">
                          <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">{phase}</p>
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[10.5px] text-gray-400">{pTasks.filter(t => t.status === 'completed').length}/{pTasks.length}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {pTasks.map(t => (
                          <AdminTaskRow
                            key={t.id}
                            task={t}
                            onboardingId={inst.id}
                            onUpdated={handleTaskUpdated}
                            onEdit={() => setTaskEditor({ open: true, task: t })}
                            onEditFormFields={() => setFormBuilder(t)}
                            onDelete={() => setDeleteTask(t)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </section>

        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white text-[12.5px] font-medium px-4 py-2 rounded-lg shadow-2xl">
          {toast}
        </div>
      )}

      {showEdit && (
        <EditOnboardingModal inst={inst} members={members}
          onClose={() => setShowEdit(false)}
          onSaved={u => { onUpdated(u); setShowEdit(false); }} />
      )}

      {pendingConfirm && (
        <ConfirmActionModal
          action={pendingConfirm}
          inst={inst}
          busy={actionSaving === pendingConfirm}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => doAction(pendingConfirm)}
        />
      )}

      {taskEditor.open && (
        <InstanceTaskEditor
          onboardingId={inst.id}
          task={taskEditor.task}
          onClose={() => setTaskEditor({ open: false, task: null })}
          onSaved={handleTaskSaved}
        />
      )}

      {formBuilder && (
        <InstanceFormBuilder
          onboardingId={inst.id}
          task={formBuilder}
          onClose={() => setFormBuilder(null)}
          onChanged={fields => handleFormFieldsChanged(formBuilder.id, fields)}
        />
      )}

      {deleteTask && (
        <DeleteTaskConfirm
          task={deleteTask}
          onCancel={() => setDeleteTask(null)}
          onConfirm={() => handleTaskDelete(deleteTask)}
        />
      )}
    </>
  );
}

// ── Row Menu (portal) ─────────────────────────────────────────────────────────

function RowMenu({
  inst, onView, onEdit, onRemind, onReset, onArchive, onDelete,
}: {
  inst: OnboardingInstance;
  onView: () => void; onEdit: () => void; onRemind: () => void;
  onReset: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, right: 0 });
  const btnRef          = useRef<HTMLButtonElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(p => !p);
  };

  useEffect(() => {
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', close, true); };
  }, []);

  const action = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); fn(); };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
        <MoreHorizontal size={15} />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
          onMouseDown={e => e.stopPropagation()}>
          <button onClick={action(onView)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
            <ListChecks size={13} className="text-gray-400" /> View Tasks
          </button>
          <button onClick={action(onEdit)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
            <Edit3 size={13} className="text-gray-400" /> Edit
          </button>
          <button onClick={action(onRemind)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
            <Bell size={13} className="text-gray-400" /> Send Reminder
          </button>
          <button onClick={action(onReset)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
            <RotateCcw size={13} className="text-gray-400" /> Reset Tasks
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button onClick={action(onArchive)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">
            {inst.status === 'archived' ? <><RefreshCw size={13} className="text-gray-400" /> Restore</> : 'Archive'}
          </button>
          <button onClick={action(onDelete)} className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50">
            <Trash2 size={13} /> Delete
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Confirm Action Modal ──────────────────────────────────────────────────────

const ACTION_COPY: Record<RowAction, { title: string; body: (name: string) => string; cta: string; busyCta: string; destructive: boolean }> = {
  remind: {
    title: 'Send Reminder',
    body: n => `Send a reminder email to ${n} about outstanding onboarding tasks?`,
    cta: 'Send Reminder', busyCta: 'Sending…', destructive: false,
  },
  reset: {
    title: 'Reset Tasks',
    body: n => `Reset all task progress for ${n}? This will set every task back to pending.`,
    cta: 'Reset', busyCta: 'Resetting…', destructive: true,
  },
  archive: {
    title: 'Archive Onboarding',
    body: n => `Archive ${n}'s onboarding? It will be hidden from active lists but data is preserved.`,
    cta: 'Archive', busyCta: 'Archiving…', destructive: true,
  },
  restore: {
    title: 'Restore Onboarding',
    body: n => `Restore ${n}'s onboarding back to active?`,
    cta: 'Restore', busyCta: 'Restoring…', destructive: false,
  },
  delete: {
    title: 'Unassign Onboarding',
    body: n => `Permanently remove ${n}'s onboarding instance? This cannot be undone.`,
    cta: 'Unassign', busyCta: 'Removing…', destructive: true,
  },
};

function ConfirmActionModal({
  action, inst, busy, onCancel, onConfirm,
}: {
  action: RowAction;
  inst: OnboardingInstance;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = ACTION_COPY[action];
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-5 pointer-events-auto">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${copy.destructive ? 'bg-gray-100' : 'bg-gray-100'}`}>
              <AlertCircle size={16} className="text-gray-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">{copy.title}</p>
              <p className="text-[12.5px] text-gray-600 mt-1 leading-snug">{copy.body(inst.user.display_name)}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className={`px-3.5 py-1.5 text-[12.5px] font-semibold text-white rounded-lg transition-colors disabled:opacity-60 ${copy.destructive ? 'bg-gray-900 hover:bg-black' : 'bg-gray-900 hover:bg-gray-800'}`}
            >
              {busy ? copy.busyCta : copy.cta}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Instance Task Editor (admin authoring on a live instance) ─────────────────

const INSTANCE_TYPE_OPTIONS: { value: TaskInstance['task_type']; label: string }[] = [
  { value: 'info',     label: 'Info / Reading' },
  { value: 'form',     label: 'Form' },
  { value: 'upload',   label: 'Upload' },
  { value: 'meeting',  label: 'Meeting' },
  { value: 'approval', label: 'Approval' },
];

function InstanceTaskEditor({
  onboardingId, task, onClose, onSaved,
}: {
  onboardingId: number;
  task: TaskInstance | null;
  onClose: () => void;
  onSaved: (t: TaskInstance, created: boolean) => void;
}) {
  const editing = !!task;
  const [title, setTitle]               = useState(task?.title ?? '');
  const [description, setDescription]   = useState(task?.description ?? '');
  const [type, setType]                 = useState<TaskInstance['task_type']>(task?.task_type ?? 'info');
  const [phase, setPhase]               = useState(task?.phase ?? '');
  const [dueDate, setDueDate]           = useState<string>(task?.due_date ?? '');
  const [required, setRequired]         = useState<boolean>(task?.required ?? true);
  const [approval, setApproval]         = useState<boolean>(task?.approval_required ?? false);
  const [contentUrl, setContentUrl]     = useState(task?.content_url ?? '');
  const [contentBody, setContentBody]   = useState(task?.content_body ?? '');
  const [contentFile, setContentFile]   = useState<File | null>(null);
  const [clearFile, setClearFile]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const showRichContent = type === 'info' || type === 'meeting';

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('task_type', type);
      fd.append('phase', phase.trim());
      fd.append('content_url', showRichContent ? contentUrl.trim() : '');
      fd.append('content_body', showRichContent ? contentBody : '');
      fd.append('due_date', dueDate || '');
      fd.append('required', required ? 'true' : 'false');
      fd.append('approval_required', approval ? 'true' : 'false');
      if (contentFile) fd.append('content_file', contentFile);
      else if (clearFile) fd.append('content_file_clear', 'true');
      const saved = editing
        ? await orgApi.updateTaskInstance(onboardingId, task!.id, fd)
        : await orgApi.addTaskInstance(onboardingId, fd);
      onSaved(saved, !editing);
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; title?: string[] } };
      setError(err?.data?.detail ?? err?.data?.title?.[0] ?? 'Failed to save task.');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[90vh] overflow-y-auto pointer-events-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-[15px] font-bold text-gray-900">{editing ? 'Edit Task' : 'Add Task'}</p>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Title <span className="text-gray-400">*</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="What does this task ask the new hire to do?"
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Instructions or details..."
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Task Type</label>
                <select value={type} onChange={e => setType(e.target.value as TaskInstance['task_type'])}
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400">
                  {INSTANCE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Phase</label>
                <input value={phase} onChange={e => setPhase(e.target.value)} list="instance-phase-suggestions"
                  placeholder="e.g. Day 1, Week 1"
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                <datalist id="instance-phase-suggestions">
                  <option value="Pre-arrival" /><option value="Day 1" /><option value="Week 1" />
                  <option value="Month 1" /><option value="Ongoing" />
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400" />
              </div>
              <label className="flex items-end pb-1 gap-2 text-[12.5px] font-medium text-gray-700 cursor-pointer">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="accent-gray-900" />
                Required
              </label>
              <label className="flex items-end pb-1 gap-2 text-[12.5px] font-medium text-gray-700 cursor-pointer">
                <input type="checkbox" checked={approval} onChange={e => setApproval(e.target.checked)} className="accent-gray-900" />
                Needs approval
              </label>
            </div>

            {showRichContent && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-3">
                <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  {type === 'meeting' ? <><Video size={11} /> Meeting Details</> : <><Info size={11} /> Reference Content</>}
                </p>
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                    <LinkIcon size={11} /> {type === 'meeting' ? 'Meeting Link' : 'Link or Video URL'}
                  </label>
                  <input value={contentUrl} onChange={e => setContentUrl(e.target.value)}
                    placeholder={type === 'meeting' ? 'https://zoom.us/j/... or https://meet.google.com/...' : 'https://youtube.com/watch?v=... or any URL'}
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">
                    {type === 'meeting' ? 'Agenda / Notes' : 'Body Text'}
                  </label>
                  <textarea value={contentBody} onChange={e => setContentBody(e.target.value)} rows={3}
                    placeholder={type === 'meeting' ? 'What to discuss, who attends, prep work...' : 'Detailed instructions or reading material...'}
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400 resize-none" />
                </div>
                {type === 'info' && (
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <Paperclip size={11} /> Attachment
                    </label>
                    <input ref={fileRef} type="file" className="hidden"
                      onChange={e => { setContentFile(e.target.files?.[0] ?? null); setClearFile(false); }} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg">
                        <Upload size={12} /> {contentFile ? 'Change file' : 'Upload file'}
                      </button>
                      {contentFile && <span className="text-[11.5px] text-gray-600 truncate max-w-[200px]">{contentFile.name}</span>}
                      {!contentFile && task?.content_file_url && !clearFile && (
                        <>
                          <span className="text-[11.5px] text-gray-600">File attached</span>
                          <button type="button" onClick={() => setClearFile(true)}
                            className="text-[11.5px] font-medium text-gray-500 hover:text-gray-900">Remove</button>
                        </>
                      )}
                      {clearFile && <span className="text-[11.5px] text-gray-500 italic">Will remove existing file on save</span>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-[12px] text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <button onClick={onClose} disabled={saving}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Per-task 3-dot menu (admin authoring) ────────────────────────────────────

function TaskRowMenu({
  task, onEdit, onEditFormFields, onDelete,
}: {
  task: TaskInstance;
  onEdit: () => void;
  onEditFormFields: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, right: 0 });
  const btnRef          = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(p => !p);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="shrink-0 p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <button onClick={() => { setOpen(false); onEdit(); }}
            className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Edit3 size={12} className="text-gray-400" /> Edit task
          </button>
          {task.task_type === 'form' && (
            <button onClick={() => { setOpen(false); onEditFormFields(); }}
              className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <ListChecks size={12} className="text-gray-400" /> Manage form questions
            </button>
          )}
          <div className="my-1 h-px bg-gray-100" />
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Trash2 size={12} className="text-gray-400" /> Remove task
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Instance Form Builder (form-field CRUD on a live instance) ───────────────

const FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
  { value: 'text',     label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'choice',   label: 'Multiple Choice' },
  { value: 'boolean',  label: 'Yes / No' },
  { value: 'date',     label: 'Date' },
  { value: 'number',   label: 'Number' },
];

function InstanceFormBuilder({
  onboardingId, task, onClose, onChanged,
}: {
  onboardingId: number;
  task: TaskInstance;
  onClose: () => void;
  onChanged: (fields: TaskFormField[]) => void;
}) {
  const [fields, setFields]       = useState<TaskFormField[]>(task.form_fields ?? []);
  const [editId, setEditId]       = useState<number | null>(null);
  const [adding, setAdding]       = useState(false);
  const [question, setQuestion]   = useState('');
  const [fieldType, setFieldType] = useState<FormFieldType>('text');
  const [options, setOptions]     = useState('');
  const [required, setRequired]   = useState(true);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const reset = () => { setAdding(false); setEditId(null); setQuestion(''); setFieldType('text'); setOptions(''); setRequired(true); setErr(''); };
  const openAdd  = () => { reset(); setAdding(true); };
  const openEdit = (f: TaskFormField) => { reset(); setEditId(f.id); setQuestion(f.question); setFieldType(f.field_type); setOptions(f.options.join('\n')); setRequired(f.required); };

  const save = async () => {
    if (!question.trim()) { setErr('Question is required.'); return; }
    setSaving(true); setErr('');
    const payload = {
      question: question.trim(),
      field_type: fieldType,
      options: fieldType === 'choice' ? options.split('\n').map(o => o.trim()).filter(Boolean) : [],
      required,
      order: editId ? (fields.find(f => f.id === editId)?.order ?? fields.length) : fields.length,
    };
    try {
      let next: TaskFormField[];
      if (editId) {
        const updated = await formBuilderApi.updateInstanceField(editId, payload);
        next = fields.map(f => f.id === editId ? updated : f);
      } else {
        const created = await formBuilderApi.addInstanceField(onboardingId, task.id, payload);
        next = [...fields, created];
      }
      setFields(next);
      onChanged(next);
      reset();
    } catch { setErr('Failed to save. Try again.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    try {
      await formBuilderApi.deleteInstanceField(id);
      const next = fields.filter(f => f.id !== id);
      setFields(next);
      onChanged(next);
      if (editId === id) reset();
    } catch { setErr('Failed to delete.'); }
  };

  const isEditing = adding || editId !== null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto">
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900">Form Questions</p>
              <p className="text-[11.5px] text-gray-400 truncate max-w-[360px] mt-0.5">{task.title}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"><X size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {fields.length === 0 && !isEditing && (
              <div className="py-8 text-center text-[12.5px] text-gray-400">No questions yet. Click "+ Add Question" to start.</div>
            )}
            {fields.map(f => (
              <div key={f.id} className={`flex items-start gap-2 p-3 rounded-xl border ${editId === f.id ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800">{f.question}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {FIELD_TYPE_OPTIONS.find(o => o.value === f.field_type)?.label ?? f.field_type}
                    {f.required && <span className="ml-1.5">· Required</span>}
                    {f.options.length > 0 && <span className="ml-1.5">· {f.options.length} options</span>}
                  </p>
                </div>
                <button onClick={() => openEdit(f)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => remove(f.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {isEditing && (
              <div className="p-3 rounded-xl border border-gray-300 bg-gray-50 space-y-3">
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Question</label>
                  <input value={question} onChange={e => setQuestion(e.target.value)} autoFocus
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Field Type</label>
                    <select value={fieldType} onChange={e => setFieldType(e.target.value as FormFieldType)}
                      className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400">
                      {FIELD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-end pb-1 gap-2 text-[12.5px] font-medium text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="accent-gray-900" />
                    Required
                  </label>
                </div>
                {fieldType === 'choice' && (
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Options <span className="text-gray-400 font-normal">(one per line)</span></label>
                    <textarea value={options} onChange={e => setOptions(e.target.value)} rows={3}
                      placeholder="Option A&#10;Option B&#10;Option C"
                      className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-gray-400 resize-none" />
                  </div>
                )}
                {err && <p className="text-[11.5px] text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving}
                    className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-60">
                    {saving ? 'Saving…' : editId ? 'Save Question' : 'Add Question'}
                  </button>
                  <button onClick={reset} disabled={saving}
                    className="px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <button onClick={openAdd} disabled={isEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-50">
              <Plus size={12} /> Add Question
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg">
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Delete Task Confirm ──────────────────────────────────────────────────────

function DeleteTaskConfirm({
  task, onCancel, onConfirm,
}: {
  task: TaskInstance;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };
  return (
    <>
      <div className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-5 pointer-events-auto">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <AlertCircle size={16} className="text-gray-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">Remove task?</p>
              <p className="text-[12.5px] text-gray-600 mt-1 leading-snug">
                Remove <span className="font-semibold">{task.title}</span> from this onboarding? The template will not be affected.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} disabled={busy}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button onClick={confirm} disabled={busy}
              className="px-3.5 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-60">
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Overview Tab (Admin Dashboard) ────────────────────────────────────────────

type Analytics = ReturnType<typeof computeAnalytics>;

const TASK_CATEGORY_LABEL: Record<string, string> = {
  info:     'Documentation',
  form:     'Forms',
  upload:   'Documents',
  meeting:  'Meetings',
  approval: 'Approvals',
};
const TASK_CATEGORY_ORDER = ['info', 'form', 'upload', 'meeting', 'approval'];

function activityIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes('template') || a.includes('doc'))            return <FileText size={11} className="text-gray-500" />;
  if (a.includes('member') || a.includes('user') || a.includes('hire')) return <UserIcon size={11} className="text-gray-500" />;
  if (a.includes('meeting') || a.includes('schedule') || a.includes('date')) return <Calendar size={11} className="text-gray-500" />;
  if (a.includes('role') || a.includes('permission') || a.includes('access')) return <Shield size={11} className="text-gray-500" />;
  if (a.includes('complete') || a.includes('approve'))        return <CheckCircle2 size={11} className="text-gray-500" />;
  if (a.includes('delete') || a.includes('remove'))           return <Trash2 size={11} className="text-gray-500" />;
  return <Activity size={11} className="text-gray-500" />;
}

function humanizeAction(log: AuditLogEntry) {
  const verb = log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const target = log.record_repr ? ` · ${log.record_repr}` : '';
  return `${verb}${target}`;
}

function OverviewTab({
  analytics, instances, members, departments,
  templatesCount, coursesCount,
  auditLogs, onOpenDrawer, onEditInst, onConfirmAction, navigate,
}: {
  analytics: Analytics;
  instances: OnboardingInstance[];
  members: OrgMember[];
  departments: Department[];
  templatesCount: number;
  coursesCount: number;
  auditLogs: AuditLogEntry[];
  onOpenDrawer: (inst: OnboardingInstance) => void;
  onEditInst: (inst: OnboardingInstance) => void;
  onConfirmAction: (action: RowAction, inst: OnboardingInstance) => void;
  navigate: (path: string) => void;
}) {
  const { allTasks } = analytics;

  // Trend (range selectable: 3 / 6 / 12 months)

  // Active Onboarding List state
  const [listTab, setListTab]       = useState<'all' | 'active' | 'pending' | 'overdue' | 'completed'>('all');
  const [listSearch, setListSearch] = useState('');
  const [listDept, setListDept]     = useState('');
  const [listMgr, setListMgr]       = useState('');

  const memberMap = useMemo(() => new Map(members.map(m => [m.user.id, m])), [members]);

  type ListRow = {
    inst: OnboardingInstance;
    deptName: string;
    roleName: string;
    isOverdue: boolean;
  };

  const allRows: ListRow[] = useMemo(() => instances.map(inst => {
    const m = memberMap.get(inst.user.id);
    return {
      inst,
      deptName: m?.department_name || '—',
      roleName: m?.role?.name || '—',
      isOverdue: isOverdue(inst),
    };
  }), [instances, memberMap]);

  const overdueRowCount = allRows.filter(r => r.isOverdue).length;
  const pendingRowCount = allRows.filter(r => r.inst.status === 'pending').length;
  const activeRowCount  = allRows.filter(r => r.inst.status === 'active').length;
  const completedRowCount = allRows.filter(r => r.inst.status === 'completed').length;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (listTab === 'active')    rows = rows.filter(r => r.inst.status === 'active');
    if (listTab === 'pending')   rows = rows.filter(r => r.inst.status === 'pending');
    if (listTab === 'completed') rows = rows.filter(r => r.inst.status === 'completed');
    if (listTab === 'overdue')   rows = rows.filter(r => r.isOverdue);
    if (listDept)                rows = rows.filter(r => r.deptName === listDept);
    if (listMgr)                 rows = rows.filter(r => (r.inst.manager_name ?? '') === listMgr);
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      rows = rows.filter(r =>
        r.inst.user.display_name.toLowerCase().includes(q) ||
        r.inst.user.email.toLowerCase().includes(q) ||
        r.deptName.toLowerCase().includes(q) ||
        r.roleName.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, listTab, listDept, listMgr, listSearch]);

  const topFive = filteredRows.slice(0, 5);

  const deptOptions: DropdownOption[] = useMemo(() => {
    const fromDepts = departments.map(d => ({ value: d.name, label: d.name }));
    const present   = new Set(allRows.map(r => r.deptName).filter(n => n && n !== '—'));
    fromDepts.forEach(o => present.add(o.value));
    return Array.from(present).sort().map(n => ({ value: n, label: n }));
  }, [departments, allRows]);

  const mgrOptions: DropdownOption[] = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => { if (r.inst.manager_name) set.add(r.inst.manager_name); });
    return Array.from(set).sort().map(n => ({ value: n, label: n }));
  }, [allRows]);

  // Task Completion by Category (donut)
  const categoryData = useMemo(() => {
    const byCat: Record<string, { total: number; done: number }> = {};
    TASK_CATEGORY_ORDER.forEach(c => byCat[c] = { total: 0, done: 0 });
    allTasks.forEach(({ t }) => {
      if (!byCat[t.task_type]) byCat[t.task_type] = { total: 0, done: 0 };
      byCat[t.task_type].total++;
      if (t.status === 'completed') byCat[t.task_type].done++;
    });
    return TASK_CATEGORY_ORDER
      .map(c => ({ key: c, name: TASK_CATEGORY_LABEL[c] ?? c, total: byCat[c]?.total ?? 0, done: byCat[c]?.done ?? 0 }))
      .filter(d => d.total > 0);
  }, [allTasks]);
  const categoryTotal = categoryData.reduce((s, d) => s + d.total, 0);

  // Overdue tasks (top 5)
  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return allTasks
      .filter(({ t }) => t.status !== 'completed' && t.due_date && new Date(t.due_date).getTime() < now)
      .map(({ t, inst }) => ({
        task: t,
        inst,
        daysOverdue: Math.max(1, Math.floor((now - new Date(t.due_date!).getTime()) / 86400000)),
      }))
      .sort((a, b) => new Date(a.task.due_date!).getTime() - new Date(b.task.due_date!).getTime())
      .slice(0, 5);
  }, [allTasks]);

  // Stage Funnel
  const funnelStages = useMemo(() => {
    const tot = instances.length;
    const hasInfoDone   = (i: OnboardingInstance) => i.tasks.some(t => t.task_type === 'info'   && t.status === 'completed');
    const hasUploadDone = (i: OnboardingInstance) => i.tasks.some(t => t.task_type === 'upload' && t.status === 'completed');
    const hasMeetDone   = (i: OnboardingInstance) => i.tasks.some(t => (t.task_type === 'meeting' || t.task_type === 'approval') && t.status === 'completed');
    const stages = [
      { label: 'Invited',              count: tot },
      { label: 'Profile Completed',    count: instances.filter(hasInfoDone).length },
      { label: 'Documents Submitted',  count: instances.filter(hasUploadDone).length },
      { label: 'Training In Progress', count: instances.filter(hasMeetDone).length },
      { label: 'Onboarding Completed', count: instances.filter(i => i.status === 'completed').length },
    ];
    return stages.map(s => ({ ...s, pct: pctOf(s.count, tot) }));
  }, [instances]);

  const listTabs: { value: typeof listTab; label: string; count: number }[] = [
    { value: 'all',       label: 'All',         count: allRows.length },
    { value: 'active',    label: 'In Progress', count: activeRowCount },
    { value: 'pending',   label: 'Pending',     count: pendingRowCount },
    { value: 'overdue',   label: 'Overdue',     count: overdueRowCount },
    { value: 'completed', label: 'Completed',   count: completedRowCount },
  ];

  return (
    <div className="space-y-4">
      {/* Middle row: Active List + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Onboarding List */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-gray-900">Active Onboarding List</p>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 border-b border-gray-100 -mb-px overflow-x-auto">
              {listTabs.map(t => (
                <button
                  key={t.value}
                  onClick={() => setListTab(t.value)}
                  className={`px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    listTab === t.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label} <span className="text-gray-400 font-medium">({t.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap border-b border-gray-100">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search by name, role, dept…"
                className="w-full pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
            <Dropdown value={listDept} placeholder="All Departments" options={deptOptions} onChange={setListDept} />
            <Dropdown value={listMgr}  placeholder="All Managers"    options={mgrOptions}  onChange={setListMgr} />
          </div>

          {/* Table */}
          {topFive.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[12.5px] text-gray-500">No onboardings match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5">Name</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">Role</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">Department</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">Start Date</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5 min-w-[120px]">Progress</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {topFive.map(({ inst, deptName, roleName, isOverdue: ov }) => {
                    const statusKey: OnboardingStatus | 'overdue' =
                      ov && inst.status !== 'completed' ? 'overdue' : inst.status;
                    const statusText =
                      ov && inst.status !== 'completed' ? 'Overdue' : STATUS_LABEL[inst.status];
                    return (
                      <tr
                        key={inst.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => onOpenDrawer(inst)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {inst.user.profile_picture
                              ? <img src={inst.user.profile_picture} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                              : <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{initials(inst.user.display_name)}</div>
                            }
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-semibold text-gray-900 truncate">{inst.user.display_name}</p>
                              <p className="text-[11px] text-gray-400 truncate">{inst.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600">{roleName}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600">{deptName}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600">{fmtDate(inst.start_date)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[88px]">
                              <div className="h-full bg-gray-700 rounded-full" style={{ width: `${inst.progress_pct}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold text-gray-700 tabular-nums w-7 text-right">{inst.progress_pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(statusKey)}`} />
                            <span className="text-[11.5px] text-gray-700">{statusText}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <RowMenu
                            inst={inst}
                            onView={() => onOpenDrawer(inst)}
                            onEdit={() => onEditInst(inst)}
                            onRemind={() => onConfirmAction('remind', inst)}
                            onReset={() => onConfirmAction('reset', inst)}
                            onArchive={() => onConfirmAction(inst.status === 'archived' ? 'restore' : 'archive', inst)}
                            onDelete={() => onConfirmAction('delete', inst)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Task Completion by Category */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-2.5">Task Completion by Category</p>
            {categoryTotal === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-6">No task data yet.</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <PieChart width={110} height={110}>
                    <Pie
                      data={categoryData}
                      cx={50} cy={50} innerRadius={32} outerRadius={50}
                      dataKey="total" paddingAngle={2}
                    >
                      {categoryData.map((_, i) => <Cell key={i} fill={GRAY[i % GRAY.length]} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9.5px] text-gray-400 leading-none">Total</span>
                    <span className="text-[15px] font-bold text-gray-900 leading-none mt-0.5">{categoryTotal}</span>
                    <span className="text-[9px] text-gray-400 leading-none mt-0.5">Tasks</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {categoryData.map((d, i) => (
                    <div key={d.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: GRAY[i % GRAY.length] }} />
                        <span className="text-[11px] text-gray-600 truncate">{d.name}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700 shrink-0 ml-2">
                        {d.total} <span className="text-gray-400 font-normal">({pctOf(d.total, categoryTotal)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Overdue Tasks */}
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-gray-900">Overdue Tasks</p>
            </div>
            {overdueTasks.length === 0 ? (
              <p className="px-4 pb-4 text-[12px] text-gray-400">No overdue tasks. </p>
            ) : (
              <div className="px-2 pb-2">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">Task</th>
                      <th className="text-left text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">Assignee</th>
                      <th className="text-right text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueTasks.map(({ task, inst, daysOverdue }) => (
                      <tr
                        key={`${inst.id}-${task.id}`}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => onOpenDrawer(inst)}
                      >
                        <td className="px-2 py-1.5 text-[11.5px] text-gray-700 truncate max-w-[120px]">{task.title}</td>
                        <td className="px-2 py-1.5 text-[11.5px] text-gray-500 truncate max-w-[100px]">{inst.user.display_name}</td>
                        <td className="px-2 py-1.5 text-right text-[11.5px] font-semibold text-gray-900 tabular-nums">{daysOverdue}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Templates & Configuration */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-900 mb-3">Templates & Configuration</p>
            <div className="space-y-2">
              {[
                { icon: <GraduationCap size={12} className="text-gray-500" />, label: 'Training Courses', count: coursesCount, path: '/org/training' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">{row.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 truncate">{row.label}</p>
                      <p className="text-[10.5px] text-gray-400">{row.count} active</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(row.path)}
                    className="px-2.5 py-1 text-[11px] font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Funnel + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stage Funnel */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-gray-900">Onboarding Stage Funnel</p>
            <span className="text-[10.5px] text-gray-400">{instances.length} total</span>
          </div>
          {instances.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-8">No onboardings yet.</p>
          ) : (
            <div className="space-y-2.5">
              {funnelStages.map((s, i) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-44 shrink-0">
                    <p className="text-[12px] font-medium text-gray-700">{s.label}</p>
                  </div>
                  <div className="flex-1 h-5 bg-gray-50 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{ width: `${s.pct}%`, background: GRAY[Math.min(i, GRAY.length - 1)] }}
                    />
                  </div>
                  <div className="w-24 text-right shrink-0">
                    <span className="text-[12.5px] font-semibold text-gray-900 tabular-nums">{s.count}</span>
                    <span className="text-[11px] text-gray-400 ml-1">({s.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[13px] font-bold text-gray-900 mb-3">Recent Activities</p>
          {auditLogs.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-6">No recent activity yet.</p>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-start gap-2.5 pb-2.5 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                    {activityIcon(log.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-gray-700 leading-tight truncate">{humanizeAction(log)}</p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5">{log.actor_name} · {fmtRelative(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page Help (full guide popover) ────────────────────────────────────────────

const ONBOARDING_HELP_SECTIONS: PageHelpSection[] = [
  {
    eyebrow: '1 · Prepare a Task Template',
    bullets: [
      'Go to **Task Templates** and build a reusable program (e.g. "Intern Onboarding").',
      'Add tasks of each kind: **Info** (reference material), **Form** (questions), **Upload** (file from member), **Meeting** (link + agenda), **Approval** (admin sign-off).',
      'Group tasks by **phase** (Day 1, Week 1, Week 2…) — phases keep the timeline scannable.',
    ],
  },
  {
    eyebrow: '2 · Assign an Onboarding',
    bullets: [
      'Click **+ Add New Onboarding** at the top right.',
      'Pick the member, choose a template, optionally set a manager and buddy, then save.',
      'The template\'s tasks are copied into a per-member instance. Template edits made later do **not** change existing instances.',
    ],
  },
  {
    eyebrow: '3 · Customize per Member',
    bullets: [
      'Click a row → opens the detail view. Use the **+ Add Task** button to add a one-off task for this person.',
      'Each task\'s 3-dot menu has **Edit task**, **Manage form questions** (for forms), and **Remove task**.',
      'Edits here only affect this onboarding — the template stays untouched.',
    ],
  },
  {
    eyebrow: '4 · Track Progress',
    bullets: [
      '**Focused** view (default) shows one task at a time with Prev / Next pagination. Use **List** for the full picture.',
      'Status filters: **All / In Progress / Pending / Overdue / Completed**. The donut and funnel update live.',
      'Use the **Remind**, **Reset**, and **Archive** actions from the row 3-dot menu or the detail sidebar.',
    ],
  },
  {
    eyebrow: '5 · Approvals, Files, Comments',
    bullets: [
      '**Approval** tasks show Approve / Reject buttons — the member is blocked until you act.',
      '**Upload** tasks accept files from the member, or you can upload on their behalf.',
      'Use the per-task **Comments** thread for member-facing messages and the **Admin Notes** field for private notes.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Each task type has its own small ? next to its label inside the detail view — click it for type-specific guidance.',
  },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function OrgOnboardingMgmt() {
  const { canManageMembers } = useOrg();
  const navigate = useNavigate();

  const [instances, setInstances]         = useState<OnboardingInstance[]>([]);
  const [members, setMembers]             = useState<OrgMember[]>([]);
  const [templates, setTemplates]         = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments]     = useState<Department[]>([]);
  const [coursesCount, setCoursesCount]   = useState(0);
  const [auditLogs, setAuditLogs]         = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showCreate, setShowCreate]       = useState(false);
  const [overviewDrawerInst, setOverviewDrawerInst] = useState<OnboardingInstance | null>(null);
  const [editInst, setEditInst]           = useState<OnboardingInstance | null>(null);
  const [confirm, setConfirm]             = useState<{ action: RowAction; inst: OnboardingInstance } | null>(null);
  const [actionBusy, setActionBusy]       = useState(false);
  const [toast, setToast]                 = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    Promise.all([
      orgApi.getOnboardings().catch(() => [] as OnboardingInstance[]),
      orgApi.getMembers().catch(() => [] as OrgMember[]),
      orgApi.getTemplates().catch(() => [] as OnboardingTemplate[]),
      orgApi.getDepartments().catch(() => [] as Department[]),
      trainingApi.getCourses().catch(() => [] as unknown[]),
      auditApi.getLogs({ module: 'onboarding', limit: 10 }).catch(() => [] as AuditLogEntry[]),
    ]).then(([insts, mems, tmps, depts, courses, logs]) => {
      setInstances(insts as OnboardingInstance[]);
      setMembers(mems as OrgMember[]);
      setTemplates(tmps as OnboardingTemplate[]);
      setDepartments(depts as Department[]);
      setCoursesCount((courses as unknown[]).length);
      setAuditLogs(logs as AuditLogEntry[]);
    }).finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => computeAnalytics(instances), [instances]);

  const handleCreated = (o: OnboardingInstance) => {
    setInstances(p => [o, ...p]);
  };
  const handleUpdated = (o: OnboardingInstance) => {
    setInstances(p => p.map(i => i.id === o.id ? o : i));
    if (overviewDrawerInst?.id === o.id) setOverviewDrawerInst(o);
  };
  const handleDeleted = (id: number) => {
    setInstances(p => p.filter(i => i.id !== id));
    if (overviewDrawerInst?.id === id) setOverviewDrawerInst(null);
  };

  const runConfirmedAction = async () => {
    if (!confirm) return;
    const { action, inst } = confirm;
    setActionBusy(true);
    try {
      if (action === 'remind') {
        await orgApi.remindOnboarding(inst.id);
        setToast('Reminder sent');
      } else if (action === 'reset') {
        const u = await orgApi.resetOnboarding(inst.id);
        handleUpdated(u);
        setToast('Onboarding reset');
      } else if (action === 'archive') {
        const u = await orgApi.updateOnboarding(inst.id, { status: 'archived' });
        handleUpdated(u);
        setToast('Archived');
      } else if (action === 'restore') {
        const u = await orgApi.updateOnboarding(inst.id, { status: 'active' });
        handleUpdated(u);
        setToast('Restored');
      } else if (action === 'delete') {
        await orgApi.deleteOnboarding(inst.id);
        handleDeleted(inst.id);
        setToast('Onboarding removed');
      }
      setConfirm(null);
    } catch {
      setToast('Something went wrong');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-gray-100 rounded-xl animate-pulse w-64" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-32 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-72 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-56 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Onboarding Management</h1>
            <PageHelp title="How Onboarding Works" sections={ONBOARDING_HELP_SECTIONS} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">Track and manage member onboarding programs</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => exportCSV(instances)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
            <Download size={12} /> Export
          </button>
          {canManageMembers && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors">
              <Plus size={12} /> Add New Onboarding
            </button>
          )}
        </div>
      </div>

      {/* Overview */}
      <OverviewTab
        analytics={analytics}
        instances={instances}
        members={members}
        departments={departments}
        templatesCount={templates.length}
        coursesCount={coursesCount}
        auditLogs={auditLogs}
        onOpenDrawer={setOverviewDrawerInst}
        onEditInst={setEditInst}
        onConfirmAction={(action, inst) => setConfirm({ action, inst })}
        navigate={navigate}
      />

      {showCreate && (
        <CreateOnboardingModal
          templates={templates} members={members}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {overviewDrawerInst && (
        <OnboardingDetailDrawer
          inst={overviewDrawerInst}
          members={members}
          onClose={() => setOverviewDrawerInst(null)}
          onUpdated={u => { handleUpdated(u); setOverviewDrawerInst(u); }}
          onDeleted={id => { handleDeleted(id); setOverviewDrawerInst(null); }}
        />
      )}

      {editInst && (
        <EditOnboardingModal
          inst={editInst}
          members={members}
          onClose={() => setEditInst(null)}
          onSaved={u => { handleUpdated(u); setEditInst(null); setToast('Onboarding updated'); }}
        />
      )}

      {confirm && (
        <ConfirmActionModal
          action={confirm.action}
          inst={confirm.inst}
          busy={actionBusy}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirmedAction}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 bg-gray-900 text-white text-[12.5px] font-semibold rounded-xl shadow-lg flex items-center gap-2">
          <Check size={13} /> {toast}
        </div>
      )}
    </div>
  );
}
