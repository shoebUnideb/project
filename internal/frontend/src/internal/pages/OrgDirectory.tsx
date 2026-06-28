import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Users, Grid3x3, List, Download, Plus, X, Mail, MessageSquare,
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Check,
  UserX, UserCheck, Trash2, Edit2, Eye, Filter, SlidersHorizontal,
} from 'lucide-react';
import { orgApi, membersStatsApi, type OrgMember, type OrgMemberProfile, type MemberStats, type Department, type InternalRole } from '../api/orgApi';
import { tokens } from '../../api/apiClient';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const DIRECTORY_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is the People Directory?',
    bullets: [
      'A **searchable list of every member** in your organisation — interns, mentors, managers, coordinators.',
      'Use it as a phonebook: find a teammate by name, role, department, or email.',
      'Different from **Users & Roles** — the Directory is for *finding people*; Users & Roles is for *managing their account & permissions*.',
    ],
  },
  {
    eyebrow: '2 · Search & Filter',
    bullets: [
      'Type in the search box to match by **name, role, department, or email**.',
      'Use the **All Departments / All Roles / All Status** dropdowns to narrow the list.',
      'Toggle between **grid view** (avatar cards) and **list view** (table) with the icons on the right.',
    ],
  },
  {
    eyebrow: '3 · Sorting',
    bullets: [
      '**Name A–Z** — alphabetical by display name.',
      '**Recently Joined** — newest members first.',
      '**Department** — grouped by team.',
      '**Role** — grouped by job title.',
    ],
  },
  {
    eyebrow: '4 · Quick Actions per Member',
    bullets: [
      'Click a row to **open the member\'s profile** — full details, onboarding progress, training, documents, contributions.',
      'Use the **email icon** to compose an email straight from here.',
      'Use the **message icon** to start an in-app chat (if messaging is enabled).',
      'The **3-dot menu** opens admin actions — edit profile, change status, archive, delete.',
    ],
  },
  {
    eyebrow: '5 · Export',
    bullets: [
      'Click **Export** in the top right to download a CSV of the current filtered view.',
      'Exports include all visible fields and respect your search and filter selections — useful for audits and reports.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'A small green dot on an avatar means the member is **active** (recently logged in or currently online, depending on your settings). Gray dot = inactive.',
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_PER_PAGE = 20;
const LIST_PER_PAGE = 10;

const inputCls = 'w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 disabled:bg-gray-50';
const selectCls = 'px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white appearance-none pr-7 cursor-pointer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(m: OrgMember): string {
  return m.user.display_name || `${m.user.first_name} ${m.user.last_name}`.trim() || m.user.username;
}

function Avatar({ src, name, size = 'md', square = false }: { src: string | null; name: string; size?: 'sm' | 'md' | 'lg'; square?: boolean }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const cls = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-14 h-14 text-[16px]' : 'w-9 h-9 text-[12px]';
  const radius = square ? 'rounded-xl' : 'rounded-full';
  if (src) return <img src={src} alt={name} className={`${cls} ${radius} object-cover shrink-0`} />;
  return (
    <div className={`${cls} ${radius} bg-gray-200 text-gray-600 font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
      status === 'active' ? 'bg-emerald-500' : status === 'suspended' ? 'bg-red-400' : 'bg-gray-300'
    }`} />
  );
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

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-[18px] font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
    </div>
  );
}

// ── Row Menu (portal-based) ───────────────────────────────────────────────────

interface RowMenuProps {
  member: OrgMember;
  isAdmin: boolean;
  onView: () => void;
  onMessage: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
}

function RowMenu({ member, isAdmin, onView, onMessage, onEdit, onSuspend, onActivate, onDelete }: RowMenuProps) {
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState({ top: 0, right: 0 });
  const btnRef            = useRef<HTMLButtonElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
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
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      onMouseDown={e => { e.stopPropagation(); onClick(); setOpen(false); }}
      className={`flex items-center gap-2 w-full px-3.5 py-2 text-[12.5px] text-left transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      {icon}{label}
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
          onMouseDown={e => e.stopPropagation()}
        >
          {item(<Eye size={13} />, 'View Profile', onView)}
          {item(<MessageSquare size={13} />, 'Message', onMessage)}
          {isAdmin && item(<Edit2 size={13} />, 'Edit Member', onEdit)}
          {isAdmin && member.status === 'active'    && item(<UserX size={13} />, 'Suspend', onSuspend, true)}
          {isAdmin && member.status === 'suspended' && item(<UserCheck size={13} />, 'Activate', onActivate)}
          {isAdmin && member.status === 'inactive'  && item(<UserCheck size={13} />, 'Activate', onActivate)}
          {isAdmin && <div className="h-px bg-gray-100 my-1" />}
          {isAdmin && item(<Trash2 size={13} />, 'Remove Access', onDelete, true)}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Member Grid Card ──────────────────────────────────────────────────────────

function GridCard({ member, isAdmin, onView, onMessage, onEdit, onSuspend, onActivate, onDelete }: {
  member: OrgMember;
  isAdmin: boolean;
  onView: () => void;
  onMessage: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const name = displayName(member);
  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all cursor-pointer relative"
      onClick={onView}
    >
      {/* Header band */}
      <div className="h-[72px] bg-gray-100" />

      {/* ⋮ menu */}
      <div className="absolute top-2.5 right-2.5 z-10" onClick={e => e.stopPropagation()}>
        <RowMenu member={member} isAdmin={isAdmin} onView={onView} onMessage={onMessage} onEdit={onEdit} onSuspend={onSuspend} onActivate={onActivate} onDelete={onDelete} />
      </div>

      {/* Avatar — overlaps header */}
      <div className="px-4 -mt-7">
        <div className="relative w-fit">
          <Avatar src={member.user.profile_picture} name={name} size="lg" square />
          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
            member.status === 'active' ? 'bg-emerald-500' : member.status === 'suspended' ? 'bg-red-400' : 'bg-gray-300'
          }`} />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-2.5 pb-4 space-y-3">
        {/* Name + role badge */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13.5px] font-bold text-gray-900 leading-snug">{name}</p>
            <span className="text-[9.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-gray-50 shrink-0">
              {member.role.name}
            </span>
          </div>
          {member.department_name && (
            <p className="text-[11.5px] text-gray-400 mt-0.5 truncate">{member.department_name}</p>
          )}
          <p className="text-[11px] text-gray-400 truncate">{member.user.email}</p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            member.status === 'active' ? 'bg-emerald-500' : member.status === 'suspended' ? 'bg-red-400' : 'bg-gray-300'
          }`} />
          <span className="text-[11.5px] text-gray-500">
            {member.status === 'active' ? 'Active member' : member.status === 'suspended' ? 'Suspended' : 'Inactive'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); onView(); }}
            className="flex-1 h-8 text-[12px] font-semibold text-gray-800 border border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            View Profile
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMessage(); }}
            className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          >
            <MessageSquare size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member List Row ───────────────────────────────────────────────────────────

function ListRow({ member, isAdmin, onView, onMessage, onEdit, onSuspend, onActivate, onDelete }: {
  member: OrgMember;
  isAdmin: boolean;
  onView: () => void;
  onMessage: () => void;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const name = displayName(member);
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={onView}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <Avatar src={member.user.profile_picture} name={name} size="sm" square />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${member.status === 'active' ? 'bg-emerald-500' : member.status === 'suspended' ? 'bg-red-400' : 'bg-gray-300'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-[10.5px] text-gray-400 truncate">{member.user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-[11.5px] text-gray-600">{member.role.name}</td>
      <td className="px-3 py-2 text-[11.5px] text-gray-500">{member.department_name ?? '—'}</td>
      <td className="px-3 py-2"><StatusPill status={member.status} /></td>
      <td className="px-3 py-2 text-[11px] text-gray-400">
        {new Date(member.joined_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <a href={`mailto:${member.user.email}`} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <Mail size={11} />
          </a>
          <button onClick={onMessage} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <MessageSquare size={11} />
          </button>
          <RowMenu member={member} isAdmin={isAdmin} onView={onView} onMessage={onMessage} onEdit={onEdit} onSuspend={onSuspend} onActivate={onActivate} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  );
}

// ── Profile Dialog ────────────────────────────────────────────────────────────

function ProfileDrawer({ member, profile, loading, isAdmin, onClose, onMessage }: {
  member: OrgMember;
  profile: OrgMemberProfile | null;
  loading: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onMessage: () => void;
}) {
  const name = displayName(member);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <p className="text-[13px] font-bold text-gray-900">Member Profile</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400">
            <X size={13} />
          </button>
        </div>

        {/* Identity */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar src={member.user.profile_picture} name={name} size="lg" square />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900 truncate">{name}</p>
              <p className="text-[12px] text-gray-500">{member.role.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusDot status={member.status} />
                <span className="text-[11px] text-gray-400 capitalize">{member.status}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <a
              href={`mailto:${member.user.email}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <Mail size={12} /> Email
            </a>
            <button
              onClick={onMessage}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <MessageSquare size={12} /> Message
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Details</p>
            <div className="space-y-2">
              {[
                { label: 'Email',       value: member.user.email },
                { label: 'Department',  value: member.department_name ?? '—' },
                { label: 'Role',        value: member.role.name },
                { label: 'Joined',      value: new Date(member.joined_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ...(isAdmin ? [{ label: 'Employee ID', value: member.employee_id || '—' }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-[11.5px] text-gray-400 shrink-0">{row.label}</span>
                  <span className="text-[11.5px] text-gray-700 font-medium text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {loading && (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => <div key={i} className="h-3.5 bg-gray-100 rounded animate-pulse" />)}
            </div>
          )}

          {!loading && profile && (
            <>
              {profile.skills.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.skills.map(s => (
                      <span key={s} className="px-2 py-0.5 text-[10.5px] font-medium bg-gray-100 text-gray-600 rounded-md">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {(profile.buddy || profile.manager) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Team</p>
                  <div className="space-y-1.5">
                    {profile.manager && (
                      <div className="flex items-center gap-2">
                        <Avatar src={profile.manager.profile_picture} name={profile.manager.display_name} size="sm" />
                        <div><p className="text-[11px] font-medium text-gray-700">{profile.manager.display_name}</p><p className="text-[10px] text-gray-400">Manager</p></div>
                      </div>
                    )}
                    {profile.buddy && (
                      <div className="flex items-center gap-2">
                        <Avatar src={profile.buddy.profile_picture} name={profile.buddy.display_name} size="sm" />
                        <div><p className="text-[11px] font-medium text-gray-700">{profile.buddy.display_name}</p><p className="text-[10px] text-gray-400">Buddy</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Member Profile Modal (member-safe 80% popup) ──────────────────────────────
function MemberProfileModal({
  member, profile, loading, onClose, onMessage,
}: {
  member: OrgMember;
  profile: OrgMemberProfile | null;
  loading: boolean;
  onClose: () => void;
  onMessage: () => void;
}) {
  const name = displayName(member);
  const joined = new Date(member.joined_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '80vw', maxWidth: '1100px', height: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-5 px-8 py-5 border-b border-gray-100">
          <Avatar src={member.user.profile_picture} name={name} size="lg" square />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <p className="text-[20px] font-bold text-gray-900 truncate">{name}</p>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 shrink-0">
                {member.role.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <StatusDot status={member.status} />
                <span className="text-[12px] text-gray-400 capitalize">{member.status}</span>
              </div>
            </div>
            <p className="text-[13px] text-gray-400 mt-0.5">{member.user.email}</p>
            {member.department_name && (
              <p className="text-[12px] text-gray-400 mt-0.5">{member.department_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`mailto:${member.user.email}`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <Mail size={13} /> Email
            </a>
            <button
              onClick={onMessage}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <MessageSquare size={13} /> Message
            </button>
            <button
              onClick={onClose}
              className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left sidebar */}
          <div className="w-72 shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto px-6 py-6 space-y-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Details</p>
              <div className="space-y-3">
                {[
                  { label: 'Department', value: member.department_name ?? '—' },
                  { label: 'Role',       value: member.role.name },
                  { label: 'Joined',     value: joined },
                  { label: 'Status',     value: <span className="capitalize">{member.status}</span> },
                ].map(row => (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] text-gray-400">{row.label}</span>
                    <span className="text-[12.5px] font-semibold text-gray-800">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-gray-400 shrink-0" />
                  <a href={`mailto:${member.user.email}`} className="text-[12px] text-teal-600 hover:underline truncate">
                    {member.user.email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-6 space-y-8">

            {loading && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded-lg animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
                ))}
              </div>
            )}

            {!loading && profile && (
              <>
                {/* Skills */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Skills</p>
                  {profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map(s => (
                        <span key={s} className="px-3 py-1 text-[12px] font-medium bg-gray-100 text-gray-700 rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-gray-400 italic">No skills listed yet.</p>
                  )}
                </div>

                {/* Team */}
                {(profile.buddy || profile.manager) && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Team</p>
                    <div className="grid grid-cols-2 gap-4">
                      {profile.manager && (
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <Avatar src={profile.manager.profile_picture} name={profile.manager.display_name} size="md" />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-gray-800 truncate">{profile.manager.display_name}</p>
                            <p className="text-[11px] text-gray-400">Manager</p>
                          </div>
                        </div>
                      )}
                      {profile.buddy && (
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <Avatar src={profile.buddy.profile_picture} name={profile.buddy.display_name} size="md" />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-gray-800 truncate">{profile.buddy.display_name}</p>
                            <p className="text-[11px] text-gray-400">Buddy</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Profile completion */}
                {profile.profile_completion_pct !== undefined && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Profile Completion</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-all"
                          style={{ width: `${profile.profile_completion_pct}%` }}
                        />
                      </div>
                      <span className="text-[12.5px] font-semibold text-gray-700 shrink-0">{profile.profile_completion_pct}%</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {!loading && !profile && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={36} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400">No extended profile data available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}



function AddMemberModal({ roles, departments, onClose, onAdded }: {
  roles: InternalRole[];
  departments: Department[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<{ id: number; username: string; email: string; display_name: string; role: string; profile_picture: string | null }[]>([]);
  const [selected, setSelected] = useState<typeof results[0] | null>(null);
  const [roleId,   setRoleId]   = useState('');
  const [deptId,   setDeptId]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [searching, setSearching] = useState(false);
  const [msg,      setMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    const ctrl = new AbortController();
    fetch(`/api/org/search-users/?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${tokens.getAccess()}` },
        signal: ctrl.signal,
      })
      .then(r => r.json())
      .then(setResults)
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctrl.abort();
  }, [query]);

  const handleSubmit = async () => {
    if (!selected || !roleId) { setMsg({ ok: false, text: 'Select a user and a role.' }); return; }
    setSaving(true); setMsg(null);
    try {
      await orgApi.grantAccess(selected.id, Number(roleId), '', deptId ? Number(deptId) : null);
      onAdded();
    } catch {
      setMsg({ ok: false, text: 'Failed to add member. Please try again.' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[460px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-900">Add Portal Member</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400"><X size={13} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!selected ? (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search User</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className={`${inputCls} pl-8`}
                  placeholder="Name, username or email…"
                  autoFocus
                />
              </div>
              {searching && <p className="text-[11.5px] text-gray-400 mt-1.5">Searching…</p>}
              {results.length > 0 && (
                <div className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                  {results.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <Avatar src={u.profile_picture} name={u.display_name} size="sm" />
                      <div><p className="text-[12.5px] font-medium text-gray-800">{u.display_name}</p><p className="text-[11px] text-gray-400">@{u.username} · {u.email}</p></div>
                    </button>
                  ))}
                </div>
              )}
              {query.length >= 2 && !searching && results.length === 0 && (
                <p className="text-[11.5px] text-gray-400 mt-1.5">No users found.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2.5">
                <Avatar src={selected.profile_picture} name={selected.display_name} size="sm" />
                <div><p className="text-[12.5px] font-semibold text-gray-800">{selected.display_name}</p><p className="text-[11px] text-gray-400">{selected.email}</p></div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
            <div className="relative">
              <select value={roleId} onChange={e => setRoleId(e.target.value)} className={`${selectCls} w-full`}>
                <option value="">Select a role…</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Department <span className="text-gray-300 font-normal normal-case">(optional)</span></label>
            <div className="relative">
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className={`${selectCls} w-full`}>
                <option value="">No department</option>
                {departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {msg && (
            <p className={`text-[12px] px-3 py-1.5 rounded-lg border ${msg.ok ? 'text-gray-800 bg-gray-50 border-gray-200' : 'text-red-600 bg-red-50 border-red-100'}`}>
              {msg.ok && <Check size={11} className="inline mr-1" />}{msg.text}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !selected || !roleId} className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Member Modal ─────────────────────────────────────────────────────────

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
      setMsg({ ok: true, text: 'Member updated successfully.' });
      setTimeout(onSaved, 700);
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
            <Avatar src={member.user.profile_picture} name={name} size="sm" square />
            <div><p className="text-[12.5px] font-semibold text-gray-800">{name}</p><p className="text-[11px] text-gray-400">{member.user.email}</p></div>
          </div>
          {[
            { label: 'Role', val: roleId, set: setRoleId, opts: roles.map(r => ({ v: String(r.id), l: r.name })) },
            { label: 'Department', val: deptId, set: setDeptId, opts: [{ v: '', l: 'No department' }, ...departments.filter(d => d.is_active).map(d => ({ v: String(d.id), l: d.name }))] },
            { label: 'Status', val: status, set: (v: string) => setStatus(v as OrgMember['status']), opts: [{ v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }, { v: 'suspended', l: 'Suspended' }] },
          ].map(({ label, val, set, opts }) => (
            <div key={label}>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
              <div className="relative">
                <select value={val} onChange={e => set(e.target.value)} className={`${selectCls} w-full`}>
                  {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          ))}
          {msg && <p className={`text-[12px] px-3 py-1.5 rounded-lg border ${msg.ok ? 'text-gray-800 bg-gray-50 border-gray-200' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.ok && <Check size={11} className="inline mr-1" />}{msg.text}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({ member, onClose, onDeleted }: {
  member: OrgMember;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const name = displayName(member);

  const handleDelete = async () => {
    setSaving(true);
    try { await orgApi.revokeAccess(member.id); onDeleted(); }
    catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[380px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-900">Remove Portal Access?</p>
            <p className="text-[12px] text-gray-500 mt-0.5"><span className="font-semibold">{name}</span> will lose access to the portal.</p>
          </div>
        </div>
        <div className="flex gap-2.5 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-[12.5px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={saving} className="flex-1 px-3 py-2 text-[12.5px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors">{saving ? 'Removing…' : 'Remove Access'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="h-8 bg-gray-50 border-b border-gray-100" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-gray-100">
            <div className="w-6 h-6 rounded-full bg-gray-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1"><div className="h-2.5 bg-gray-100 rounded w-28 animate-pulse" /><div className="h-2 bg-gray-100 rounded w-40 animate-pulse" /></div>
            <div className="h-2.5 bg-gray-100 rounded w-16 animate-pulse" />
            <div className="h-2.5 bg-gray-100 rounded w-16 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
          <div className="h-2.5 bg-gray-100 rounded w-16 animate-pulse" />
          <div className="h-7 bg-gray-100 rounded-lg w-full animate-pulse mt-1" />
        </div>
      ))}
    </div>
  );
}

// ── Sort Select ───────────────────────────────────────────────────────────────

type SortKey = 'name-asc' | 'name-desc' | 'role-asc' | 'joined-desc' | 'joined-asc' | 'dept-asc';

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: 'name-asc',    label: 'Name A–Z' },
  { value: 'name-desc',   label: 'Name Z–A' },
  { value: 'role-asc',    label: 'Role A–Z' },
  { value: 'dept-asc',    label: 'Department A–Z' },
  { value: 'joined-desc', label: 'Newest First' },
  { value: 'joined-asc',  label: 'Oldest First' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrgDirectory() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;
  const navigate = useNavigate();
  const location = useLocation();
  const fromAnalytics = (location.state as { from?: string } | null)?.from === 'analytics';

  const [members,     setMembers]     = useState<OrgMember[]>([]);
  const [stats,       setStats]       = useState<MemberStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles,       setRoles]       = useState<InternalRole[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [exporting,   setExporting]   = useState(false);

  // Filters
  const [search,       setSearch]       = useState('');
  const [deptFilter,   setDeptFilter]   = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('name-asc');
  const [view,         setView]         = useState<'grid' | 'list'>('list');
  const [page,         setPage]         = useState(1);

  // Drawer
  const [drawerMember,  setDrawerMember]  = useState<OrgMember | null>(null);
  const [drawerProfile, setDrawerProfile] = useState<OrgMemberProfile | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Member profile modal (non-admin)
  const [profileModalMember,  setProfileModalMember]  = useState<OrgMember | null>(null);
  const [profileModalData,    setProfileModalData]    = useState<OrgMemberProfile | null>(null);
  const [profileModalLoading, setProfileModalLoading] = useState(false);

  const openProfileModal = (m: OrgMember) => {
    setProfileModalMember(m);
    setProfileModalData(null);
    setProfileModalLoading(true);
    orgApi.getMemberProfile(m.id)
      .then(p => setProfileModalData(p))
      .catch(() => {})
      .finally(() => setProfileModalLoading(false));
  };

  // Modals
  const [showAdd,    setShowAdd]    = useState(false);
  const [editTarget, setEditTarget] = useState<OrgMember | null>(null);
  const [delTarget,  setDelTarget]  = useState<OrgMember | null>(null);

  const load = () => {
    setLoading(true);
    const p2 = isAdmin ? membersStatsApi.getStats().catch(() => null) : Promise.resolve(null);
    Promise.all([
      orgApi.getMembers(),
      p2,
      orgApi.getDepartments().catch(() => [] as Department[]),
      orgApi.getRoles().catch(() => [] as InternalRole[]),
    ]).then(([mbs, st, depts, rls]) => {
      setMembers(mbs);
      if (st) setStats(st);
      setDepartments(depts);
      setRoles(rls);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [isAdmin]);

  // Open drawer
  const openDrawer = async (m: OrgMember) => {
    setDrawerMember(m);
    setDrawerProfile(null);
    setDrawerLoading(true);
    try {
      const p = await orgApi.getMemberProfile(m.id);
      setDrawerProfile(p);
    } catch { /* ignore */ }
    finally { setDrawerLoading(false); }
  };

  // Handle actions
  const handleMessage = (m: OrgMember) => navigate(`/org/chat?dm=${m.user.id}`);

  const handleSuspend = async (m: OrgMember) => {
    try { await orgApi.updateMember(m.id, { status: 'suspended' }); load(); } catch { /* ignore */ }
  };
  const handleActivate = async (m: OrgMember) => {
    try { await orgApi.updateMember(m.id, { status: 'active' }); load(); } catch { /* ignore */ }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await orgApi.exportMembers(); } catch { /* ignore */ }
    finally { setExporting(false); }
  };

  // Filtering + sorting
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m => {
      const name = displayName(m).toLowerCase();
      const matchSearch = !q ||
        name.includes(q) ||
        m.role.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        (m.department_name ?? '').toLowerCase().includes(q);
      const matchDept   = !deptFilter   || departments.find(d => String(d.id) === deptFilter)?.name === m.department_name;
      const matchRole   = !roleFilter   || String(m.role.id) === roleFilter;
      const matchStatus = !statusFilter || m.status === statusFilter;
      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [members, search, deptFilter, roleFilter, statusFilter, departments]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name-asc':    return displayName(a).localeCompare(displayName(b));
        case 'name-desc':   return displayName(b).localeCompare(displayName(a));
        case 'role-asc':    return a.role.name.localeCompare(b.role.name);
        case 'dept-asc':    return (a.department_name ?? '').localeCompare(b.department_name ?? '');
        case 'joined-desc': return new Date(b.joined_date).getTime() - new Date(a.joined_date).getTime();
        case 'joined-asc':  return new Date(a.joined_date).getTime() - new Date(b.joined_date).getTime();
        default:            return 0;
      }
    });
  }, [filtered, sortKey]);

  const perPage = view === 'grid' ? GRID_PER_PAGE : LIST_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const clearFilters = () => { setSearch(''); setDeptFilter(''); setRoleFilter(''); setStatusFilter(''); setPage(1); };
  const hasFilters = search || deptFilter || roleFilter || statusFilter;

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, deptFilter, roleFilter, statusFilter, sortKey, view]);

  const commonRowActions = (m: OrgMember) => ({
    onView:     () => isAdmin ? navigate(`/org/members/${m.id}`) : openProfileModal(m),
    onMessage:  () => handleMessage(m),
    onEdit:     () => setEditTarget(m),
    onSuspend:  () => handleSuspend(m),
    onActivate: () => handleActivate(m),
    onDelete:   () => setDelTarget(m),
  });

  return (
    <div className="space-y-3">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {isAdmin && (
            <nav className="flex items-center gap-1 mb-1.5 text-[11.5px]" aria-label="Breadcrumb">
              <button
                onClick={() => navigate(fromAnalytics ? '/org/analytics' : '/org/members')}
                className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                {fromAnalytics ? 'Reports & Analytics' : 'Users & Roles'}
              </button>
              <ChevronRight size={11} className="text-gray-300" />
              <span className="font-semibold text-gray-900">People Fingerprint</span>
            </nav>
          )}
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900">People Directory</h1>
            <PageHelp title="How the People Directory Works" sections={DIRECTORY_HELP} />
          </div>
          <p className="text-[12px] text-gray-400 mt-0.5">Browse and search your organisation's members</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Download size={13} />{exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, role, department or email…"
            className={`${inputCls} pl-8`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={`${selectCls} min-w-[130px]`}>
              <option value="">All Departments</option>
              {departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={`${selectCls} min-w-[110px]`}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${selectCls} min-w-[110px]`}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Sort + View Toggle */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-gray-400">
          Showing <span className="font-semibold text-gray-600">{Math.min((page - 1) * perPage + 1, sorted.length)}</span> – <span className="font-semibold text-gray-600">{Math.min(page * perPage, sorted.length)}</span> of <span className="font-semibold text-gray-600">{sorted.length}</span> member{sorted.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-gray-400 hidden sm:block">Sort by:</span>
            <div className="relative">
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className={`${selectCls} text-[11.5px] min-w-[110px]`}>
                {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setView('grid')} className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
              <Grid3x3 size={13} />
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Skeleton view={view} />
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <Users size={22} className="text-gray-400" />
          </div>
          <p className="text-[13.5px] font-semibold text-gray-700">
            {hasFilters ? 'No members match your filters' : 'No members yet'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginated.map(m => (
            <GridCard key={m.id} member={m} isAdmin={isAdmin} {...commonRowActions(m)} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden min-h-[500px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Member</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Role</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Department</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginated.map(m => (
                <ListRow key={m.id} member={m} isAdmin={isAdmin} {...commonRowActions(m)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<(number | '…')[]>((acc, n, i, arr) => {
              if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…');
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === '…'
                ? <span key={`e${i}`} className="text-[12px] text-gray-300 px-0.5">…</span>
                : <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={`w-7 h-7 text-[12px] font-semibold rounded-lg transition-colors ${page === n ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >{n}</button>
            )
          }
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Add Member Modal */}
      {showAdd && isAdmin && (
        <AddMemberModal
          roles={roles}
          departments={departments}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load(); }}
        />
      )}

      {/* Edit Member Modal */}
      {editTarget && isAdmin && (
        <EditMemberModal
          member={editTarget}
          roles={roles}
          departments={departments}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}

      {/* Confirm Delete Modal */}
      {delTarget && isAdmin && (
        <ConfirmDeleteModal
          member={delTarget}
          onClose={() => setDelTarget(null)}
          onDeleted={() => { setDelTarget(null); load(); }}
        />
      )}

      {/* Member Profile Modal (non-admin view) */}
      {profileModalMember && !isAdmin && (
        <MemberProfileModal
          member={profileModalMember}
          profile={profileModalData}
          loading={profileModalLoading}
          onClose={() => setProfileModalMember(null)}
          onMessage={() => { setProfileModalMember(null); handleMessage(profileModalMember); }}
        />
      )}
    </div>
  );
}
