import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Calendar, Upload,
  ChevronLeft, Search, ExternalLink, AlertCircle,
  Target, RefreshCw, Paperclip, ArrowRight, Users,
  Clock, TrendingUp, ClipboardList, Settings, Download, MoreVertical, X,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  contributionsApi, settingsApi,
  type Contribution, type ContributionType,
  type ContributionStatus, type ContributionSummary,
  type ContributionInsights, type ContributionCategory,
  type ContributionMemberSummary,
  type ContributionAdminSummary, type ContributionOverview, type ContributionByDept,
  type OrgSettingsData,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const CONTRIBUTIONS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Contribution?',
    bullets: [
      'A **contribution** is any logged task, activity, or hours a member submits to record their work.',
      'Members submit contributions from their **My Contributions** page — including a title, hours, category, and impact level.',
      'Admins review submissions here and can **approve or reject** each one with an optional note.',
    ],
  },
  {
    eyebrow: '2 · Reviewing Submissions',
    bullets: [
      'The **Approval Queue** on the right shows all pending contributions waiting for your review.',
      'Click a member row to open their **detail panel** — see all their contributions, logs, and history.',
      'Use **Approve** or **Reject** on each log. Rejected logs are returned to the member with your note.',
      'Use **Bulk Review** to approve or reject multiple submissions at once.',
    ],
  },
  {
    eyebrow: '3 · Member Contributions Table',
    bullets: [
      'Each row summarises a member — total hours, pending count, approved total, and last activity date.',
      'Filter by **department, role, or status** to narrow down the list.',
      'Click a row to open the full **member contribution detail** with individual log entries.',
    ],
  },
  {
    eyebrow: '4 · Contribution by Department',
    bullets: [
      'The right-side **pie chart** breaks down total approved hours by department for the selected period.',
      'Use the **This Month / This Week / All Time** selector to change the period.',
    ],
  },
  {
    eyebrow: '5 · Export & Settings',
    bullets: [
      'Click **Export** to download all contribution data as a CSV.',
      'Use **Contribution Settings** to configure categories, required fields, and approval workflows.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Members earn recognition points for approved contributions — make sure to review the queue regularly so points are credited on time.',
  },
];

const MEMBER_CONTRIBUTIONS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Contribution?',
    bullets: [
      'A **contribution** is a log of work you have done — tasks, projects, hours, or milestones.',
      'Logging contributions helps the team see your impact and earns you recognition points.',
    ],
  },
  {
    eyebrow: '2 · Logging Your Work',
    bullets: [
      'Use **Quick Log** to record a title, type, date, and hours in seconds.',
      'Use **Detailed Log** to add a description, evidence files, and impact level for a richer entry.',
      'Click **Submit Contribution** to send your log for admin review.',
    ],
  },
  {
    eyebrow: '3 · Status',
    bullets: [
      '**Pending** — submitted and waiting for admin review.',
      '**Approved** — accepted; hours and points have been credited.',
      '**Rejected** — returned with an admin note. Revise and resubmit if needed.',
    ],
  },
  {
    eyebrow: '4 · Evidence',
    bullets: [
      'Attach supporting files (PDFs, screenshots, links) to strengthen your log.',
      'Evidence helps admins approve faster and reduces back-and-forth.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Log contributions regularly — weekly is best. Small, frequent logs are easier to approve than a large end-of-month catch-up.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const STATUS_DOT: Record<ContributionStatus, string> = {
  pending:  'bg-gray-400',
  approved: 'bg-gray-900',
  rejected: 'bg-gray-300',
};
const STATUS_LABEL: Record<ContributionStatus, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
};
const TYPE_LABEL: Record<ContributionType, string> = {
  hours: 'Hours', task: 'Task', deliverable: 'Deliverable',
};
const CAT_LABEL: Record<ContributionCategory, string> = {
  project_work: 'Project Work', meetings: 'Meetings',
  learning: 'Learning', other: 'Other',
};
const DONUT_COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af'];

function fmtActivityDate(iso: string | null): string {
  if (!iso) return '—';
  const todayStr     = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  if (iso === todayStr)     return 'Today';
  if (iso === yesterdayStr) return 'Yesterday';
  return fmtShortDate(iso);
}

const PAGE_SIZE       = 7;
const ADMIN_PAGE_SIZE = 7;

// ── Admin helpers (kept from original) ───────────────────────────────────────

const STATUS_BADGE_ADMIN: Record<ContributionStatus, string> = {
  pending:  'bg-gray-100 text-gray-600',
  approved: 'bg-gray-900 text-white',
  rejected: 'bg-gray-100 text-gray-400',
};
const TYPE_BADGE_ADMIN: Record<ContributionType, string> = {
  hours:       'bg-gray-100 text-gray-700',
  task:        'bg-gray-100 text-gray-700',
  deliverable: 'bg-gray-100 text-gray-700',
};

// ── Admin Review Row ──────────────────────────────────────────────────────────

type ReviewAction = 'approve' | 'reject' | 'reset';

const ACTION_CONFIG: Record<ReviewAction, { label: string; description: string; confirmLabel: string; danger?: boolean }> = {
  approve: { label: 'Approve',          description: 'Mark this contribution as approved.',          confirmLabel: 'Approve' },
  reject:  { label: 'Reject',           description: 'Mark this contribution as rejected.',           confirmLabel: 'Reject',  danger: true },
  reset:   { label: 'Undo & Reset',     description: 'Reset this contribution back to pending review.', confirmLabel: 'Reset' },
};

function AdminReviewRow({
  c,
  onReviewed,
}: {
  c: Contribution;
  onReviewed: (updated: Contribution) => void;
}) {
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [confirming,  setConfirming]  = useState<ReviewAction | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [reviewErr,   setReviewErr]   = useState('');

  const menuActions: ReviewAction[] = c.status === 'pending'
    ? ['approve', 'reject']
    : c.status === 'approved'
    ? ['reset', 'reject']
    : ['reset', 'approve'];

  const doReview = async (action: ReviewAction) => {
    setSaving(true);
    setReviewErr('');
    try {
      const updated = await contributionsApi.reviewContribution(c.id, action);
      onReviewed(updated);
      setConfirming(null);
    } catch {
      setReviewErr('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${TYPE_BADGE_ADMIN[c.contribution_type]}`}>
                {TYPE_LABEL[c.contribution_type]}
              </span>
              <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${STATUS_BADGE_ADMIN[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <p className="text-[13.5px] font-bold text-gray-900">{c.title}</p>
            <p className="text-[12px] text-gray-400 mt-0.5">{c.member_name} · {fmtDate(c.date)}</p>
            {c.project_name && <p className="text-[12px] text-gray-500 mt-1">📁 {c.project_name}</p>}
            {c.hours && <p className="text-[12px] text-gray-500 mt-1">{c.hours} hours</p>}
            {c.impact_level && (
              <span className={`inline-block mt-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${
                c.impact_level === 'high' ? 'bg-gray-900 text-white' : c.impact_level === 'medium' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'
              }`}>{c.impact_level.charAt(0).toUpperCase() + c.impact_level.slice(1)} Impact</span>
            )}
            {c.collaborators && <p className="text-[12px] text-gray-500 mt-1">👥 {c.collaborators}</p>}
            {c.description && <p className="text-[12px] text-gray-600 mt-1 leading-relaxed">{c.description}</p>}
            {c.deliverable_url && (
              <a href={c.deliverable_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-[12px] text-gray-600 hover:text-gray-900 hover:underline">
                <ExternalLink size={11} /> View deliverable
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.evidence_file_url && (
              <a href={c.evidence_file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11.5px] text-gray-600 hover:text-gray-900 hover:underline">
                <ExternalLink size={11} /> Evidence
              </a>
            )}
            {/* 3-dot menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                    {menuActions.map(action => (
                      <button
                        key={action}
                        onClick={() => { setMenuOpen(false); setConfirming(action); setReviewErr(''); }}
                        className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 transition-colors ${
                          action === 'reject' ? 'text-red-600' : 'text-gray-700'
                        }`}
                      >
                        {ACTION_CONFIG[action].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[380px] mx-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[14px] font-bold text-gray-900">{ACTION_CONFIG[confirming].label} Contribution</p>
              <button onClick={() => { setConfirming(null); setReviewErr(''); }} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-gray-600 mb-1">{ACTION_CONFIG[confirming].description}</p>
            <p className="text-[12px] text-gray-400 mb-5">"{c.title}"</p>
            {reviewErr && <p className="text-[11.5px] text-red-600 mb-3">{reviewErr}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setConfirming(null); setReviewErr(''); }}
                className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => doReview(confirming)}
                disabled={saving}
                className={`px-4 py-2 text-[12.5px] font-semibold text-white rounded-lg disabled:opacity-60 transition-colors ${
                  ACTION_CONFIG[confirming].danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {saving ? 'Saving…' : ACTION_CONFIG[confirming].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgContributions() {
  const { isSuperadmin, canViewAllContributions } = useOrg();
  const isAdmin = isSuperadmin || canViewAllContributions;

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary]             = useState<ContributionSummary | null>(null);
  const [insights, setInsights]           = useState<ContributionInsights | null>(null);
  const [loading, setLoading]             = useState(true);

  // Admin view state
  const [adminView, setAdminView]               = useState<'dashboard' | 'detail'>('dashboard');
  const [adminStats, setAdminStats]             = useState<ContributionAdminSummary | null>(null);
  const [overview, setOverview]                 = useState<ContributionOverview | null>(null);
  const [overviewPeriod, setOverviewPeriod]     = useState<'month' | 'week' | 'year'>('month');
  const [deptData, setDeptData]                 = useState<ContributionByDept[]>([]);
  const [deptPeriod, setDeptPeriod]             = useState<'month' | 'all_time'>('month');
  const [membersSummary, setMembersSummary]     = useState<ContributionMemberSummary[]>([]);
  const [queueExpanded, setQueueExpanded]       = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [showSettings, setShowSettings]         = useState(false);
  const [exportLoading, setExportLoading]       = useState(false);
  const [settingsSaving, setSettingsSaving]     = useState(false);
  const [settingsContribEnabled, setSettingsContribEnabled]     = useState(true);
  const [settingsRequireEvidence, setSettingsRequireEvidence]   = useState(false);
  // Members table filters
  const [membersSearch, setMembersSearch]       = useState('');
  const [deptFilter, setDeptFilter]             = useState('all');
  const [roleFilter, setRoleFilter]             = useState('all');
  const [statusFilter, setStatusFilter]         = useState<'all' | 'pending_review' | 'approved'>('all');
  const [membersPage, setMembersPage]           = useState(1);
  const [openMenuId, setOpenMenuId]             = useState<number | null>(null);
  // Member detail
  const [selectedMember, setSelectedMember]     = useState<ContributionMemberSummary | null>(null);
  const [memberContribs, setMemberContribs]     = useState<Contribution[]>([]);
  const [memberLoading, setMemberLoading]       = useState(false);
  const [detailStatus, setDetailStatus]         = useState<ContributionStatus | 'all'>('all');
  const [detailSearch, setDetailSearch]         = useState('');
  const [detailDatePreset, setDetailDatePreset] = useState<'all' | 'this_week' | 'this_month' | 'custom'>('all');
  const [detailDateFrom, setDetailDateFrom]     = useState('');
  const [detailDateTo, setDetailDateTo]         = useState('');
  const [selectedIds, setSelectedIds]           = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading]           = useState(false);

  // Member view state
  const [view, setView]               = useState<'dashboard' | 'all_logs'>('dashboard');
  const [logTab, setLogTab]           = useState<'quick' | 'detailed'>('quick');
  const [insightPeriod, setInsightPeriod] = useState<'month' | 'week'>('month');

  // Quick/Detailed log form
  const [qTitle, setQTitle]     = useState('');
  const [qType, setQType]       = useState<ContributionType>('hours');
  const [qDate, setQDate]       = useState(TODAY_ISO);
  const [qHours, setQHours]     = useState('');
  const [qDesc, setQDesc]       = useState('');
  const [qFile, setQFile]       = useState<File | null>(null);
  const [qDragOver, setQDragOver] = useState(false);
  const [dCategory, setDCategory]       = useState<ContributionCategory>('other');
  const [dProjectName, setDProjectName] = useState('');
  const [dImpact, setDImpact]           = useState('');
  const [dCollaborators, setDCollaborators] = useState('');
  const [dDeliverableUrl, setDDeliverableUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All Logs view
  const [logsStatus, setLogsStatus] = useState<ContributionStatus | 'all'>('all');
  const [logsSearch, setLogsSearch] = useState('');
  const [logsPage, setLogsPage]     = useState(1);

  useEffect(() => {
    if (isAdmin) {
      setLoading(true);
      Promise.all([
        contributionsApi.getAdminSummary(),
        contributionsApi.getOverview('month'),
        contributionsApi.getMembersSummary(),
        contributionsApi.getByDepartment('month'),
      ])
        .then(([stats, ov, members, dept]) => {
          setAdminStats(stats);
          setOverview(ov);
          setMembersSummary(members);
          setDeptData(dept);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        contributionsApi.getContributions(),
        contributionsApi.getSummary(),
        contributionsApi.getInsights(),
      ])
        .then(([cs, s, ins]) => { setContributions(cs); setSummary(s); setInsights(ins); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load org settings when settings modal opens
  useEffect(() => {
    if (!showSettings) return;
    settingsApi.getSettings()
      .then((s: OrgSettingsData) => {
        setSettingsContribEnabled(s.contribution_enabled);
        setSettingsRequireEvidence(s.contribution_require_evidence);
      })
      .catch(() => {});
  }, [showSettings]);

  const updateContribution = (updated: Contribution) =>
    setContributions(cs => cs.map(c => c.id === updated.id ? updated : c));

  const openMemberDetail = (m: ContributionMemberSummary) => {
    setSelectedMember(m);
    setAdminView('detail');
    setDetailStatus('all');
    setDetailSearch('');
    setSelectedIds(new Set());
    setMemberLoading(true);
    contributionsApi.getContributions({ member_id: m.member_id })
      .then(cs => setMemberContribs(cs))
      .catch(() => {})
      .finally(() => setMemberLoading(false));
  };

  const updateMemberContrib = (updated: Contribution) => {
    setMemberContribs(cs => {
      const old = cs.find(c => c.id === updated.id);
      const oldStatus = old?.status;
      const newStatus = updated.status;
      setMembersSummary(ms => ms.map(m => {
        if (m.member_id !== selectedMember?.member_id) return m;
        return {
          ...m,
          pending:  Math.max(0, m.pending
            - (oldStatus === 'pending' ? 1 : 0)
            + (newStatus === 'pending' ? 1 : 0)),
          approved: Math.max(0, m.approved
            - (oldStatus === 'approved' ? 1 : 0)
            + (newStatus === 'approved' ? 1 : 0)),
        };
      }));
      return cs.map(c => c.id === updated.id ? updated : c);
    });
  };

  const doBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await contributionsApi.bulkReview(Array.from(selectedIds), action);
      setMemberContribs(cs => cs.map(c =>
        res.updated.includes(c.id)
          ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' }
          : c
      ));
      const count = res.updated.length;
      setMembersSummary(ms => ms.map(m => {
        if (m.member_id !== selectedMember?.member_id) return m;
        return {
          ...m,
          pending:  Math.max(0, m.pending - count),
          approved: action === 'approve' ? m.approved + count : m.approved,
        };
      }));
      setSelectedIds(new Set());
    } catch { /* no-op */ }
    finally { setBulkLoading(false); }
  };

  const doExport = async () => {
    setExportLoading(true);
    try { await contributionsApi.exportCsv(); }
    catch { /* no-op */ }
    finally { setExportLoading(false); }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await settingsApi.updateSettings({
        contribution_enabled:          settingsContribEnabled,
        contribution_require_evidence: settingsRequireEvidence,
      });
      setShowSettings(false);
    } catch { /* no-op */ }
    finally { setSettingsSaving(false); }
  };

  const handleOverviewPeriodChange = (period: 'month' | 'week' | 'year') => {
    setOverviewPeriod(period);
    contributionsApi.getOverview(period).then(ov => setOverview(ov)).catch(() => {});
  };

  const handleDeptPeriodChange = (period: 'month' | 'all_time') => {
    setDeptPeriod(period);
    contributionsApi.getByDepartment(period).then(dept => setDeptData(dept)).catch(() => {});
  };

  const doSubmit = async (): Promise<boolean> => {
    if (!qTitle.trim()) { setSubmitError('Title is required.'); return false; }
    setSubmitting(true);
    setSubmitError('');
    const fd = new FormData();
    fd.append('title', qTitle.trim());
    fd.append('contribution_type', qType);
    fd.append('date', qDate);
    fd.append('description', qDesc.trim());
    fd.append('category', logTab === 'detailed' ? dCategory : 'other');
    if (qType === 'hours' && qHours) fd.append('hours', qHours);
    if (logTab === 'detailed') {
      if (dProjectName.trim())    fd.append('project_name',    dProjectName.trim());
      if (dImpact)                fd.append('impact_level',    dImpact);
      if (dCollaborators.trim())  fd.append('collaborators',   dCollaborators.trim());
      if (dDeliverableUrl.trim()) fd.append('deliverable_url', dDeliverableUrl.trim());
    }
    if (qFile) fd.append('evidence_file', qFile);
    try {
      const created = await contributionsApi.submitContribution(fd);
      setContributions(prev => [created, ...prev]);
      setSummary(s => s ? {
        ...s,
        month_contributions: s.month_contributions + 1,
        total_contributions: s.total_contributions + 1,
        pending: s.pending + 1,
        ...(qType === 'hours' && qHours ? {
          month_hours: s.month_hours + parseFloat(qHours),
          week_hours:  s.week_hours  + parseFloat(qHours),
        } : {}),
      } : s);
      setQTitle(''); setQHours(''); setQDesc(''); setQFile(null);
      setDProjectName(''); setDImpact(''); setDCollaborators(''); setDDeliverableUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return true;
    } catch {
      setSubmitError('Failed to submit. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="h-6 bg-gray-100 rounded-xl animate-pulse w-40" />
          <div className="flex gap-2">
            <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-24" />
            <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-44" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Admin view ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    const initials = (name: string) =>
      name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

    // ── Admin dashboard ───────────────────────────────────────────────────────
    if (adminView === 'dashboard') {
      const uniqueDepts = Array.from(new Set(membersSummary.map(m => m.department_name).filter(Boolean)));
      const uniqueRoles = Array.from(new Set(membersSummary.map(m => m.role_name).filter(Boolean)));

      const filteredMembers = membersSummary.filter(m => {
        if (membersSearch) {
          const q = membersSearch.toLowerCase();
          if (!m.member_name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
        }
        if (deptFilter !== 'all' && m.department_name !== deptFilter) return false;
        if (roleFilter !== 'all' && m.role_name !== roleFilter)         return false;
        if (statusFilter !== 'all' && m.status !== statusFilter)        return false;
        return true;
      });

      const totalPages = Math.max(1, Math.ceil(filteredMembers.length / ADMIN_PAGE_SIZE));
      const safePage   = Math.min(membersPage, totalPages);
      const paginated  = filteredMembers.slice((safePage - 1) * ADMIN_PAGE_SIZE, safePage * ADMIN_PAGE_SIZE);

      const approvalQueue  = membersSummary.filter(m => m.pending > 0).sort((a, b) => (b.last_activity || '').localeCompare(a.last_activity || ''));
      const queueVisible   = queueExpanded ? approvalQueue : approvalQueue.slice(0, 4);
      const queueMore      = approvalQueue.length - 4;
      const activity       = adminStats?.recent_activity ?? [];
      const activityVisible = activityExpanded ? activity : activity.slice(0, 4);

      const memberPageButtons = Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
        .reduce<(number | '…')[]>((acc, n, idx, arr) => {
          if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
          acc.push(n);
          return acc;
        }, []);

      const overviewInterval = overviewPeriod === 'week' ? 0 : overviewPeriod === 'month' ? 4 : 30;

      return (
        <div className="flex flex-col gap-4" onClick={() => setOpenMenuId(null)}>
          {/* Header */}
          <div className="flex items-start justify-between shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-[16px] font-bold text-gray-900">Contributions</h1>
                <PageHelp title="How Contributions Work" sections={CONTRIBUTIONS_HELP} />
              </div>
              <p className="text-[12px] text-gray-500 mt-0.5">Review and approve member contributions and logged hours</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); doExport(); }}
                disabled={exportLoading}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-[12.5px] font-semibold px-3 py-1.5 transition-colors disabled:opacity-60"
              >
                <Download size={13} /> {exportLoading ? 'Exporting…' : 'Export'}
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowSettings(true); }}
                className="flex items-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800 rounded-lg text-[12.5px] font-semibold px-3 py-1.5 transition-colors"
              >
                <Settings size={13} /> Contribution Settings
              </button>
            </div>
          </div>

          {/* Main 2-col grid */}
          <div className="grid grid-cols-[1fr_320px] gap-4">
            {/* ── Left column ── */}
            <div className="space-y-4">

              {/* Member Contributions Table */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                  <p className="text-[13px] font-bold text-gray-900 mb-3">Member Contributions</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input value={membersSearch} onChange={e => { setMembersSearch(e.target.value); setMembersPage(1); }} placeholder="Search members..." className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
                    </div>
                    <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setMembersPage(1); }} className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer">
                      <option value="all">All Departments</option>
                      {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setMembersPage(1); }} className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer">
                      <option value="all">All Roles</option>
                      {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setMembersPage(1); }} className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer">
                      <option value="all">Status: All</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="approved">Approved</option>
                    </select>
                    <button onClick={() => { setMembersSearch(''); setDeptFilter('all'); setRoleFilter('all'); setStatusFilter('all'); setMembersPage(1); }} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-semibold px-2.5 py-1.5 transition-colors">
                      <TrendingUp size={12} /> Filters
                    </button>
                  </div>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[minmax(0,1fr)_80px_75px_72px_65px_100px_88px_108px_28px] gap-2 px-4 py-2 border-b border-gray-50 bg-gray-50/50">
                  {['Member','Department','Role','Total Hrs','Pending','Approved (All)','Last Activity','Status',''].map(h => (
                    <span key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{h}</span>
                  ))}
                </div>

                {/* Rows — fixed height so card never resizes */}
                <div className="h-[392px]">
                {paginated.length === 0 ? (
                  <div className="h-full flex items-center justify-center"><p className="text-[13px] text-gray-400">{membersSummary.length === 0 ? 'No contributions submitted yet.' : 'No members match your filters.'}</p></div>
                ) : (
                  paginated.map(m => (
                    <div
                      key={m.member_id}
                      className="grid grid-cols-[minmax(0,1fr)_80px_75px_72px_65px_100px_88px_108px_28px] gap-2 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/40 items-center cursor-pointer transition-colors"
                      onClick={() => openMemberDetail(m)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {m.member_picture
                          ? <img src={m.member_picture} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-700 text-[11px] font-bold shrink-0">{initials(m.member_name)}</div>
                        }
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-gray-900 truncate">{m.member_name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{m.email}</p>
                        </div>
                      </div>
                      <span className="text-[12px] text-gray-600 truncate">{m.department_name || '—'}</span>
                      <span className="text-[12px] text-gray-600 truncate">{m.role_name || '—'}</span>
                      <span className="text-[12.5px] font-medium text-gray-700">{m.total_hours.toFixed(1)}</span>
                      <span className="text-[12.5px] font-medium text-gray-700">{m.pending_hours > 0 ? m.pending_hours.toFixed(1) : '—'}</span>
                      <span className="text-[12.5px] font-medium text-gray-700">{m.approved_hours.toFixed(1)}</span>
                      <span className="text-[12px] text-gray-500">{m.last_activity ? fmtDate(m.last_activity) : '—'}</span>
                      <div>
                        {m.status === 'pending_review' ? (
                          <span className="bg-gray-900 text-white text-[10.5px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap">Pending Review</span>
                        ) : m.status === 'approved' ? (
                          <span className="bg-white text-gray-600 border border-gray-300 text-[10.5px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap">Approved</span>
                        ) : (
                          <span className="text-[11px] text-gray-400">No activity</span>
                        )}
                      </div>
                      {/* 3-dot menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenuId(openMenuId === m.member_id ? null : m.member_id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                          <MoreVertical size={13} />
                        </button>
                        {openMenuId === m.member_id && (
                          <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40">
                            <button onClick={() => { setOpenMenuId(null); openMemberDetail(m); }} className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">View Contributions</button>
                            {m.pending > 0 && <button onClick={() => { setOpenMenuId(null); openMemberDetail(m); }} className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50">Review Pending</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                </div>

                {/* Pagination — always rendered to keep card height constant */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-[12px] text-gray-500">
                    {filteredMembers.length === 0 ? 'No members' : `Showing ${(safePage - 1) * ADMIN_PAGE_SIZE + 1}–${Math.min(safePage * ADMIN_PAGE_SIZE, filteredMembers.length)} of ${filteredMembers.length}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setMembersPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={13} /></button>
                    {memberPageButtons.map((n, i) =>
                      n === '…' ? <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-[12px] text-gray-400">…</span>
                        : <button key={n} onClick={() => setMembersPage(n as number)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12.5px] font-semibold transition-colors ${n === safePage ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{n}</button>
                    )}
                    <button onClick={() => setMembersPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ArrowRight size={13} /></button>
                  </div>
                </div>
              </div>

              {/* Contribution Overview */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-bold text-gray-900">Contribution Overview</p>
                  <select
                    value={overviewPeriod}
                    onChange={e => handleOverviewPeriodChange(e.target.value as 'month' | 'week' | 'year')}
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="month">This Month</option>
                    <option value="week">This Week</option>
                    <option value="year">This Year</option>
                  </select>
                </div>
                <div className="grid grid-cols-[1fr_160px] gap-4">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-gray-900 inline-block rounded" /><span className="text-[11px] text-gray-500">Hours Submitted</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-gray-400 inline-block" /><span className="text-[11px] text-gray-500">Hours Approved</span></div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={overview?.daily ?? []} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="date" tickFormatter={v => fmtShortDate(v)} interval={overviewInterval} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickCount={4} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v: number, name: string) => [`${v}h`, name === 'submitted' ? 'Submitted' : 'Approved']} labelFormatter={fmtShortDate} />
                        <Line type="monotone" dataKey="submitted" stroke="#111827" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#111827' }} />
                        <Line type="monotone" dataKey="approved" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 2" dot={false} activeDot={{ r: 3, fill: '#9ca3af' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 border-l border-gray-100 pl-4">
                    {[
                      { label: 'Total Submitted', value: `${overview?.total_submitted.toFixed(1) ?? '0.0'} hrs` },
                      { label: 'Total Approved',  value: `${overview?.total_approved.toFixed(1) ?? '0.0'} hrs` },
                      { label: 'Pending Review',  value: `${overview?.pending_hours.toFixed(1) ?? '0.0'} hrs` },
                      { label: 'Avg hrs/member',  value: `${overview?.avg_per_member ?? '0.0'} hrs` },
                    ].map(row => (
                      <div key={row.label}>
                        <p className="text-[11px] text-gray-500">{row.label}</p>
                        <p className="text-[14px] font-bold text-gray-900 mt-0.5">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="space-y-4">

              {/* Approval Queue */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-bold text-gray-900">Approval Queue</p>
                  <button onClick={() => { setStatusFilter('pending_review'); setMembersPage(1); }} className="flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors">View all <ArrowRight size={12} /></button>
                </div>
                {approvalQueue.length === 0 ? (
                  <div className="px-4 py-8 text-center"><p className="text-[12.5px] text-gray-400">No pending contributions.</p></div>
                ) : (
                  <div>
                    {queueVisible.map(m => (
                      <div key={m.member_id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0">
                        {m.member_picture
                          ? <img src={m.member_picture} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-700 text-[11px] font-bold shrink-0">{initials(m.member_name)}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-gray-900 truncate">{m.member_name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{m.department_name || m.role_name || 'Member'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[12px] font-semibold text-gray-700">{m.pending_hours.toFixed(1)} hrs</p>
                          <p className="text-[11px] text-gray-400">{fmtActivityDate(m.last_activity)}</p>
                        </div>
                        <button onClick={() => openMemberDetail(m)} className="shrink-0 border border-gray-200 text-gray-700 hover:bg-gray-50 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors">Review</button>
                      </div>
                    ))}
                    {queueMore > 0 && !queueExpanded && (
                      <button onClick={() => setQueueExpanded(true)} className="w-full py-2.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors border-t border-gray-50">
                        Show {queueMore} more ↓
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contribution by Department */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-bold text-gray-900">Contribution by Department</p>
                  <select value={deptPeriod} onChange={e => handleDeptPeriodChange(e.target.value as 'month' | 'all_time')} className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none cursor-pointer">
                    <option value="month">This Month</option>
                    <option value="all_time">All Time</option>
                  </select>
                </div>
                {deptData.length === 0 ? (
                  <p className="text-[12.5px] text-gray-400 text-center py-6">No approved hours yet.</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <PieChart width={100} height={100}>
                        <Pie data={deptData} cx={46} cy={46} innerRadius={28} outerRadius={46} dataKey="hours" strokeWidth={0}>
                          {deptData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {deptData.map((d, i) => (
                        <div key={d.department} className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            <span className="text-[11.5px] text-gray-600 truncate">{d.department}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">{d.pct}% ({d.hours}h)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-bold text-gray-900">Recent Activity</p>
                  <button onClick={() => setActivityExpanded(v => !v)} className="flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors">View all <ArrowRight size={12} /></button>
                </div>
                {activity.length === 0 ? (
                  <div className="px-4 py-8 text-center"><p className="text-[12.5px] text-gray-400">No activity yet.</p></div>
                ) : (
                  <div>
                    {activityVisible.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-2 border-b border-gray-50 last:border-0">
                        {a.member_picture
                          ? <img src={a.member_picture} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0 mt-0.5" />
                          : <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 text-[10px] font-bold shrink-0 mt-0.5">{initials(a.member_name)}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-gray-700 leading-snug">
                            <span className="font-semibold">{a.member_name}</span> {a.action}{a.hours ? ` ${a.hours} hr${a.hours !== 1 ? 's' : ''}` : ''} for &ldquo;{a.title}&rdquo;
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">{a.time_ago}</span>
                      </div>
                    ))}
                    {!activityExpanded && activity.length > 4 && (
                      <button onClick={() => setActivityExpanded(true)} className="w-full py-2.5 text-[12px] font-semibold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors border-t border-gray-50">
                        View all activity <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contribution Settings Modal */}
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
              <div className="bg-white rounded-2xl shadow-xl w-[400px] mx-4 mt-[15vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <p className="text-[14px] font-bold text-gray-900">Contribution Settings</p>
                  <button onClick={() => setShowSettings(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><X size={15} /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  {[
                    { label: 'Enable contribution logging', sub: 'Allow members to submit contributions', value: settingsContribEnabled, set: setSettingsContribEnabled },
                    { label: 'Require evidence', sub: 'Members must attach a file to submit', value: settingsRequireEvidence, set: setSettingsRequireEvidence },
                  ].map(({ label, sub, value, set }) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-900">{label}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">{sub}</p>
                      </div>
                      <button onClick={() => set(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-gray-900' : 'bg-gray-200'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 px-6 pb-6">
                  <button onClick={() => setShowSettings(false)} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                  <button onClick={saveSettings} disabled={settingsSaving} className="flex-1 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60 rounded-xl transition-colors">{settingsSaving ? 'Saving…' : 'Save Settings'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Member detail view ────────────────────────────────────────────────────
    const filteredDetail = memberContribs.filter(c => {
      if (detailStatus !== 'all' && c.status !== detailStatus) return false;
      if (detailSearch && !c.title.toLowerCase().includes(detailSearch.toLowerCase())) return false;
      if (detailDatePreset !== 'all') {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const cDate = new Date(c.date);
        if (detailDatePreset === 'this_week') {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
          if (cDate < weekStart) return false;
        } else if (detailDatePreset === 'this_month') {
          const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
          if (cDate < mStart) return false;
        } else if (detailDatePreset === 'custom') {
          if (detailDateFrom && cDate < new Date(detailDateFrom)) return false;
          if (detailDateTo) { const to = new Date(detailDateTo); to.setHours(23,59,59,999); if (cDate > to) return false; }
        }
      }
      return true;
    });
    const pendingIds = memberContribs.filter(c => c.status === 'pending').map(c => c.id);

    const detailCounts = {
      all:      memberContribs.length,
      pending:  memberContribs.filter(c => c.status === 'pending').length,
      approved: memberContribs.filter(c => c.status === 'approved').length,
      rejected: memberContribs.filter(c => c.status === 'rejected').length,
    };
    const allPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.has(id));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setAdminView('dashboard'); setSelectedMember(null); setMemberContribs([]); }}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft size={14} /> Back to Dashboard
          </button>
        </div>

        {selectedMember && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
            {selectedMember.member_picture
              ? <img src={selectedMember.member_picture} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
              : <div className="w-11 h-11 rounded-xl bg-gray-200 flex items-center justify-center text-gray-700 text-[13px] font-bold shrink-0">{initials(selectedMember.member_name)}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">{selectedMember.member_name}</p>
              <p className="text-[12px] text-gray-400">{selectedMember.email || selectedMember.role_name || 'Member'}</p>
            </div>
            <div className="flex items-center gap-6 text-center">
              {[
                { label: 'Total',       value: selectedMember.total },
                { label: 'Approved Hrs', value: selectedMember.approved_hours.toFixed(1) },
                { label: 'Pending',     value: selectedMember.pending },
              ].map(stat => (
                <div key={stat.label}>
                  <p className="text-[18px] font-bold text-gray-900">{stat.value}</p>
                  <p className="text-[10.5px] text-gray-400 font-semibold uppercase tracking-wide">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
            <div className="flex gap-0">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
                <button key={tab} onClick={() => setDetailStatus(tab)} className={`px-1 mr-4 pb-2.5 pt-2.5 text-[12px] font-semibold border-b-2 -mb-px capitalize transition-colors ${detailStatus === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab === 'all' ? 'All' : STATUS_LABEL[tab]} ({detailCounts[tab]})
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedIds.size > 0 && (
                <>
                  <button onClick={() => doBulkAction('approve')} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60 rounded-lg transition-colors"><CheckCircle2 size={12} />{bulkLoading ? 'Approving…' : `Approve (${selectedIds.size})`}</button>
                  <button onClick={() => doBulkAction('reject')} disabled={bulkLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-60 border border-gray-200 rounded-lg transition-colors"><AlertCircle size={12} /> Reject ({selectedIds.size})</button>
                </>
              )}
              {pendingIds.length > 0 && selectedIds.size === 0 && (
                <button onClick={() => setSelectedIds(new Set(pendingIds))} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors">Select all pending</button>
              )}
              {selectedIds.size > 0 && <button onClick={() => setSelectedIds(new Set())} className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">Clear</button>}
              {/* Date filter */}
              <select
                value={detailDatePreset}
                onChange={e => { setDetailDatePreset(e.target.value as typeof detailDatePreset); setDetailDateFrom(''); setDetailDateTo(''); }}
                className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
              {detailDatePreset === 'custom' && (
                <>
                  <input type="date" value={detailDateFrom} onChange={e => setDetailDateFrom(e.target.value)} className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer w-36" />
                  <span className="text-[11px] text-gray-400">to</span>
                  <input type="date" value={detailDateTo} onChange={e => setDetailDateTo(e.target.value)} min={detailDateFrom} className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer w-36" />
                </>
              )}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={detailSearch} onChange={e => setDetailSearch(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 w-40" />
              </div>
            </div>
          </div>

          {pendingIds.length > 1 && detailStatus !== 'approved' && detailStatus !== 'rejected' && (
            <div className="flex items-center gap-2 px-5 py-2 bg-gray-50/60 border-b border-gray-100">
              <input type="checkbox" checked={allPendingSelected} onChange={e => setSelectedIds(e.target.checked ? new Set(pendingIds) : new Set())} className="w-3.5 h-3.5 rounded accent-gray-900 cursor-pointer" />
              <span className="text-[11.5px] text-gray-500">Select all {pendingIds.length} pending</span>
            </div>
          )}

          {memberLoading ? (
            <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : filteredDetail.length === 0 ? (
            <div className="py-16 text-center"><p className="text-[13px] text-gray-400">No contributions found.</p></div>
          ) : (
            <div className="divide-y divide-gray-50 p-4 space-y-2">
              {filteredDetail.map(c => (
                <div key={c.id} className="flex items-start gap-3 pt-2 first:pt-0">
                  {c.status === 'pending' ? (
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={e => { const next = new Set(selectedIds); e.target.checked ? next.add(c.id) : next.delete(c.id); setSelectedIds(next); }} className="mt-3.5 w-3.5 h-3.5 rounded accent-gray-900 cursor-pointer shrink-0" />
                  ) : <div className="w-3.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <AdminReviewRow c={c} onReviewed={updateMemberContrib} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Member view — helpers ───────────────────────────────────────────────────
  const s = summary;

  // All Logs filtering + pagination
  const logsFiltered = contributions.filter(c => {
    if (logsStatus !== 'all' && c.status !== logsStatus) return false;
    if (logsSearch) {
      const q = logsSearch.toLowerCase();
      if (!c.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const logsTotalPages = Math.max(1, Math.ceil(logsFiltered.length / PAGE_SIZE));
  const logsSafePage   = Math.min(logsPage, logsTotalPages);
  const logsPaginated  = logsFiltered.slice((logsSafePage - 1) * PAGE_SIZE, logsSafePage * PAGE_SIZE);

  const STATUS_COUNTS = {
    all:      contributions.length,
    pending:  contributions.filter(c => c.status === 'pending').length,
    approved: contributions.filter(c => c.status === 'approved').length,
    rejected: contributions.filter(c => c.status === 'rejected').length,
  };

  // Insights data
  const donutData = insights?.by_category ?? [];
  const donutTotal = donutData.reduce((acc, d) => acc + d.hours, 0);
  const trendData = (() => {
    const raw = insights?.daily_trend ?? [];
    if (insightPeriod === 'week') return raw.slice(-7);
    return raw;
  })();

  // Drag-and-drop handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setQDragOver(true); };
  const onDragLeave = () => setQDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setQDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setQFile(f);
  };

  // Pagination page buttons
  const pageButtons = Array.from({ length: logsTotalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === logsTotalPages || Math.abs(n - logsSafePage) <= 1)
    .reduce<(number | '…')[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);

  // ── Member view — JSX ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-[16px] font-bold text-gray-900">Report Contributions</h1>
          <PageHelp title="How Contributions Work" sections={MEMBER_CONTRIBUTIONS_HELP} />
        </div>
        <p className="text-[12px] text-gray-500 mt-0.5">Track your impact and log your work</p>
      </div>

      {/* Main body — dashboard or all-logs */}
      {view === 'dashboard' ? (
        <div className="grid grid-cols-3 gap-4 items-start">
          {/* Left — Log a Contribution */}
          <div className="col-span-2 bg-white border border-gray-200 rounded-xl">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <p className="text-[13px] font-bold text-gray-900">Log a Contribution</p>
              <button
                onClick={() => setView('all_logs')}
                className="flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                View All Logs <ArrowRight size={13} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 px-5 border-b border-gray-100">
              {(['quick', 'detailed'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLogTab(tab)}
                  className={`px-1 mr-4 pb-2.5 pt-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors ${
                    logTab === tab
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'quick' ? 'Quick Log' : 'Detailed Log'}
                </button>
              ))}
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-3.5">
              {submitError && (
                <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {submitError}
                </p>
              )}

              {/* Title */}
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">
                  What did you work on? <span className="text-red-400">*</span>
                </label>
                <input
                  value={qTitle}
                  onChange={e => setQTitle(e.target.value)}
                  placeholder="e.g. Created user research for onboarding flow"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-colors"
                />
              </div>

              {/* Type / Date / Hours row */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Type <span className="text-red-400">*</span></label>
                  <select
                    value={qType}
                    onChange={e => setQType(e.target.value as ContributionType)}
                    className="w-full h-[38px] px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white cursor-pointer"
                  >
                    <option value="hours">Hours</option>
                    <option value="task">Task</option>
                    <option value="deliverable">Deliverable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Date <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={qDate}
                      onChange={e => setQDate(e.target.value)}
                      className="w-full h-[38px] pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Hours <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={qHours}
                    onChange={e => setQHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    disabled={qType !== 'hours'}
                    className="w-full h-[38px] px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              {/* Category (Detailed Log only) */}
              {logTab === 'detailed' && (
                <>
                  {/* Category + Impact row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Category <span className="text-red-400">*</span></label>
                      <select
                        value={dCategory}
                        onChange={e => setDCategory(e.target.value as ContributionCategory)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white cursor-pointer"
                      >
                        <option value="project_work">Project Work</option>
                        <option value="meetings">Meetings</option>
                        <option value="learning">Learning</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Impact Level</label>
                      <select
                        value={dImpact}
                        onChange={e => setDImpact(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white cursor-pointer"
                      >
                        <option value="">Select impact…</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  {/* Project Name */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Project / Initiative</label>
                    <input
                      value={dProjectName}
                      onChange={e => setDProjectName(e.target.value)}
                      placeholder="e.g. Onboarding Redesign, Content & Copy…"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                    />
                  </div>

                  {/* Collaborators */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Collaborators</label>
                    <input
                      value={dCollaborators}
                      onChange={e => setDCollaborators(e.target.value)}
                      placeholder="e.g. Alice Johnson, Bob Smith…"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                    />
                  </div>

                  {/* Deliverable URL */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Deliverable Link (optional)</label>
                    <input
                      type="url"
                      value={dDeliverableUrl}
                      onChange={e => setDDeliverableUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </>
              )}

              {/* Description */}
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Description (optional)</label>
                <textarea
                  value={qDesc}
                  onChange={e => setQDesc(e.target.value)}
                  rows={3}
                  placeholder="Add more context about your work..."
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none"
                />
              </div>

              {/* Evidence drag-and-drop */}
              <div>
                <label className="block text-[11.5px] font-semibold text-gray-600 mb-1">Evidence (optional)</label>
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    qDragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => setQFile(e.target.files?.[0] ?? null)}
                  />
                  <Upload size={20} className="text-gray-400" />
                  {qFile ? (
                    <p className="text-[12.5px] text-gray-700 font-medium">{qFile.name}</p>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-gray-600">
                        Drag &amp; drop files here or{' '}
                        <span className="underline font-medium">browse</span>
                      </p>
                      <p className="text-[11px] text-gray-400">PDF, DOC, XLS, PNG, JPG • up to 25 MB</p>
                    </>
                  )}
                </div>
                {qFile && (
                  <button
                    onClick={() => { setQFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-[11.5px] text-gray-400 hover:text-gray-600 mt-1"
                  >
                    Remove file
                  </button>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={() => { if (!qTitle.trim()) { setSubmitError('Title is required.'); return; } setSubmitError(''); setShowConfirm(true); }}
                disabled={submitting}
                className="w-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 rounded-xl py-2.5 text-[13px] font-semibold transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Contribution'}
              </button>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Recent Contributions */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-[13px] font-bold text-gray-900">Recent Contributions</p>
                <button
                  onClick={() => setView('all_logs')}
                  className="flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  View all <ArrowRight size={12} />
                </button>
              </div>

              {contributions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[12.5px] text-gray-400">No contributions yet.</p>
                </div>
              ) : (
                <div>
                  {/* Table header */}
                  <div className="grid grid-cols-[minmax(0,1fr)_56px_40px_72px_76px] gap-2 px-4 py-2 border-b border-gray-50">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Description</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Type</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hours</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Date</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                  </div>
                  {contributions.slice(0, 5).map(c => (
                    <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_56px_40px_72px_76px] gap-2 px-4 py-2 border-b border-gray-50 last:border-0 items-center">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-gray-900 truncate">{c.title}</p>
                        <p className="text-[10.5px] text-gray-400 truncate">
                          {c.project_name || CAT_LABEL[c.category] || c.category}
                        </p>
                      </div>
                      <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 whitespace-nowrap">
                        {TYPE_LABEL[c.contribution_type]}
                      </span>
                      <span className="text-[12px] text-gray-600 whitespace-nowrap">{c.hours ?? '—'}</span>
                      <span className="text-[11.5px] text-gray-500 whitespace-nowrap">{fmtShortDate(c.date)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
                        <span className="text-[11.5px] text-gray-600 whitespace-nowrap">{STATUS_LABEL[c.status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contribution Insights */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-[13px] font-bold text-gray-900">Contribution Insights</p>
                <select
                  value={insightPeriod}
                  onChange={e => setInsightPeriod(e.target.value as 'month' | 'week')}
                  className="text-[11.5px] text-gray-600 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 bg-white cursor-pointer"
                >
                  <option value="month">This Month</option>
                  <option value="week">Last 7 Days</option>
                </select>
              </div>

              <div className="p-4 space-y-4">
                {/* Hours by Type */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-2">Hours by Type</p>
                  <div className="flex items-center gap-3">
                    {/* Donut */}
                    <div className="relative shrink-0">
                      <PieChart width={88} height={88}>
                        <Pie
                          data={donutData.length > 0 && donutTotal > 0 ? donutData : [{ label: 'Empty', hours: 1, category: 'other', count: 0 }]}
                          cx={40} cy={40}
                          innerRadius={24} outerRadius={40}
                          dataKey="hours"
                          strokeWidth={0}
                        >
                          {donutData.length > 0 && donutTotal > 0
                            ? donutData.map((_, i) => (
                                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                              ))
                            : <Cell fill="#e5e7eb" />
                          }
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[11px] font-bold text-gray-900">{donutTotal.toFixed(1)}</span>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="space-y-1 flex-1 min-w-0">
                      {donutData.map((d, i) => {
                        const pct = donutTotal > 0 ? Math.round(d.hours / donutTotal * 100) : 0;
                        return (
                          <div key={d.category} className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                              />
                              <span className="text-[11px] text-gray-600 truncate">{d.label}</span>
                            </div>
                            <span className="text-[11px] text-gray-400 shrink-0">{d.hours.toFixed(1)} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Daily Trend */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-2">Daily Trend (Hours)</p>
                  <ResponsiveContainer width="100%" height={90}>
                    <LineChart data={trendData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={v => fmtShortDate(v)}
                        interval={insightPeriod === 'week' ? 1 : 4}
                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickCount={3}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(v: number) => [`${v}h`, 'Hours']}
                        labelFormatter={fmtShortDate}
                      />
                      <Line
                        type="monotone"
                        dataKey="hours"
                        stroke="#111827"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, fill: '#111827' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── All Logs View ─────────────────────────────────────────────────── */
        <div className="bg-white border border-gray-200 rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('dashboard'); setLogsStatus('all'); setLogsSearch(''); setLogsPage(1); }}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <span className="text-gray-200 text-lg">|</span>
              <p className="text-[13px] font-bold text-gray-900">All Logs</p>
            </div>
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={logsSearch}
                onChange={e => { setLogsSearch(e.target.value); setLogsPage(1); }}
                placeholder="Search contributions…"
                className="pl-8 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 w-52"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-0 px-5 border-b border-gray-100">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setLogsStatus(tab); setLogsPage(1); }}
                className={`px-1 mr-4 pb-2.5 pt-2.5 text-[12px] font-semibold border-b-2 -mb-px capitalize transition-colors ${
                  logsStatus === tab
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'all' ? 'All' : STATUS_LABEL[tab as ContributionStatus]} ({STATUS_COUNTS[tab]})
              </button>
            ))}
          </div>

          {/* Table */}
          {logsPaginated.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-gray-400">No contributions found.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[minmax(0,1fr)_80px_60px_110px_120px] gap-3 px-5 py-2.5 border-b border-gray-50 bg-gray-50/50">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Description</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Type</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hours</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Date</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</span>
              </div>
              {logsPaginated.map(c => (
                <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_80px_60px_110px_120px] gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-start transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12.5px] font-semibold text-gray-900 truncate">{c.title}</p>
                      {c.impact_level && (
                        <span className={`shrink-0 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md ${
                          c.impact_level === 'high' ? 'bg-gray-900 text-white' : c.impact_level === 'medium' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'
                        }`}>{c.impact_level.charAt(0).toUpperCase() + c.impact_level.slice(1)}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {c.project_name ? c.project_name : CAT_LABEL[c.category] ?? c.category}
                      {c.project_name && <span className="text-gray-300 mx-1">·</span>}
                      {c.project_name && (CAT_LABEL[c.category] ?? c.category)}
                    </p>
                    {c.collaborators && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">👥 {c.collaborators}</p>
                    )}
                    {c.description && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{c.description}</p>
                    )}
                  </div>
                  <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 whitespace-nowrap mt-0.5">
                    {TYPE_LABEL[c.contribution_type]}
                  </span>
                  <span className="text-[12px] text-gray-600 whitespace-nowrap mt-0.5">{c.hours ?? '—'}</span>
                  <span className="text-[12px] text-gray-500 whitespace-nowrap mt-0.5">{fmtDate(c.date)}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
                    <span className="text-[11.5px] text-gray-600 whitespace-nowrap">{STATUS_LABEL[c.status]}</span>
                    {c.evidence_file_url && (
                      <a href={c.evidence_file_url} target="_blank" rel="noopener noreferrer"
                        className="ml-1 text-gray-400 hover:text-gray-700 transition-colors">
                        <ExternalLink size={11} />
                      </a>
                    )}
                    {c.deliverable_url && (
                      <a href={c.deliverable_url} target="_blank" rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-700 transition-colors" title="View deliverable">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Pagination */}
          {logsTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                {logsFiltered.length} result{logsFiltered.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                  disabled={logsSafePage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                </button>
                {pageButtons.map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-[12px] text-gray-400">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setLogsPage(n as number)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12.5px] font-semibold transition-colors ${
                        n === logsSafePage
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                  disabled={logsSafePage === logsTotalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Submit Dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-4">
                <CheckCircle2 size={18} className="text-white" />
              </div>
              <p className="text-[15px] font-bold text-gray-900">Submit Contribution?</p>
              <p className="text-[12.5px] text-gray-500 mt-1">
                This will send your contribution for review. Once submitted, it cannot be edited.
              </p>
            </div>

            {/* Preview */}
            <div className="mx-6 mb-4 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-semibold text-gray-900 leading-snug">{qTitle}</p>
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 shrink-0 whitespace-nowrap">
                  {qType === 'hours' ? 'Hours' : qType === 'task' ? 'Task' : 'Deliverable'}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-gray-500">
                <span>{qDate}</span>
                {qType === 'hours' && qHours && <span>· {qHours}h</span>}
                {logTab === 'detailed' && <span>· {CAT_LABEL[dCategory]}</span>}
                {logTab === 'detailed' && dImpact && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold ${
                    dImpact === 'high' ? 'bg-gray-900 text-white' : dImpact === 'medium' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'
                  }`}>{dImpact.charAt(0).toUpperCase() + dImpact.slice(1)} Impact</span>
                )}
              </div>
              {logTab === 'detailed' && dProjectName && (
                <p className="text-[11.5px] text-gray-600">📁 {dProjectName}</p>
              )}
              {logTab === 'detailed' && dCollaborators && (
                <p className="text-[11.5px] text-gray-500">👥 {dCollaborators}</p>
              )}
              {logTab === 'detailed' && dDeliverableUrl && (
                <p className="text-[11.5px] text-gray-500 truncate">🔗 {dDeliverableUrl}</p>
              )}
              {qDesc && <p className="text-[11.5px] text-gray-400 leading-snug">{qDesc}</p>}
              {qFile && <p className="text-[11.5px] text-gray-400">📎 {qFile.name}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await doSubmit();
                  if (ok) setShowConfirm(false);
                }}
                disabled={submitting}
                className="flex-1 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-60 rounded-xl transition-colors"
              >
                {submitting ? 'Submitting…' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Impact Section */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <Target size={15} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-gray-900">Your contributions help the team move forward.</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">Thank you for your consistent efforts!</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <RefreshCw size={15} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-gray-900">Be consistent</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">Logging regularly helps you and your team stay aligned.</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <Paperclip size={15} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-gray-900">Add evidence</p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">Attach proof of work to strengthen your impact.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
