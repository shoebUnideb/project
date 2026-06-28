import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mail, MessageSquare, Edit2, ChevronDown, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Minus, BookOpen, FileText,
  CalendarCheck, Activity, Award, Shield, User, X, Check,
  TrendingUp, Briefcase, Phone,
} from 'lucide-react';
import {
  orgApi, checkinsApi, contributionsApi, docApi,
  type OrgMember, type OrgMemberProfile, type OnboardingInstance,
  type TrainingEnrollment, type MemberDocument, type CheckIn,
  type Contribution, type MemberAgreementRecord, type InternalRole,
  type Department,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const MEMBER_PROFILE_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Member Profile?',
    bullets: [
      'A **360° view** of one person — their account, work history, and progress across every module.',
      'Use it as the **source of truth** when you need to understand a single member: are they on track, what\'s overdue, what have they delivered.',
      'Everything visible here is **role-aware** — managers see more than peers, admins see everything.',
    ],
  },
  {
    eyebrow: '2 · Read the Tabs',
    bullets: [
      '**Overview** — at-a-glance: profile completion, key details, team, permissions.',
      '**Onboarding** — assigned programs, task progress, completion percentage.',
      '**Training** — enrolled courses, completion status, certificates issued.',
      '**Documents** — uploaded files, signed agreements, missing or expiring docs.',
      '**Check-ins** — attendance log, location/method, exceptions.',
      '**Contributions** — logged hours, approval status, submissions.',
      '**Agreements** — signed NDAs, contracts, policies (with timestamps).',
      '**Activity** — full audit trail for this member.',
    ],
  },
  {
    eyebrow: '3 · Quick Actions',
    bullets: [
      'Use **Email** to compose a message directly to this member.',
      'Use **Message** to start an in-app chat (if messaging is enabled).',
      'Use **Edit** to update name, role, department, status, contact info.',
      'The **Back** button returns to wherever you came from — Directory, Users & Roles, search results.',
    ],
  },
  {
    eyebrow: '4 · Profile Completion',
    bullets: [
      'The **% bar** tells you how filled out this member\'s profile is.',
      'Below 50% — push the member to complete their profile (or fill in missing fields yourself).',
      'Profile fields drive **filters, reports, and personalization** elsewhere — keep them complete.',
    ],
  },
  {
    eyebrow: '5 · Permissions Panel',
    bullets: [
      'Shows **exactly what this member can do** in the platform — Manage Members, Approve Check-ins, Upload Agreements, etc.',
      'Permissions come from their **role**, not the individual user — to change them, edit the role in Users & Roles → Roles tab.',
      'Greyed-out items = denied; ticked items = granted.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'When troubleshooting "why can\'t X do Y?" — open this profile, check the **Permissions** panel and the **Activity** tab. Most access issues are visible at a glance from here.',
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'onboarding' | 'training' | 'documents' | 'checkins' | 'contributions' | 'agreements' | 'activity';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',      label: 'Overview' },
  { key: 'onboarding',    label: 'Onboarding' },
  { key: 'training',      label: 'Training' },
  { key: 'documents',     label: 'Documents' },
  { key: 'checkins',      label: 'Check-ins' },
  { key: 'contributions', label: 'Contributions' },
  { key: 'agreements',    label: 'Agreements' },
  { key: 'activity',      label: 'Activity' },
];

const inputCls  = 'w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60';
const selectCls = 'px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white appearance-none pr-7 cursor-pointer w-full';

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(m: OrgMember | OrgMemberProfile): string {
  const u = m.user;
  return u.display_name || `${u.first_name} ${u.last_name}`.trim() || u.username;
}

function fmt(d: string | null | undefined, style: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', style);
}

function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 'md', square = false }: { src: string | null; name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; square?: boolean }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const cls = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-14 h-14 text-[16px]' : size === 'xl' ? 'w-20 h-20 text-[22px]' : 'w-9 h-9 text-[12px]';
  const radius = square ? 'rounded-xl' : 'rounded-full';
  if (src) return <img src={src} alt={name} className={`${cls} ${radius} object-cover shrink-0`} />;
  return (
    <div className={`${cls} ${radius} bg-gray-200 text-gray-600 font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls = status === 'active' ? 'bg-emerald-500' : status === 'suspended' ? 'bg-red-400' : 'bg-gray-300';
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`} />;
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:    'bg-gray-100 text-gray-700',
    inactive:  'bg-gray-100 text-gray-400',
    suspended: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${cfg[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ProgressBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1' : 'h-1.5';
  return (
    <div className={`${h} bg-gray-100 rounded-full overflow-hidden`}>
      <div className={`${h} bg-gray-800 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <p className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wide">{title}</p>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-2 pt-1">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3 text-gray-400">{icon}</div>
      <p className="text-[13px] font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-[11.5px] text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Edit Member Modal (inline, reused pattern from OrgDirectory) ──────────────

function EditMemberModal({ member, roles, departments, onClose, onSaved }: {
  member: OrgMember;
  roles: InternalRole[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleId,  setRoleId]  = useState(String(member.role.id));
  const [deptId,  setDeptId]  = useState(() => {
    const d = departments.find(d => d.name === member.department_name);
    return d ? String(d.id) : '';
  });
  const [status, setStatus]   = useState(member.status);
  const [saving, setSaving]   = useState(false);
  const [msg,    setMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      await orgApi.updateMember(member.id, {
        role_id:       Number(roleId),
        status,
        department_id: deptId ? Number(deptId) : null,
      });
      setMsg({ ok: true, text: 'Member updated.' });
      setTimeout(onSaved, 600);
    } catch {
      setMsg({ ok: false, text: 'Failed to update. Please try again.' });
    } finally { setSaving(false); }
  };

  const name = displayName(member);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[420px]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-900">Edit Member</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400"><X size={13} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
            <Avatar src={member.user.profile_picture} name={name} size="sm" />
            <div><p className="text-[12.5px] font-semibold text-gray-800">{name}</p><p className="text-[11px] text-gray-400">{member.user.email}</p></div>
          </div>
          {([
            { label: 'Role',       val: roleId, set: setRoleId,    opts: roles.map(r => ({ v: String(r.id), l: r.name })) },
            { label: 'Department', val: deptId, set: setDeptId,    opts: [{ v: '', l: 'No department' }, ...departments.filter(d => d.is_active).map(d => ({ v: String(d.id), l: d.name }))] },
            { label: 'Status',     val: status, set: (v: string) => setStatus(v as typeof status), opts: [{ v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }, { v: 'suspended', l: 'Suspended' }] },
          ] as const).map(({ label, val, set, opts }) => (
            <div key={label}>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
              <div className="relative">
                <select value={val} onChange={e => set(e.target.value)} className={selectCls}>
                  {opts.map((o: { v: string; l: string }) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          ))}
          {msg && <p className={`text-[12px] px-3 py-1.5 rounded-lg border ${msg.ok ? 'text-gray-800 bg-gray-50 border-gray-200' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.ok && <Check size={11} className="inline mr-1" />}{msg.text}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ member, profile }: { member: OrgMember; profile: OrgMemberProfile | null }) {
  if (!profile) return <TabSkeleton />;
  const name = displayName(member);
  const perms = [
    { label: 'Manage Members',       active: member.role.can_manage_members },
    { label: 'View All Contributions', active: member.role.can_view_all_contributions },
    { label: 'Approve Check-ins',    active: member.role.can_approve_checkins },
    { label: 'Upload Agreements',    active: member.role.can_upload_agreements },
  ];

  return (
    <div className="space-y-4">
      {/* Profile completion */}
      <SectionCard title="Profile Completion">
        <div className="flex items-center gap-3">
          <ProgressBar pct={profile.profile_completion_pct} />
          <span className="text-[12px] font-semibold text-gray-700 shrink-0">{profile.profile_completion_pct}%</span>
        </div>
      </SectionCard>

      {/* Details + Team */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Details">
          <div className="space-y-2">
            {[
              { label: 'Email',       value: member.user.email },
              { label: 'Department',  value: member.department_name ?? '—' },
              { label: 'Role',        value: member.role.name },
              { label: 'Joined',      value: fmt(member.joined_date) },
              { label: 'Employee ID', value: member.employee_id || '—' },
              { label: 'Status',      value: member.status.charAt(0).toUpperCase() + member.status.slice(1) },
            ].map(row => (
              <div key={row.label} className="flex justify-between gap-4">
                <span className="text-[11.5px] text-gray-400 shrink-0">{row.label}</span>
                <span className="text-[11.5px] text-gray-700 font-medium text-right truncate">{row.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          {/* Manager + Buddy */}
          {(profile.manager || profile.buddy) && (
            <SectionCard title="Team">
              <div className="space-y-2.5">
                {profile.manager && (
                  <div className="flex items-center gap-2.5">
                    <Avatar src={profile.manager.profile_picture} name={profile.manager.display_name} size="sm" />
                    <div>
                      <p className="text-[12px] font-medium text-gray-800">{profile.manager.display_name}</p>
                      <p className="text-[10.5px] text-gray-400">Manager</p>
                    </div>
                  </div>
                )}
                {profile.buddy && (
                  <div className="flex items-center gap-2.5">
                    <Avatar src={profile.buddy.profile_picture} name={profile.buddy.display_name} size="sm" />
                    <div>
                      <p className="text-[12px] font-medium text-gray-800">{profile.buddy.display_name}</p>
                      <p className="text-[10.5px] text-gray-400">Buddy</p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Emergency contact */}
          {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
            <SectionCard title="Emergency Contact">
              <div className="space-y-1">
                {profile.emergency_contact_name && (
                  <div className="flex items-center gap-2 text-[12px] text-gray-700">
                    <User size={11} className="text-gray-400 shrink-0" />
                    {profile.emergency_contact_name}
                  </div>
                )}
                {profile.emergency_contact_phone && (
                  <div className="flex items-center gap-2 text-[12px] text-gray-700">
                    <Phone size={11} className="text-gray-400 shrink-0" />
                    {profile.emergency_contact_phone}
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <SectionCard title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map(s => (
              <span key={s} className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-md">{s}</span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Role permissions */}
      <SectionCard title="Permissions">
        <div className="grid grid-cols-2 gap-2">
          {perms.map(p => (
            <div key={p.label} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium ${p.active ? 'border-gray-200 text-gray-700 bg-gray-50' : 'border-gray-100 text-gray-300 bg-white'}`}>
              {p.active ? <Check size={11} className="text-gray-600 shrink-0" /> : <Minus size={11} className="text-gray-300 shrink-0" />}
              {p.label}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Notes */}
      {profile.notes && (
        <SectionCard title="Notes">
          <p className="text-[12px] text-gray-600 whitespace-pre-line">{profile.notes}</p>
        </SectionCard>
      )}
    </div>
  );
}

// ── Tab: Onboarding ───────────────────────────────────────────────────────────

function OnboardingTab({ onboardings, loading }: { onboardings: OnboardingInstance[]; loading: boolean }) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  if (loading) return <TabSkeleton />;
  if (!onboardings.length) return <EmptyState icon={<CheckCircle2 size={18} />} title="No onboarding found" subtitle="This member has no onboarding assigned" />;

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle2 size={12} className="text-gray-700 shrink-0" />;
    if (s === 'overdue')   return <AlertCircle size={12} className="text-red-400 shrink-0" />;
    if (s === 'in_progress') return <Clock size={12} className="text-gray-500 shrink-0" />;
    return <Minus size={12} className="text-gray-300 shrink-0" />;
  };

  return (
    <div className="space-y-4">
      {onboardings.map(ob => (
        <div key={ob.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Onboarding header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{ob.template_name ?? 'Custom Onboarding'}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Started {fmt(ob.start_date)} {ob.due_date ? `· Due ${fmt(ob.due_date)}` : ''} {ob.completed_at ? `· Completed ${fmt(ob.completed_at)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[11px] font-semibold text-gray-600">{ob.progress_pct}%</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{ob.status}</span>
              </div>
            </div>
            <div className="mt-2">
              <ProgressBar pct={ob.progress_pct} size="sm" />
            </div>
          </div>

          {/* Tasks */}
          {ob.tasks.length > 0 && (
            <div className="divide-y divide-gray-50">
              {ob.tasks.map(task => {
                const expanded = expandedTasks.has(task.id);
                const hasForm  = task.form_fields.length > 0;
                return (
                  <div key={task.id}>
                    <div
                      className={`flex items-start gap-2.5 px-4 py-2.5 ${hasForm ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={() => hasForm && setExpandedTasks(p => { const s = new Set(p); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s; })}
                    >
                      <div className="mt-0.5 shrink-0">{statusIcon(task.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[12px] font-medium truncate ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{task.title}</p>
                          <span className="text-[10px] text-gray-400 shrink-0">{task.task_type}</span>
                        </div>
                        {task.due_date && <p className="text-[10.5px] text-gray-400 mt-0.5">Due {fmt(task.due_date)}{task.completed_at ? ` · Done ${fmt(task.completed_at)}` : ''}</p>}
                      </div>
                      {hasForm && (
                        <ChevronRight size={12} className={`text-gray-400 shrink-0 transition-transform mt-0.5 ${expanded ? 'rotate-90' : ''}`} />
                      )}
                    </div>
                    {expanded && hasForm && (
                      <div className="px-4 pb-3 space-y-2 bg-gray-50 border-t border-gray-100">
                        {task.form_fields.map(f => (
                          <div key={f.id} className="text-[11.5px]">
                            <span className="text-gray-500 font-medium">{f.question}: </span>
                            <span className="text-gray-800">{f.response || <em className="text-gray-300">No answer</em>}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: Training ─────────────────────────────────────────────────────────────

function TrainingTab({ trainings, loading }: { trainings: TrainingEnrollment[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (loading) return <TabSkeleton />;
  if (!trainings.length) return <EmptyState icon={<BookOpen size={18} />} title="No training assigned" subtitle="This member has not been enrolled in any courses" />;

  const statusColor: Record<string, string> = {
    enrolled:    'bg-gray-100 text-gray-500',
    in_progress: 'bg-gray-100 text-gray-700',
    completed:   'bg-gray-100 text-gray-800',
    failed:      'bg-red-50 text-red-600',
  };

  return (
    <div className="space-y-3">
      {trainings.map(en => {
        const open = expanded.has(en.id);
        return (
          <div key={en.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(p => { const s = new Set(p); s.has(en.id) ? s.delete(en.id) : s.add(en.id); return s; })}
            >
              <BookOpen size={14} className="text-gray-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{en.course.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {en.certificate_issued && <Award size={12} className="text-gray-600" />}
                    {en.score !== null && <span className="text-[11px] font-semibold text-gray-600">{en.score}%</span>}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor[en.status] ?? 'bg-gray-100 text-gray-500'}`}>{en.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1"><ProgressBar pct={en.progress_pct} size="sm" /></div>
                  <span className="text-[11px] text-gray-500 shrink-0">{en.completed_lessons}/{en.total_lessons} lessons</span>
                </div>
                <p className="text-[10.5px] text-gray-400 mt-1">
                  Enrolled {fmt(en.enrolled_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {en.completion_date && ` · Completed ${fmt(en.completion_date)}`}
                </p>
              </div>
              <ChevronRight size={12} className={`text-gray-400 shrink-0 transition-transform mt-1 ${open ? 'rotate-90' : ''}`} />
            </div>

            {open && en.lesson_progress.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2 space-y-1 bg-gray-50">
                {en.course.modules.flatMap(m => m.lessons).map(lesson => {
                  const lp = en.lesson_progress.find(p => p.lesson_id === lesson.id);
                  return (
                    <div key={lesson.id} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-gray-600 truncate">{lesson.title}</span>
                      {lp?.completed
                        ? <span className="text-gray-600 font-medium shrink-0 flex items-center gap-1"><CheckCircle2 size={11} /> {fmt(lp.completed_at)}</span>
                        : <span className="text-gray-300 shrink-0">Not completed</span>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Documents ────────────────────────────────────────────────────────────

function DocumentsTab({ documents, loading }: { documents: MemberDocument[]; loading: boolean }) {
  if (loading) return <TabSkeleton />;
  if (!documents.length) return <EmptyState icon={<FileText size={18} />} title="No documents" subtitle="This member has no documents assigned" />;

  const statusCls: Record<string, string> = {
    assigned:       'bg-gray-100 text-gray-500',
    uploaded:       'bg-gray-100 text-gray-700',
    pending_review: 'bg-amber-50 text-amber-700',
    approved:       'bg-gray-100 text-gray-800',
    rejected:       'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Document', 'Category', 'Status', 'Uploaded', 'Reviewed By', 'Expiry'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map(doc => (
            <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-gray-400 shrink-0" />
                  <p className="text-[12px] font-medium text-gray-800 truncate max-w-[180px]">{doc.template_name ?? doc.title}</p>
                </div>
                {doc.reviewer_note && <p className="text-[10.5px] text-gray-400 mt-0.5 pl-5 truncate max-w-[180px]">{doc.reviewer_note}</p>}
              </td>
              <td className="px-3 py-2.5 text-[11.5px] text-gray-500 capitalize">{doc.category}</td>
              <td className="px-3 py-2.5">
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${statusCls[doc.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {doc.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[11px] text-gray-400">{fmt(doc.uploaded_at)}</td>
              <td className="px-3 py-2.5 text-[11.5px] text-gray-500">{doc.reviewed_by_name ?? '—'}</td>
              <td className="px-3 py-2.5 text-[11px] text-gray-400">{fmt(doc.expiration_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Check-ins ────────────────────────────────────────────────────────────

function CheckinsTab({ checkins, loading, onReviewed }: { checkins: CheckIn[]; loading: boolean; onReviewed: () => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [reviewing, setReviewing] = useState<number | null>(null);

  if (loading) return <TabSkeleton />;
  if (!checkins.length) return <EmptyState icon={<CalendarCheck size={18} />} title="No check-ins" subtitle="This member has not submitted any check-ins" />;

  const handleApprove = async (id: number) => {
    setReviewing(id);
    try { await checkinsApi.reviewCheckin(id); onReviewed(); }
    catch { /* ignore */ }
    finally { setReviewing(null); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Period', 'Type', 'Submitted', 'Reviewed By', ''].map((h, i) => (
              <th key={i} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {checkins.map(ci => {
            const open = expanded.has(ci.id);
            const hasResponses = Object.keys(ci.responses ?? {}).length > 0;
            return (
              <>
                <tr
                  key={ci.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => hasResponses && setExpanded(p => { const s = new Set(p); s.has(ci.id) ? s.delete(ci.id) : s.add(ci.id); return s; })}
                >
                  <td className="px-3 py-2.5 text-[12px] text-gray-800">{fmt(ci.period_start)} – {fmt(ci.period_end)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{ci.period_type}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-gray-500">{fmt(ci.submitted_at)}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-gray-500">{ci.reviewed_by_name ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    {!ci.reviewed_at ? (
                      <button
                        onClick={() => handleApprove(ci.id)}
                        disabled={reviewing === ci.id}
                        className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {reviewing === ci.id ? '…' : 'Approve'}
                      </button>
                    ) : (
                      <span className="text-[10.5px] text-gray-400 flex items-center justify-end gap-1"><CheckCircle2 size={10} />Reviewed</span>
                    )}
                  </td>
                </tr>
                {open && hasResponses && (
                  <tr key={`${ci.id}-r`} className="bg-gray-50 border-b border-gray-100">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="space-y-1.5">
                        {Object.entries(ci.responses).map(([q, a]) => (
                          <div key={q} className="text-[11.5px]">
                            <span className="text-gray-500 font-medium">{q}: </span>
                            <span className="text-gray-800">{a}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Contributions ────────────────────────────────────────────────────────

function ContributionsTab({ contributions, loading, onReviewed }: { contributions: Contribution[]; loading: boolean; onReviewed: () => void }) {
  const [acting, setActing] = useState<number | null>(null);

  if (loading) return <TabSkeleton />;
  if (!contributions.length) return <EmptyState icon={<Activity size={18} />} title="No contributions" subtitle="This member has not logged any contributions" />;

  const totalHours = contributions.filter(c => c.status === 'approved' && c.hours).reduce((s, c) => s + parseFloat(c.hours!), 0);
  const pending    = contributions.filter(c => c.status === 'pending').length;
  const approved   = contributions.filter(c => c.status === 'approved').length;

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    setActing(id);
    try { await contributionsApi.reviewContribution(id, action); onReviewed(); }
    catch { /* ignore */ }
    finally { setActing(null); }
  };

  const statusCls: Record<string, string> = {
    pending:  'bg-amber-50 text-amber-700',
    approved: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-50 text-red-600',
  };

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Approved Hours', value: totalHours.toFixed(1) },
          { label: 'Approved',       value: approved },
          { label: 'Pending Review', value: pending },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
            <p className="text-[20px] font-bold text-gray-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Title', 'Type', 'Hours', 'Date', 'Status', 'Approved By', ''].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contributions.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800 truncate max-w-[160px]">{c.title}</td>
                <td className="px-3 py-2.5 text-[11.5px] text-gray-500 capitalize">{c.contribution_type}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{c.hours ?? '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-gray-400">{fmt(c.date)}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${statusCls[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                </td>
                <td className="px-3 py-2.5 text-[11.5px] text-gray-500">{c.approved_by_name ?? '—'}</td>
                <td className="px-3 py-2.5">
                  {c.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleAction(c.id, 'approve')} disabled={acting === c.id} className="px-2 py-1 text-[11px] font-semibold text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">Approve</button>
                      <button onClick={() => handleAction(c.id, 'reject')}  disabled={acting === c.id} className="px-2 py-1 text-[11px] font-semibold text-red-600 border border-red-100 rounded-md hover:bg-red-50 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Agreements ───────────────────────────────────────────────────────────

function AgreementsTab({ agreements, loading }: { agreements: MemberAgreementRecord[]; loading: boolean }) {
  if (loading) return <TabSkeleton />;
  if (!agreements.length) return <EmptyState icon={<FileText size={18} />} title="No agreements" subtitle="No agreements exist in the portal yet" />;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {['Agreement', 'Portal Status', 'Signed?', 'Signed Date'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agreements.map(a => (
            <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-2.5">
                <p className="text-[12px] font-medium text-gray-800">{a.title}</p>
              </td>
              <td className="px-3 py-2.5">
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'}`}>
                  {a.status}
                </span>
              </td>
              <td className="px-3 py-2.5">
                {a.signed
                  ? <span className="flex items-center gap-1 text-[11.5px] text-gray-700 font-medium"><CheckCircle2 size={12} className="text-gray-700" />Signed</span>
                  : <span className="text-[11.5px] text-gray-300">—</span>
                }
              </td>
              <td className="px-3 py-2.5 text-[11px] text-gray-400">{fmt(a.signed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab: Activity ─────────────────────────────────────────────────────────────

interface TimelineEntry {
  date: string;
  icon: React.ReactNode;
  text: string;
  type: string;
}

function ActivityTab({
  onboardings, trainings, documents, checkins, contributions, agreements,
  loaded,
}: {
  onboardings: OnboardingInstance[];
  trainings: TrainingEnrollment[];
  documents: MemberDocument[];
  checkins: CheckIn[];
  contributions: Contribution[];
  agreements: MemberAgreementRecord[];
  loaded: Set<TabKey>;
}) {
  const missingTabs: TabKey[] = (['onboarding', 'training', 'documents', 'checkins', 'contributions', 'agreements'] as TabKey[])
    .filter(t => !loaded.has(t));

  const timeline = useMemo<TimelineEntry[]>(() => {
    const events: TimelineEntry[] = [];
    onboardings.flatMap(o => o.tasks).filter(t => t.completed_at).forEach(t =>
      events.push({ date: t.completed_at!, icon: <CheckCircle2 size={13} />, text: `Completed task: ${t.title}`, type: 'task' }));
    trainings.forEach(e => {
      events.push({ date: e.enrolled_at, icon: <BookOpen size={13} />, text: `Enrolled in: ${e.course.title}`, type: 'training' });
      if (e.completion_date) events.push({ date: e.completion_date, icon: <Award size={13} />, text: `Completed training: ${e.course.title}`, type: 'training' });
    });
    documents.filter(d => d.uploaded_at).forEach(d =>
      events.push({ date: d.uploaded_at, icon: <FileText size={13} />, text: `Uploaded document: ${d.template_name ?? d.title}`, type: 'document' }));
    checkins.forEach(c =>
      events.push({ date: c.submitted_at, icon: <CalendarCheck size={13} />, text: `Submitted ${c.period_type} check-in (${fmt(c.period_start)} – ${fmt(c.period_end)})`, type: 'checkin' }));
    contributions.forEach(c =>
      events.push({ date: c.created_at, icon: <Activity size={13} />, text: `Logged contribution: ${c.title}`, type: 'contribution' }));
    agreements.filter(a => a.signed_at).forEach(a =>
      events.push({ date: a.signed_at!, icon: <FileText size={13} />, text: `Signed agreement: ${a.title}`, type: 'agreement' }));
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [onboardings, trainings, documents, checkins, contributions, agreements]);

  if (missingTabs.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <TrendingUp size={20} className="text-gray-300 mb-3" />
        <p className="text-[13px] font-semibold text-gray-700">Visit all tabs to load activity</p>
        <p className="text-[11.5px] text-gray-400 mt-1">
          Still loading data from: {missingTabs.join(', ')}
        </p>
      </div>
    );
  }

  if (!timeline.length) return <EmptyState icon={<Activity size={18} />} title="No activity yet" subtitle="No recorded activity for this member" />;

  return (
    <div className="space-y-0">
      {timeline.map((entry, i) => (
        <div key={i} className="flex gap-3 pb-4 relative">
          {i < timeline.length - 1 && (
            <div className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-100" />
          )}
          <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0 z-10">
            {entry.icon}
          </div>
          <div className="pt-0.5 min-w-0">
            <p className="text-[12px] text-gray-800">{entry.text}</p>
            <p className="text-[10.5px] text-gray-400 mt-0.5">{fmtRelative(entry.date)} · {fmt(entry.date)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgMemberFingerprint() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate     = useNavigate();
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [member,        setMember]        = useState<OrgMember | null>(null);
  const [profile,       setProfile]       = useState<OrgMemberProfile | null>(null);
  const [roles,         setRoles]         = useState<InternalRole[]>([]);
  const [departments,   setDepartments]   = useState<Department[]>([]);
  const [loadingCore,   setLoadingCore]   = useState(true);

  const [onboardings,   setOnboardings]   = useState<OnboardingInstance[]>([]);
  const [trainings,     setTrainings]     = useState<TrainingEnrollment[]>([]);
  const [documents,     setDocuments]     = useState<MemberDocument[]>([]);
  const [checkins,      setCheckins]      = useState<CheckIn[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [agreements,    setAgreements]    = useState<MemberAgreementRecord[]>([]);
  const [tabLoading,    setTabLoading]    = useState<TabKey | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loaded,    setLoaded]    = useState<Set<TabKey>>(new Set<TabKey>(['overview']));
  const [showEdit,  setShowEdit]  = useState(false);

  const id = Number(memberId);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/org/dashboard', { replace: true });
  }, [isAdmin]);

  // Load core member data on mount
  useEffect(() => {
    if (!id) return;
    setLoadingCore(true);
    Promise.all([
      orgApi.getMembers(),
      orgApi.getMemberProfile(id),
      orgApi.getRoles().catch(() => [] as InternalRole[]),
      orgApi.getDepartments().catch(() => [] as Department[]),
    ]).then(([members, prof, rls, depts]) => {
      const m = members.find(m => m.id === id) ?? null;
      setMember(m);
      setProfile(prof);
      setRoles(rls);
      setDepartments(depts);
    }).catch(() => {}).finally(() => setLoadingCore(false));
  }, [id]);

  // Lazy-load tabs
  const fetchTab = async (tab: TabKey) => {
    if (loaded.has(tab) || !id || !member) return;
    setTabLoading(tab);
    try {
      switch (tab) {
        case 'onboarding': {
          const res = await orgApi.getOnboardings({ user_id: member.user.id });
          setOnboardings(res);
          break;
        }
        case 'training': {
          const res = await orgApi.getMemberTraining(id);
          setTrainings(res);
          break;
        }
        case 'documents': {
          const res = await docApi.getDocuments({ user_id: member.user.id });
          setDocuments(res);
          break;
        }
        case 'checkins': {
          const res = await checkinsApi.getCheckins({ member_id: id });
          setCheckins(res);
          break;
        }
        case 'contributions': {
          const res = await contributionsApi.getContributions({ member_id: id });
          setContributions(res);
          break;
        }
        case 'agreements': {
          const res = await orgApi.getMemberAgreements(id);
          setAgreements(res);
          break;
        }
        default: break;
      }
      setLoaded(prev => new Set(prev).add(tab));
    } catch { /* ignore */ }
    finally { setTabLoading(null); }
  };

  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab);
    fetchTab(tab);
  };

  const reloadTab = (tab: TabKey) => {
    setLoaded(prev => { const s = new Set(prev); s.delete(tab); return s; });
    setTimeout(() => fetchTab(tab), 0);
  };

  if (loadingCore) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-gray-100 rounded w-24 animate-pulse" />
        <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <User size={28} className="text-gray-300 mb-3" />
        <p className="text-[14px] font-semibold text-gray-700">Member not found</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-[12.5px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">← Go back</button>
      </div>
    );
  }

  const name = displayName(member);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[11.5px]" aria-label="Breadcrumb">
        <button
          onClick={() => navigate('/org/members')}
          className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Users & Roles
        </button>
        <ChevronRight size={11} className="text-gray-300" />
        <button
          onClick={() => navigate('/org/directory')}
          className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          People Fingerprint
        </button>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="font-semibold text-gray-900 truncate max-w-[220px]">{name}</span>
      </nav>

      {/* Identity card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="h-16 bg-gray-100" />
        <div className="px-5 -mt-8 pb-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-3">
              <div className="relative w-fit">
                <Avatar src={member.user.profile_picture} name={name} size="xl" square />
                <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                  member.status === 'active' ? 'bg-emerald-500' : member.status === 'suspended' ? 'bg-red-400' : 'bg-gray-300'
                }`} />
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{name}</h1>
                  <PageHelp title="How Member Profiles Work" sections={MEMBER_PROFILE_HELP} />
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-[12px] text-gray-500">{member.role.name}</span>
                  {member.department_name && <>
                    <span className="text-gray-300">·</span>
                    <span className="text-[12px] text-gray-500">{member.department_name}</span>
                  </>}
                  <span className="text-gray-300">·</span>
                  <StatusDot status={member.status} />
                  <StatusPill status={member.status} />
                </div>
                <p className="text-[11.5px] text-gray-400 mt-1">
                  Joined {fmt(member.joined_date)}
                  {member.employee_id && ` · ID: ${member.employee_id}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <a
                href={`mailto:${member.user.email}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <Mail size={12} /> Email
              </a>
              <button
                onClick={() => navigate(`/org/chat?dm=${member.user.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <MessageSquare size={12} /> Message
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Edit2 size={12} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabClick(t.key)}
            className={[
              'shrink-0 px-4 py-2.5 text-[12.5px] font-semibold border-b-2 transition-colors whitespace-nowrap',
              activeTab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700',
            ].join(' ')}
          >
            {t.label}
            {tabLoading === t.key && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-8">
        {activeTab === 'overview' && (
          <OverviewTab member={member} profile={profile} />
        )}
        {activeTab === 'onboarding' && (
          <OnboardingTab onboardings={onboardings} loading={tabLoading === 'onboarding'} />
        )}
        {activeTab === 'training' && (
          <TrainingTab trainings={trainings} loading={tabLoading === 'training'} />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab documents={documents} loading={tabLoading === 'documents'} />
        )}
        {activeTab === 'checkins' && (
          <CheckinsTab
            checkins={checkins}
            loading={tabLoading === 'checkins'}
            onReviewed={() => reloadTab('checkins')}
          />
        )}
        {activeTab === 'contributions' && (
          <ContributionsTab
            contributions={contributions}
            loading={tabLoading === 'contributions'}
            onReviewed={() => reloadTab('contributions')}
          />
        )}
        {activeTab === 'agreements' && (
          <AgreementsTab agreements={agreements} loading={tabLoading === 'agreements'} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab
            onboardings={onboardings}
            trainings={trainings}
            documents={documents}
            checkins={checkins}
            contributions={contributions}
            agreements={agreements}
            loaded={loaded}
          />
        )}
      </div>

      {/* Edit member modal */}
      {showEdit && isAdmin && (
        <EditMemberModal
          member={member}
          roles={roles}
          departments={departments}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            // Reload core member data
            orgApi.getMembers().then(members => {
              const m = members.find(m => m.id === id) ?? null;
              setMember(m);
            }).catch(() => {});
            orgApi.getMemberProfile(id).then(setProfile).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
