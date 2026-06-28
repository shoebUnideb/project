import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, X, ChevronDown, ChevronRight,
  Building2, User, Phone, Briefcase, Tag,
  Shield, UserCheck, UserX, UserCog, Settings,
  MoreHorizontal, Check, Minus, Filter,
  Download, Upload, Clock, AlertCircle, CheckCircle,
  FileText, Activity, Fingerprint, Building,
} from 'lucide-react';
import { useOrg } from '../context/OrgContext';
import {
  orgApi, membersStatsApi, accessRequestsApi, auditApi,
  type OrgMember, type OrgMemberProfile, type InternalRole,
  type Department, type MemberStats, type OrgAccessRequest,
  type AuditLogEntry,
} from '../api/orgApi';
import apiClient from '../../api/apiClient';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const USERS_ROLES_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is Users & Roles?',
    bullets: [
      'The **control center** for who can log in, what they can see, and what they can change.',
      'Every account in your org appears here — admins, managers, coordinators, mentors, interns.',
      'A **role** is a bundle of permissions; a **user** is a person with one role.',
    ],
  },
  {
    eyebrow: '2 · Add a User',
    bullets: [
      'Click **Add User** to create a new account.',
      'Enter **name, email, department, role, employee ID**.',
      'The user gets an **invite email** — they set their password and log in.',
      'For bulk onboarding, use **Import Users** to upload a CSV.',
    ],
  },
  {
    eyebrow: '3 · Roles & Permissions',
    bullets: [
      'Switch to the **Roles** tab to create custom roles or edit built-in ones.',
      'Switch to the **Permissions** tab to see exactly what each role can do.',
      'Built-in roles: **Admin**, **Manager**, **Coordinator**, **Intern** — each with sensible defaults.',
      'Use **Manage Permissions** in Quick Actions for a permission-by-permission matrix.',
    ],
  },
  {
    eyebrow: '4 · Access Requests',
    bullets: [
      'When someone needs **elevated access** (e.g., an intern requesting Coordinator), they raise an Access Request.',
      'Pending requests show up in the **Access Requests** tab — approve or deny with one click.',
      'All approvals/denials are logged in the audit trail.',
    ],
  },
  {
    eyebrow: '5 · Status & Lifecycle',
    bullets: [
      '**Active** — can log in and use the platform.',
      '**Inactive / Suspended** — account exists but blocked from logging in. Use for paused interns or offboarded staff.',
      '**Bulk Actions** lets you change status, role, or department for many users at once.',
      'The row 3-dot menu has per-user actions: edit, reset password, suspend, archive, delete.',
    ],
  },
  {
    eyebrow: '6 · People Fingerprint',
    bullets: [
      'Click the **People Fingerprint** button (top-right) to open the **People Directory** — a single place to see everything a user has done.',
      'For any member, you see their **profile, role, department, manager, and contact details** at a glance.',
      'Their **onboarding progress** — which steps are done, which are pending, due dates, blockers — all in one place.',
      'Their **tasks** — assigned, completed, overdue, with timestamps and submissions.',
      'Their **training** — courses enrolled in, completion %, certificates earned, time spent.',
      'Their **forms & check-ins** — every form submitted, every check-in attended, every approval/comment.',
      'Their **activity timeline** — logins, file uploads, status changes, edits — a full audit trail per user.',
      'Use it for **1:1 reviews, performance check-ins, audits**, or just to answer "what has this person actually done?".',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Use **People Fingerprint / People Directory** to investigate or review what a person has done. Use **Users & Roles** only when you need to change account-level settings — login, role, password, permissions.',
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserSearchResult {
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  email: string;
}

type TabId = 'users' | 'roles' | 'permissions' | 'access-requests' | 'bulk-actions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
  if (src) return <img src={src} alt={name} className="rounded-lg object-cover shrink-0" style={{ width: size, height: size }} />;
  return (
    <div
      className="rounded-lg bg-gray-200 text-gray-600 font-bold flex items-center justify-center shrink-0 text-[11px]"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

function DonutChart({ active, inactive, total }: { active: number; inactive: number; total: number }) {
  if (total === 0) return (
    <div className="flex items-center justify-center w-[110px] h-[110px]">
      <span className="text-[12px] text-gray-400">No data</span>
    </div>
  );
  const R = 44;
  const circ = 2 * Math.PI * R;
  const activePct = total > 0 ? active / total : 0;
  const activeLen = activePct * circ - 2;
  const inactiveLen = (1 - activePct) * circ - 2;
  const gap = circ / 4; // start at top
  return (
    <svg width={110} height={110} viewBox="0 0 110 110">
      <circle cx={55} cy={55} r={R} fill="none" stroke="#e5e7eb" strokeWidth={10} />
      {inactive > 0 && (
        <circle
          cx={55} cy={55} r={R} fill="none" stroke="#9ca3af" strokeWidth={10}
          strokeDasharray={`${inactiveLen} ${circ - inactiveLen}`}
          strokeDashoffset={gap + activeLen + 2}
          strokeLinecap="round"
        />
      )}
      {active > 0 && (
        <circle
          cx={55} cy={55} r={R} fill="none" stroke="#111827" strokeWidth={10}
          strokeDasharray={`${activeLen} ${circ - activeLen}`}
          strokeDashoffset={gap}
          strokeLinecap="round"
        />
      )}
      <text x={55} y={50} textAnchor="middle" style={{ fontSize: 18, fontWeight: 700, fill: '#111827' }}>{total}</text>
      <text x={55} y={63} textAnchor="middle" style={{ fontSize: 9, fill: '#6b7280' }}>Total Users</text>
    </svg>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-[11.5px] text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Profile Drawer ────────────────────────────────────────────────────────────

function ProfileDrawer({
  member, members, departments, isSuperadmin, onClose, onSaved,
}: {
  member: OrgMember; members: OrgMember[]; departments: Department[];
  isSuperadmin: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [profile, setProfile] = useState<OrgMemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [buddyId, setBuddyId] = useState<number | ''>('');
  const [managerId, setManagerId] = useState<number | ''>('');
  const [deptId, setDeptId] = useState<number | ''>('');

  useEffect(() => {
    orgApi.getMemberProfile(member.id)
      .then(p => {
        setProfile(p); setEmployeeId(p.employee_id); setSkills(p.skills);
        setEcName(p.emergency_contact_name); setEcPhone(p.emergency_contact_phone);
        setBuddyId(p.buddy?.id ?? ''); setManagerId(p.manager?.id ?? '');
        setDeptId(departments.find(d => d.name === p.department_name)?.id ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [member.id]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s]);
    setSkillInput('');
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true); setSaveErr('');
    try {
      await orgApi.updateMemberProfile(profile.id, {
        employee_id: employeeId, skills,
        emergency_contact_name: ecName, emergency_contact_phone: ecPhone,
        buddy_id: buddyId || null, manager_id: managerId || null,
        department_id: deptId || null,
      });
      setEditing(false); onSaved();
      const updated = await orgApi.getMemberProfile(profile.id);
      setProfile(updated);
    } catch { setSaveErr('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-[80vw] max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-100 shrink-0">
          <p className="text-[14px] font-semibold text-gray-900">Member Profile</p>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : !profile ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-[13px]">Failed to load profile.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Profile header banner */}
            <div className="px-5 py-4 flex items-center gap-4 bg-gray-50 border-b border-gray-100">
              <Avatar src={profile.user.profile_picture} name={profile.user.display_name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-gray-900">{profile.user.display_name}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">@{profile.user.username} · {profile.user.role}</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 text-[11px] font-medium text-gray-600">
                    {member.status === 'active' ? <CheckCircle size={10} /> : member.status === 'suspended' ? <AlertCircle size={10} /> : <Clock size={10} />}
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </span>
                  <span className="text-[11px] text-gray-400">{profile.role_name}</span>
                  {profile.employee_id && (
                    <span className="text-[11px] text-gray-400">ID: {profile.employee_id}</span>
                  )}
                </div>
              </div>
              <div className="w-40 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10.5px] font-semibold text-gray-500">Profile Completion</span>
                  <span className="text-[10.5px] font-bold text-gray-700">{profile.profile_completion_pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-800 rounded-full transition-all duration-500" style={{ width: `${profile.profile_completion_pct}%` }} />
                </div>
              </div>
            </div>

            {/* Two-column body */}
            <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
              {/* Left column: Professional */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Professional</p>
                <Row icon={<Briefcase size={12} />} label="Employee ID">
                  {editing ? (
                    <input value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                      className="flex-1 text-[12px] border-b border-gray-200 focus:outline-none focus:border-gray-400 bg-transparent pb-0.5"
                      placeholder="e.g. EMP-001" />
                  ) : (
                    <span className="text-[12px] text-gray-700">{profile.employee_id || <em className="text-gray-400">Not set</em>}</span>
                  )}
                </Row>
                <Row icon={<Building2 size={12} />} label="Department">
                  {editing && isSuperadmin ? (
                    <select value={deptId} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 text-[12px] border-b border-gray-200 focus:outline-none bg-transparent pb-0.5">
                      <option value="">None</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-[12px] text-gray-700">{profile.department_name || <em className="text-gray-400">Not assigned</em>}</span>
                  )}
                </Row>
                <Row icon={<User size={12} />} label="Manager">
                  {editing && isSuperadmin ? (
                    <select value={managerId} onChange={e => setManagerId(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 text-[12px] border-b border-gray-200 focus:outline-none bg-transparent pb-0.5">
                      <option value="">None</option>
                      {members.filter(m => m.id !== member.id).map(m => (
                        <option key={m.id} value={m.id}>{m.user.display_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[12px] text-gray-700">{profile.manager?.display_name || <em className="text-gray-400">Not assigned</em>}</span>
                  )}
                </Row>
                <Row icon={<Users size={12} />} label="Buddy">
                  {editing && isSuperadmin ? (
                    <select value={buddyId} onChange={e => setBuddyId(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 text-[12px] border-b border-gray-200 focus:outline-none bg-transparent pb-0.5">
                      <option value="">None</option>
                      {members.filter(m => m.id !== member.id).map(m => (
                        <option key={m.id} value={m.id}>{m.user.display_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[12px] text-gray-700">{profile.buddy?.display_name || <em className="text-gray-400">Not assigned</em>}</span>
                  )}
                </Row>
                <Row icon={<Clock size={12} />} label="Joined">
                  <span className="text-[12px] text-gray-700">{profile.joined_date}</span>
                </Row>
              </div>

              {/* Right column: Skills + Emergency Contact */}
              <div className="px-5 py-4 space-y-4">
                <section>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {skills.map(s => (
                      <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[11.5px] font-medium">
                        <Tag size={9} />{s}
                        {editing && (
                          <button onClick={() => setSkills(prev => prev.filter(x => x !== s))} className="ml-0.5 text-gray-400 hover:text-red-500">
                            <X size={9} />
                          </button>
                        )}
                      </span>
                    ))}
                    {editing && (
                      <div className="flex items-center gap-1">
                        <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                          placeholder="Add skill..." className="text-[11.5px] border border-gray-200 rounded-full px-2 py-0.5 focus:outline-none w-28" />
                        <button onClick={addSkill} className="text-[11px] text-gray-600 font-semibold hover:underline">Add</button>
                      </div>
                    )}
                    {!editing && skills.length === 0 && <span className="text-[11.5px] text-gray-400 italic">No skills listed</span>}
                  </div>
                </section>

                <section>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Emergency Contact</p>
                  <div className="space-y-2">
                    <Row icon={<User size={12} />} label="Name">
                      {editing ? (
                        <input value={ecName} onChange={e => setEcName(e.target.value)}
                          className="flex-1 text-[12px] border-b border-gray-200 focus:outline-none bg-transparent pb-0.5" placeholder="Contact name" />
                      ) : (
                        <span className="text-[12px] text-gray-700">{profile.emergency_contact_name || <em className="text-gray-400">Not set</em>}</span>
                      )}
                    </Row>
                    <Row icon={<Phone size={12} />} label="Phone">
                      {editing ? (
                        <input value={ecPhone} onChange={e => setEcPhone(e.target.value)}
                          className="flex-1 text-[12px] border-b border-gray-200 focus:outline-none bg-transparent pb-0.5" placeholder="+1 234 567 8900" />
                      ) : (
                        <span className="text-[12px] text-gray-700">{profile.emergency_contact_phone || <em className="text-gray-400">Not set</em>}</span>
                      )}
                    </Row>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {profile && (
          <div className="px-5 py-2.5 border-t border-gray-100 shrink-0">
            {saveErr && <p className="text-[11.5px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg mb-2">{saveErr}</p>}
            <div className="flex gap-2 max-w-sm">
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setSaveErr(''); }}
                    className="flex-1 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex-1 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

// ── Grant Access Modal ────────────────────────────────────────────────────────

function GrantAccessModal({ roles, departments, onClose, onGranted }: {
  roles: InternalRole[]; departments: Department[];
  onClose: () => void; onGranted: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [roleId, setRoleId] = useState<number | ''>('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmGrant, setConfirmGrant] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiClient.get<UserSearchResult[]>(`/api/org/search-users/?q=${encodeURIComponent(query)}`);
        setResults(data ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [query]);

  const handleSubmit = async () => {
    if (!selected || !roleId) return;
    setSubmitting(true); setError('');
    try {
      await orgApi.grantAccess(selected.user_id, roleId as number, notes, deptId as number | null || null);
      setConfirmGrant(false); onGranted(); onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string; user_id?: string[] } })?.data?.detail
        ?? (err as { data?: { user_id?: string[] } })?.data?.user_id?.[0]
        ?? 'Failed to grant access.';
      setError(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[480px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">Grant Internal Access</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Search platform user</label>
            {selected ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <Avatar src={selected.avatar_url} name={selected.display_name} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{selected.display_name}</p>
                  <p className="text-[11.5px] text-gray-500">@{selected.username} · {selected.role}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, username or email..."
                  className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" autoFocus />
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-[200px] overflow-y-auto">
                    {results.map(u => (
                      <button key={u.user_id} onClick={() => { setSelected(u); setQuery(''); setResults([]); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
                        <Avatar src={u.avatar_url} name={u.display_name} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800 truncate">{u.display_name}</p>
                          <p className="text-[11.5px] text-gray-500">@{u.username} · {u.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searching && <p className="absolute top-full left-0 mt-1 text-[12px] text-gray-400 px-2">Searching...</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Assign internal role</label>
            <div className="relative">
              <select value={roleId} onChange={e => setRoleId(e.target.value ? Number(e.target.value) : '')}
                className="w-full appearance-none px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white">
                <option value="">Select a role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name} (level {r.level})</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {departments.length > 0 && (
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Department <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <select value={deptId} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full appearance-none px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white">
                  <option value="">No department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Notes <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any relevant context..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none" />
          </div>
        </div>

        {error && <p className="text-[12.5px] text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}

        <div className="flex gap-2.5 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
          <button onClick={() => { setError(''); setConfirmGrant(true); }}
            disabled={!selected || !roleId || submitting}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Granting...' : 'Grant Access'}
          </button>
        </div>
      </div>

      {confirmGrant && selected && roleId && (
        <ConfirmDialog
          title="Grant internal access?"
          message={`${selected.display_name} will be added as an internal member with the "${roles.find(r => r.id === roleId)?.name}" role.`}
          confirmLabel="Grant Access"
          loading={submitting}
          onConfirm={handleSubmit}
          onCancel={() => setConfirmGrant(false)}
        />
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function UsersTab({
  members, roles, departments, isSuperadmin, loading,
  onViewProfile, onReload,
}: {
  members: OrgMember[]; roles: InternalRole[]; departments: Department[];
  isSuperadmin: boolean; loading: boolean;
  onViewProfile: (m: OrgMember) => void; onReload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [changeRoleId, setChangeRoleId] = useState<{ memberId: number; newRoleId: number } | null>(null);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [changing, setChanging] = useState(false);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchText = !q
      || m.user.display_name.toLowerCase().includes(q)
      || m.user.username.toLowerCase().includes(q)
      || m.user.email.toLowerCase().includes(q)
      || m.employee_id.toLowerCase().includes(q);
    const matchDept = !deptFilter || m.department_name === deptFilter;
    const matchRole = !roleFilter || m.role.name === roleFilter;
    const matchStatus = !statusFilter || m.status === statusFilter;
    return matchText && matchDept && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    try { await orgApi.revokeAccess(revokeId); onReload(); setRevokeId(null); }
    catch { /* keep open */ }
    finally { setRevoking(false); }
  };

  const handleChangeRole = async () => {
    if (!changeRoleId) return;
    setChanging(true);
    try { await orgApi.updateMember(changeRoleId.memberId, { role_id: changeRoleId.newRoleId }); onReload(); setChangeRoleId(null); }
    catch { /* keep open */ }
    finally { setChanging(false); }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users by name, email or ID..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
        </div>
        <div className="relative">
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400">
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter size={13} /> Filters
        </button>
      </div>

      {/* Table — fixed height so card never resizes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-[416px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-[13px] text-gray-400">Loading members...</div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <Users size={22} className="text-gray-300" />
            </div>
            <p className="text-[14px] font-semibold text-gray-600">
              {search || deptFilter || roleFilter || statusFilter ? 'No members match your filter' : 'No members yet'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Employee ID</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(m => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors relative">
                    <td className="px-4 py-2">
                      <button onClick={() => onViewProfile(m)} className="flex items-center gap-2 text-left hover:opacity-80">
                        <Avatar src={m.user.profile_picture} name={m.user.display_name} size={28} />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{m.user.display_name}</p>
                          <p className="text-[11px] text-gray-400">{m.user.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-600">{m.employee_id || '—'}</td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-600">{m.department_name || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 text-[11px] font-medium text-gray-700">{m.role.name}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${
                        m.status === 'active' ? 'border-gray-300 text-gray-700' :
                        m.status === 'suspended' ? 'border-gray-400 text-gray-800 bg-gray-100' :
                        'border-gray-200 text-gray-500'
                      }`}>
                        {m.status === 'active' && <CheckCircle size={10} />}
                        {m.status === 'inactive' && <Clock size={10} />}
                        {m.status === 'suspended' && <AlertCircle size={10} />}
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-500">{fmtDate(m.user.last_login)}</td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <button
                          onClick={e => {
                            if (actionMenuId === m.id) {
                              setActionMenuId(null); setMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setActionMenuId(m.id);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {actionMenuId === m.id && menuPos && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => { setActionMenuId(null); setMenuPos(null); }} />
                            <div
                              className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]"
                              style={{ top: menuPos.top, right: menuPos.right }}
                            >
                              <button onClick={() => { onViewProfile(m); setActionMenuId(null); setMenuPos(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                                <User size={13} /> View Profile
                              </button>
                              {isSuperadmin && (
                                <>
                                  <div className="border-t border-gray-100 my-1" />
                                  <button onClick={() => { setRevokeId(m.id); setActionMenuId(null); setMenuPos(null); }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-red-600 hover:bg-red-50">
                                    <UserX size={13} /> Revoke Access
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
              <span className="text-[11.5px] text-gray-500">Showing {start} to {end} of {filtered.length} users</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="px-2.5 py-1.5 text-[12px] rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors">‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5 && safePage > 3) p = safePage - 2 + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-3 py-1.5 text-[12px] rounded-lg border transition-colors ${safePage === p ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-100'}`}>
                      {p}
                    </button>
                  );
                })}
                {totalPages > 5 && safePage < totalPages - 2 && <span className="text-gray-400 px-1">...</span>}
                {totalPages > 5 && safePage < totalPages - 1 && (
                  <button onClick={() => setPage(totalPages)}
                    className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">{totalPages}</button>
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="px-2.5 py-1.5 text-[12px] rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors">›</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Revoke confirm */}
      {revokeId !== null && (
        <ConfirmDialog
          title="Revoke access?"
          message={`${members.find(m => m.id === revokeId)?.user.display_name ?? 'This member'} will lose access to the internal portal immediately.`}
          confirmLabel="Revoke"
          loading={revoking}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeId(null)}
        />
      )}
      {changeRoleId && (
        <ConfirmDialog
          title="Change member role?"
          message={`Change role to "${roles.find(r => r.id === changeRoleId.newRoleId)?.name ?? 'Unknown'}"?`}
          confirmLabel="Change Role"
          loading={changing}
          onConfirm={handleChangeRole}
          onCancel={() => setChangeRoleId(null)}
        />
      )}
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab({ roles, isSuperadmin, onReload }: {
  roles: InternalRole[]; isSuperadmin: boolean; onReload: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', level: 1, can_manage_members: false, can_view_all_contributions: false, can_approve_checkins: false, can_upload_agreements: false });
  const [newForm, setNewForm] = useState({ name: '', level: 1, can_manage_members: false, can_view_all_contributions: false, can_approve_checkins: false, can_upload_agreements: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleEdit = (r: InternalRole) => {
    setEditingId(r.id);
    setEditForm({ name: r.name, level: r.level, can_manage_members: r.can_manage_members, can_view_all_contributions: r.can_view_all_contributions, can_approve_checkins: r.can_approve_checkins, can_upload_agreements: r.can_upload_agreements });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true); setErr('');
    try {
      await apiClient.patch(`/api/org/roles/${editingId}/`, editForm);
      setEditingId(null); onReload();
    } catch { setErr('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true); setErr('');
    try {
      await apiClient.post('/api/org/roles/', newForm);
      setCreating(false);
      setNewForm({ name: '', level: 1, can_manage_members: false, can_view_all_contributions: false, can_approve_checkins: false, can_upload_agreements: false });
      onReload();
    } catch { setErr('Failed to create role.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setSaving(true); setErr('');
    try { await apiClient.delete(`/api/org/roles/${id}/`); onReload(); }
    catch (e: unknown) {
      const msg = (e as { data?: { detail?: string } })?.data?.detail ?? 'Failed to delete role.';
      setErr(msg);
    }
    finally { setSaving(false); }
  };

  const PERM_COLS = [
    { key: 'can_manage_members' as const, label: 'Manage Mbrs' },
    { key: 'can_view_all_contributions' as const, label: 'View Contrib.' },
    { key: 'can_approve_checkins' as const, label: 'Approve CIs' },
    { key: 'can_upload_agreements' as const, label: 'Upload Docs' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-gray-500">{roles.length} roles configured</p>
        {isSuperadmin && !creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors">
            <UserPlus size={13} /> Create Role
          </button>
        )}
      </div>

      {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{err}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Role Name</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-14">Level</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-16">Members</th>
              {PERM_COLS.map(c => (
                <th key={c.key} className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{c.label}</th>
              ))}
              {isSuperadmin && <th className="px-3 py-2 w-28" />}
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              editingId === r.id ? (
                <tr key={r.id} className="border-b border-gray-100 bg-gray-50">
                  <td className="px-3 py-2">
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="text-[13px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 w-32" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={editForm.level} onChange={e => setEditForm(f => ({ ...f, level: Number(e.target.value) }))}
                      className="text-[13px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none w-12" />
                  </td>
                  <td className="px-3 py-2 text-[13px] text-gray-500">{r.member_count}</td>
                  {PERM_COLS.map(c => (
                    <td key={c.key} className="px-3 py-2 text-center">
                      <button onClick={() => setEditForm(f => ({ ...f, [c.key]: !f[c.key] }))}
                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto border transition-colors ${editForm[c.key] ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-transparent'}`}>
                        <Check size={11} />
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <button onClick={handleSaveEdit} disabled={saving}
                        className="px-2.5 py-1 text-[12px] font-semibold text-white bg-gray-900 rounded-lg disabled:opacity-50">Save</button>
                      <button onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-[12px] font-semibold text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="text-[13px] font-semibold text-gray-800">{r.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-gray-600">{r.level}</td>
                  <td className="px-3 py-2.5 text-[13px] text-gray-600">{r.member_count}</td>
                  {PERM_COLS.map(c => (
                    <td key={c.key} className="px-3 py-2.5 text-center">
                      {r[c.key]
                        ? <Check size={14} className="text-gray-700 mx-auto" />
                        : <Minus size={14} className="text-gray-300 mx-auto" />}
                    </td>
                  ))}
                  {isSuperadmin && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button onClick={() => handleEdit(r)}
                          className="px-2.5 py-1 text-[12px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">Edit</button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={r.member_count > 0 || saving}
                          title={r.member_count > 0 ? 'Cannot delete a role with members assigned' : ''}
                          className="px-2.5 py-1 text-[12px] text-red-600 border border-red-100 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            ))}

            {/* Create row */}
            {creating && (
              <tr className="border-b border-gray-100 bg-gray-50">
                <td className="px-3 py-2">
                  <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Role name..."
                    className="text-[13px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 w-32" autoFocus />
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={newForm.level} onChange={e => setNewForm(f => ({ ...f, level: Number(e.target.value) }))}
                    className="text-[13px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none w-12" />
                </td>
                <td className="px-3 py-2 text-[13px] text-gray-400">—</td>
                {PERM_COLS.map(c => (
                  <td key={c.key} className="px-3 py-2 text-center">
                    <button onClick={() => setNewForm(f => ({ ...f, [c.key]: !f[c.key] }))}
                      className={`w-5 h-5 rounded flex items-center justify-center mx-auto border transition-colors ${newForm[c.key] ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-transparent'}`}>
                      <Check size={11} />
                    </button>
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <button onClick={handleCreate} disabled={saving || !newForm.name.trim()}
                      className="px-2.5 py-1 text-[12px] font-semibold text-white bg-gray-900 rounded-lg disabled:opacity-50">Add</button>
                    <button onClick={() => setCreating(false)}
                      className="px-2.5 py-1 text-[12px] font-semibold text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Permissions Tab ───────────────────────────────────────────────────────────

function PermissionsTab({ roles }: { roles: InternalRole[] }) {
  const PERMS = [
    { key: 'can_manage_members' as const, label: 'Manage Members', desc: 'View and manage org members' },
    { key: 'can_view_all_contributions' as const, label: 'View All Contributions', desc: 'See all member contributions' },
    { key: 'can_approve_checkins' as const, label: 'Approve Check-ins', desc: 'Review and approve check-ins' },
    { key: 'can_upload_agreements' as const, label: 'Upload Agreements', desc: 'Upload and manage agreements' },
  ];

  return (
    <div>
      <div className="mb-4">
        <p className="text-[13px] text-gray-500">Role permission matrix — edit individual roles in the Roles tab</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Role</th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Level</th>
              {PERMS.map(p => (
                <th key={p.key} className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <div>{p.label}</div>
                  <div className="text-[10px] font-normal text-gray-400 normal-case">{p.desc}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 sticky left-0 bg-white">
                  <div className="text-[13px] font-semibold text-gray-800">{r.name}</div>
                  <div className="text-[11.5px] text-gray-400">{r.member_count} member{r.member_count !== 1 ? 's' : ''}</div>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-gray-200 text-[12px] text-gray-600">{r.level}</span>
                </td>
                {PERMS.map(p => (
                  <td key={p.key} className="px-4 py-2.5 text-center">
                    {r[p.key]
                      ? <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center mx-auto"><Check size={12} className="text-white" /></div>
                      : <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mx-auto"><Minus size={12} className="text-gray-400" /></div>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Access Requests Tab ───────────────────────────────────────────────────────

function AccessRequestsTab({ roles, isSuperadmin }: { roles: InternalRole[]; isSuperadmin: boolean }) {
  const [requests, setRequests] = useState<OrgAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewRoleId, setReviewRoleId] = useState<number | ''>('');
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    accessRequestsApi.getRequests()
      .then(r => setRequests(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    setProcessing(true); setErr('');
    try {
      const data: { action: 'approve' | 'reject'; role_id?: number } = { action };
      if (action === 'approve' && reviewRoleId) data.role_id = reviewRoleId as number;
      await accessRequestsApi.reviewRequest(id, data);
      setReviewingId(null); setReviewRoleId(''); load();
    } catch (e: unknown) {
      setErr((e as { data?: { detail?: string } })?.data?.detail ?? 'Action failed.');
    }
    finally { setProcessing(false); }
  };

  if (loading) return <div className="flex justify-center py-16 text-[13px] text-gray-400">Loading requests...</div>;

  return (
    <div>
      <div className="mb-4">
        <p className="text-[13px] text-gray-500">{requests.length} pending access request{requests.length !== 1 ? 's' : ''}</p>
      </div>
      {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{err}</p>}

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <UserCheck size={22} className="text-gray-300" />
          </div>
          <p className="text-[14px] font-semibold text-gray-600">No pending requests</p>
          <p className="text-[12.5px] text-gray-400 mt-1">New access requests will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Requested Role</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Requested On</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={req.user_avatar} name={req.user_display_name} size={32} />
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">{req.user_display_name}</p>
                        <p className="text-[11.5px] text-gray-400">{req.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{req.role_name || '—'}</td>
                  <td className="px-4 py-2.5 text-[13px] text-gray-600">{req.department_name || '—'}</td>
                  <td className="px-4 py-2.5 text-[12.5px] text-gray-500">{fmtDate(req.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {isSuperadmin ? (
                      reviewingId === req.id ? (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <select value={reviewRoleId} onChange={e => setReviewRoleId(e.target.value ? Number(e.target.value) : '')}
                              className="appearance-none pl-2 pr-6 py-1 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none">
                              <option value="">{req.role_name || 'Select role...'}</option>
                              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                          <button onClick={() => handleReview(req.id, 'approve')} disabled={processing}
                            className="px-2.5 py-1 text-[12px] font-semibold text-white bg-gray-900 rounded-lg disabled:opacity-50">Approve</button>
                          <button onClick={() => handleReview(req.id, 'reject')} disabled={processing}
                            className="px-2.5 py-1 text-[12px] font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">Reject</button>
                          <button onClick={() => setReviewingId(null)}
                            className="px-2 py-1 text-[12px] text-gray-400 hover:text-gray-600"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setReviewingId(req.id); setReviewRoleId(req.requested_role ?? ''); }}
                          className="px-3 py-1 text-[12px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Review</button>
                      )
                    ) : (
                      <span className="text-[12px] text-gray-400 italic">Admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Bulk Actions Tab ──────────────────────────────────────────────────────────

function BulkActionsTab({ members, roles, isSuperadmin, onReload }: {
  members: OrgMember[]; roles: InternalRole[]; isSuperadmin: boolean; onReload: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRole, setBulkRole] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set());
    else setSelected(new Set(members.map(m => m.id)));
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (selected.size === 0 || (!bulkRole && !bulkStatus)) return;
    setApplying(true); setProgress(0);
    const ids = [...selected];
    for (let i = 0; i < ids.length; i++) {
      const data: Record<string, unknown> = {};
      if (bulkRole) data.role_id = Number(bulkRole);
      if (bulkStatus) data.status = bulkStatus;
      try { await orgApi.updateMember(ids[i], data); }
      catch { /* continue */ }
      setProgress(i + 1);
    }
    setApplying(false); setSelected(new Set()); setBulkRole(''); setBulkStatus('');
    onReload();
  };

  const handleExport = () => {
    const rows = members.filter(m => selected.size === 0 || selected.has(m.id));
    const header = 'Name,Email,Employee ID,Department,Role,Status,Joined';
    const csv = [header, ...rows.map(m =>
      [m.user.display_name, m.user.email, m.employee_id, m.department_name ?? '', m.role.name, m.status, m.joined_date].join(',')
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Action toolbar */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <span className="text-[13px] font-semibold text-gray-700 mr-2">{selected.size > 0 ? `${selected.size} selected` : 'Select members to take bulk action'}</span>
        {isSuperadmin && selected.size > 0 && (
          <>
            <div className="relative">
              <select value={bulkRole} onChange={e => setBulkRole(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none">
                <option value="">Change Role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none">
                <option value="">Change Status...</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={handleApply} disabled={applying || (!bulkRole && !bulkStatus)}
              className="px-3 py-1.5 text-[13px] font-semibold text-white bg-gray-900 rounded-lg disabled:opacity-50 transition-colors">
              {applying ? `Applying... (${progress}/${selected.size})` : 'Apply'}
            </button>
          </>
        )}
        <div className="ml-auto">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors">
            <Download size={13} /> Export {selected.size > 0 ? `(${selected.size})` : 'All'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2 w-8">
                <button onClick={toggleAll}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected.size === members.length && members.length > 0 ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                  {selected.size === members.length && members.length > 0 && <Check size={10} className="text-white" />}
                </button>
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className={`border-b border-gray-100 transition-colors ${selected.has(m.id) ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-2.5 w-8">
                  <button onClick={() => toggleOne(m.id)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected.has(m.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                    {selected.has(m.id) && <Check size={10} className="text-white" />}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={m.user.profile_picture} name={m.user.display_name} size={30} />
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">{m.user.display_name}</p>
                      <p className="text-[11.5px] text-gray-400">{m.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-gray-600">{m.role.name}</td>
                <td className="px-4 py-2.5 text-[13px] text-gray-600">{m.department_name || '—'}</td>
                <td className="px-4 py-2.5 text-[13px] text-gray-600 capitalize">{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgMembers() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const navigate = useNavigate();
  const [members, setMembers]       = useState<OrgMember[]>([]);
  const [roles, setRoles]           = useState<InternalRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats]           = useState<MemberStats | null>(null);
  const [activities, setActivities] = useState<AuditLogEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<OrgAccessRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<TabId>('users');
  const [showGrant, setShowGrant]   = useState(false);
  const [profileMember, setProfileMember] = useState<OrgMember | null>(null);
  const [reviewModal, setReviewModal] = useState<OrgAccessRequest | null>(null);
  const [reviewModalRoleId, setReviewModalRoleId] = useState<number | ''>('');
  const [reviewProcessing, setReviewProcessing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMore) return;
    const handle = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMore]);

  const exportUsersCSV = () => {
    const rows = [
      ['Name', 'Email', 'Username', 'Employee ID', 'Department', 'Role', 'Status', 'Joined'],
      ...members.map(m => [
        m.user.display_name, m.user.email, m.user.username,
        m.employee_id || '', m.department_name || '', m.role.name,
        m.status, m.joined_date,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
    URL.revokeObjectURL(url);
    setShowMore(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, r, d] = await Promise.all([
        orgApi.getMembers(),
        orgApi.getRoles(),
        orgApi.getDepartments(),
      ]);
      setMembers(m); setRoles(r); setDepartments(d);

      // parallel: stats, activities, pending requests (non-blocking)
      Promise.all([
        membersStatsApi.getStats().catch(() => null),
        auditApi.getAuditLog({ limit: 4 }).catch(() => []),
        accessRequestsApi.getRequests().catch(() => []),
      ]).then(([s, a, p]) => {
        if (s) setStats(s);
        setActivities(a as AuditLogEntry[]);
        setPendingRequests((p as OrgAccessRequest[]).slice(0, 3));
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canManageMembers) return null;

  const TABS: { id: TabId; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'access-requests', label: 'Access Requests' },
    { id: 'bulk-actions', label: 'Bulk Actions' },
  ];

  const activityIcon = (action: string) => {
    if (action.includes('create') || action.includes('grant')) return <UserPlus size={14} className="text-gray-600" />;
    if (action.includes('delete') || action.includes('revoke')) return <UserX size={14} className="text-gray-600" />;
    if (action.includes('update')) return <Settings size={14} className="text-gray-600" />;
    return <Activity size={14} className="text-gray-600" />;
  };

  const handleReviewModal = async (action: 'approve' | 'reject') => {
    if (!reviewModal) return;
    setReviewProcessing(true);
    try {
      const data: { action: 'approve' | 'reject'; role_id?: number } = { action };
      if (action === 'approve' && reviewModalRoleId) data.role_id = reviewModalRoleId as number;
      await accessRequestsApi.reviewRequest(reviewModal.id, data);
      setReviewModal(null); setReviewModalRoleId(''); load();
    } catch { /* ignore */ }
    finally { setReviewProcessing(false); }
  };

  const activeCount = members.filter(m => m.status === 'active').length;
  const inactiveCount = members.filter(m => m.status !== 'active').length;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">Users & Roles Overview</h1>
            <PageHelp title="How Users & Roles Work" sections={USERS_ROLES_HELP} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Manage system users, roles, permissions and access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/org/departments')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Building size={12} /> View Departments
          </button>
          <button
            onClick={() => navigate('/org/directory')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Fingerprint size={12} /> View People Fingerprint
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Upload size={12} /> Import Users
          </button>
          {isSuperadmin && (
            <button onClick={() => setShowGrant(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors">
              <UserPlus size={12} /> Add User
            </button>
          )}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMore(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${showMore ? 'bg-gray-100 border-gray-300 text-gray-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              More <ChevronDown size={11} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                <button
                  onClick={exportUsersCSV}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download size={13} className="text-gray-400" /> Export Users (CSV)
                </button>
                <button
                  onClick={() => { load(); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Activity size={13} className="text-gray-400" /> Refresh Data
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={() => { setActiveTab('access-requests'); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <AlertCircle size={13} className="text-gray-400" /> Access Requests
                  {pendingRequests.length > 0 && (
                    <span className="ml-auto text-[11px] font-bold bg-gray-900 text-white rounded-full w-4 h-4 flex items-center justify-center">{pendingRequests.length}</span>
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab('bulk-actions'); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Users size={13} className="text-gray-400" /> Bulk Actions
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button
                  onClick={() => { window.location.href = '/org/settings'; setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={13} className="text-gray-400" /> Org Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 space-y-4">
        {/* Main grid */}
        <div className="flex gap-4 items-start">
          {/* Left — tabs + content */}
          <div className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === t.id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                  {t.id === 'access-requests' && pendingRequests.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-gray-900 text-white rounded-full">{pendingRequests.length}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'users' && (
              <UsersTab
                members={members} roles={roles} departments={departments}
                isSuperadmin={isSuperadmin} loading={loading}
                onViewProfile={setProfileMember} onReload={load}
              />
            )}
            {activeTab === 'roles' && (
              <RolesTab roles={roles} isSuperadmin={isSuperadmin} onReload={load} />
            )}
            {activeTab === 'permissions' && (
              <PermissionsTab roles={roles} />
            )}
            {activeTab === 'access-requests' && (
              <AccessRequestsTab roles={roles} isSuperadmin={isSuperadmin} />
            )}
            {activeTab === 'bulk-actions' && (
              <BulkActionsTab members={members} roles={roles} isSuperadmin={isSuperadmin} onReload={load} />
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-[280px] shrink-0 space-y-4">
            {/* Roles Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-900">Roles Summary</p>
                <button onClick={() => setActiveTab('roles')} className="text-[11px] text-gray-500 hover:text-gray-700 font-medium">View all</button>
              </div>
              <div className="space-y-1.5">
                {[...roles].sort((a, b) => b.member_count - a.member_count).slice(0, 8).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-0.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield size={11} className="text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{r.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900 shrink-0 ml-2">{r.member_count}</span>
                  </div>
                ))}
                {roles.length === 0 && <p className="text-[11px] text-gray-400 italic">No roles configured</p>}
              </div>
            </div>

            {/* User Status donut */}
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-bold text-gray-900 mb-2">User Status</p>
              <div className="flex items-center gap-3">
                <DonutChart active={activeCount} inactive={inactiveCount} total={members.length} />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-900" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-800">Active</p>
                      <p className="text-[10px] text-gray-500">{activeCount} ({members.length ? Math.round(activeCount / members.length * 100) : 0}%)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-800">Inactive</p>
                      <p className="text-[10px] text-gray-500">{inactiveCount} ({members.length ? Math.round(inactiveCount / members.length * 100) : 0}%)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-bold text-gray-900 mb-2">Quick Actions</p>
              <div className="space-y-1">
                {[
                  { icon: UserPlus, label: 'Add New User', action: () => setShowGrant(true), guard: isSuperadmin },
                  { icon: Shield, label: 'Create New Role', action: () => setActiveTab('roles'), guard: isSuperadmin },
                  { icon: FileText, label: 'Manage Permissions', action: () => setActiveTab('permissions'), guard: true },
                  { icon: Download, label: 'Bulk Import Users', action: () => {}, guard: isSuperadmin },
                  { icon: UserCheck, label: 'Access Requests', action: () => setActiveTab('access-requests'), guard: true },
                ].filter(a => a.guard).map(a => {
                  const Icon = a.icon;
                  return (
                    <button key={a.label} onClick={a.action}
                      className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs text-gray-700 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <Icon size={12} className="text-gray-500 shrink-0" />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Recent User Activities */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900">Recent User Activities</p>
              <button className="text-[11px] text-gray-500 hover:text-gray-700 font-medium">View all</button>
            </div>
            {activities.length === 0 ? (
              <p className="text-[11.5px] text-gray-400 italic py-3 text-center">No recent activities</p>
            ) : (
              <div className="space-y-2">
                {activities.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(a.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] text-gray-700 leading-snug">
                        <span className="font-semibold">{a.record_repr || a.action}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">by {a.actor_name} · {timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Access Requests */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900">Pending Access Requests</p>
              <button onClick={() => setActiveTab('access-requests')} className="text-[11px] text-gray-500 hover:text-gray-700 font-medium">View all</button>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-[11.5px] text-gray-400 italic py-3 text-center">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center gap-2">
                    <Avatar src={req.user_avatar} name={req.user_display_name} size={24} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-semibold text-gray-800 truncate">{req.user_display_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {req.role_name && <span className="font-medium text-gray-500">{req.role_name}</span>}
                        {req.role_name && req.department_name && ' · '}
                        {req.department_name}
                      </p>
                    </div>
                    <div className="text-[10px] text-gray-400 shrink-0 mr-1">{fmtDate(req.created_at)}</div>
                    {isSuperadmin && (
                      <button onClick={() => { setReviewModal(req); setReviewModalRoleId(req.requested_role ?? ''); }}
                        className="px-2 py-1 text-[11px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0">Review</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showGrant && (
        <GrantAccessModal roles={roles} departments={departments} onClose={() => setShowGrant(false)} onGranted={load} />
      )}

      {profileMember && (
        <ProfileDrawer
          member={profileMember} members={members} departments={departments}
          isSuperadmin={isSuperadmin} onClose={() => setProfileMember(null)} onSaved={load}
        />
      )}

      {/* Review modal from bottom row */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[400px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-gray-900">Review Access Request</h3>
              <button onClick={() => setReviewModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
              <Avatar src={reviewModal.user_avatar} name={reviewModal.user_display_name} size={36} />
              <div>
                <p className="text-[13px] font-semibold text-gray-800">{reviewModal.user_display_name}</p>
                <p className="text-[12px] text-gray-500">{reviewModal.user_email}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Assign Role</label>
              <div className="relative">
                <select value={reviewModalRoleId} onChange={e => setReviewModalRoleId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full appearance-none px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white">
                  <option value="">{reviewModal.role_name || 'Select role...'}</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => handleReviewModal('reject')} disabled={reviewProcessing}
                className="flex-1 py-2 text-[13px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl disabled:opacity-50 transition-colors">Reject</button>
              <button onClick={() => handleReviewModal('approve')} disabled={reviewProcessing || !reviewModalRoleId}
                className="flex-1 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl disabled:opacity-50 transition-colors">
                {reviewProcessing ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
