import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Shield, Clock, Download, Settings,
  UserPlus, Search, SlidersHorizontal, X, Check, ChevronDown,
  MoreHorizontal, UserMinus, MessageSquare, UserCog, Copy,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, Mail, Eye,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useApi, useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { WorkspaceMembership, WorkspaceMembers, UserSearchResult, WorkspaceMentorItem } from '../../types';
import { relativeTime } from '../../utils/time';
import Avatar from '../../components/ui/Avatar';

// ── Portal Dropdown ──────────────────────────────────────────────────────────

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  closeOnClick?: boolean;
}

function Dropdown({ trigger, children, align = 'left', closeOnClick = true }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        ...(align === 'right'
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
        zIndex: 9999,
      });
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen} className="inline-flex">
        {trigger}
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]"
          onClick={closeOnClick ? () => setOpen(false) : undefined}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

function DropdownItem({ onClick, icon, label, danger }: {
  onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ── Activity Bar Chart ───────────────────────────────────────────────────────

function ActivityBarChart({ memberships }: { memberships: WorkspaceMembership[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0, 0];
    memberships.forEach(m => {
      if (m.approved_at) {
        const d = new Date(m.approved_at).getDay();
        const idx = d === 0 ? 6 : d - 1;
        c[idx]++;
      }
    });
    return c;
  }, [memberships]);

  const maxVal = Math.max(...counts, 1);
  const barWidth = 22;
  const chartH = 52;
  const gap = 8;
  const totalW = days.length * (barWidth + gap) - gap;

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 16}`} className="w-full" style={{ height: chartH + 16 }}>
      {counts.map((val, i) => {
        const barH = Math.max((val / maxVal) * chartH, 3);
        const x = i * (barWidth + gap);
        const y = chartH - barH;
        const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH}
              rx={3} ry={3}
              fill={isToday ? '#cf6535' : '#f0c9a8'}
            />
            <text x={x + barWidth / 2} y={chartH + 12} textAnchor="middle"
              fontSize={8} fill="#9ca3af" fontFamily="system-ui">
              {days[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Admin Badge ───────────────────────────────────────────────────────────────

function AdminBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-100 text-primary-700">
      <Shield size={10} /> Admin
    </span>
  );
}

// ── Member Badge ──────────────────────────────────────────────────────────────

function MemberBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
      <Users size={10} /> Member
    </span>
  );
}

// ── Mentor Badge ──────────────────────────────────────────────────────────────

function MentorBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-100 text-primary-700">
      <UserCog size={10} /> Mentor
    </span>
  );
}

// ── Shared column widths ──────────────────────────────────────────────────────

const CC = {
  check:   'w-7 shrink-0',
  member:  'flex-1 min-w-0',
  badge:   'w-28 shrink-0',
  uni:     'w-32 shrink-0',
  joined:  'w-[108px] shrink-0',
  status:  'w-[82px] shrink-0',
  active:  'w-[84px] shrink-0',
  actions: 'w-8 shrink-0 flex justify-end',
};

// ── Status Dot ───────────────────────────────────────────────────────────────

function isActive(lastActive?: string | null) {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 30 * 24 * 60 * 60 * 1000;
}

// ── Member Row ───────────────────────────────────────────────────────────────

interface MemberRowProps {
  m: WorkspaceMembership;
  isOwner: boolean;
  checked: boolean;
  onCheck: (id: number, val: boolean) => void;
  onAction: (action: 'remove' | 'message' | 'profile', m: WorkspaceMembership) => void;
}

function MemberRow({ m, isOwner, checked, onCheck, onAction }: MemberRowProps) {
  const u = m.student.user;
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
  const uni = m.student.university || '—';
  const country = m.student.city || '';
  const joinDate = m.approved_at
    ? new Date(m.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const active = isActive(m.last_active);
  const lastSeen = m.last_active ? relativeTime(m.last_active) : 'Never';

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2 hover:shadow-sm hover:border-gray-300 transition-all">
      <div className={CC.check}>
        {isOwner && (
          <input type="checkbox" checked={checked}
            onChange={e => onCheck(m.id, e.target.checked)}
            className="accent-primary-600 w-3.5 h-3.5 cursor-pointer" />
        )}
      </div>
      <div className={`${CC.member} flex items-center gap-3`}>
        <Avatar src={m.student.profile_picture} name={fullName} size="sm" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 truncate">{fullName}</p>
          <p className="text-[11.5px] text-gray-400 truncate">{u.email}</p>
        </div>
      </div>
      <div className={CC.badge}>
        <MemberBadge />
      </div>
      <div className={CC.uni}>
        <p className="text-[12px] text-gray-700 truncate">{uni}</p>
        {country && <p className="text-[11px] text-gray-400 truncate">{country}</p>}
      </div>
      <div className={CC.joined}>
        <span className="text-[12px] text-gray-600">{joinDate}</span>
      </div>
      <div className={CC.status}>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-[12px] text-gray-600">{active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      <div className={CC.active}>
        <span className="text-[12px] text-gray-500">{lastSeen}</span>
      </div>
      <div className={CC.actions}>
        <Dropdown
          align="right"
          trigger={
            <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <MoreHorizontal size={15} />
            </button>
          }
        >
          <DropdownItem onClick={() => onAction('profile', m)} icon={<Users size={13} />} label="View profile" />
          <DropdownItem onClick={() => onAction('message', m)} icon={<MessageSquare size={13} />} label="Send message" />
          {isOwner && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <DropdownItem onClick={() => onAction('remove', m)} icon={<UserMinus size={13} />} label="Remove member" danger />
            </>
          )}
        </Dropdown>
      </div>
    </div>
  );
}

// ── Owner Synthetic Row ──────────────────────────────────────────────────────

function OwnerRow({ workspace, isYou, onNavigate }: {
  workspace: { mentor_name: string; mentor_picture?: string; mentor_id: number; mentor_user_id: number };
  isYou: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="bg-primary-50/60 border border-primary-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
      <div className={CC.check}>
        <input type="checkbox" disabled className="opacity-30 w-3.5 h-3.5" />
      </div>
      <div className={`${CC.member} flex items-center gap-3`}>
        <Avatar src={workspace.mentor_picture} name={workspace.mentor_name} size="sm" />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-gray-900">{workspace.mentor_name}</p>
            {isYou && <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full">You</span>}
          </div>
          <p className="text-[11.5px] text-gray-400">Workspace owner</p>
        </div>
      </div>
      <div className={CC.badge}><AdminBadge /></div>
      <div className={CC.uni}><span className="text-[12px] text-gray-400">—</span></div>
      <div className={CC.joined}><span className="text-[12px] text-gray-400">—</span></div>
      <div className={CC.status}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[12px] text-gray-600">Active</span>
        </div>
      </div>
      <div className={CC.active}><span className="text-[12px] text-gray-400">—</span></div>
      <div className={CC.actions}>
        <Dropdown
          align="right"
          trigger={
            <button className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/70 transition-colors">
              <MoreHorizontal size={15} />
            </button>
          }
        >
          <DropdownItem onClick={() => onNavigate(`/profiles/${workspace.mentor_user_id}`)} icon={<Users size={13} />} label="View profile" />
          {!isYou && (
            <DropdownItem onClick={() => onNavigate(`/messages/${workspace.mentor_user_id}`)} icon={<MessageSquare size={13} />} label="Send message" />
          )}
        </Dropdown>
      </div>
    </div>
  );
}

// ── Pending Row ──────────────────────────────────────────────────────────────

function PendingRow({ m, onApprove, onReject, approving, rejecting }: {
  m: WorkspaceMembership;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const u = m.student.user;
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
  const reqDate = m.requested_at
    ? new Date(m.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2 hover:shadow-sm hover:border-gray-300 transition-all">
      <div className={CC.check}>
        <input type="checkbox" className="accent-primary-600 w-3.5 h-3.5 cursor-pointer" />
      </div>
      <div className={`${CC.member} flex items-center gap-3`}>
        <Avatar src={m.student.profile_picture} name={fullName} size="sm" />
        <div>
          <p className="text-[13px] font-semibold text-gray-900">{fullName}</p>
          <p className="text-[11.5px] text-gray-400">{u.email}</p>
        </div>
      </div>
      <div className={CC.badge}>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
          <Clock size={10} /> Pending
        </span>
      </div>
      <div className={CC.uni}><span className="text-[12px] text-gray-600">{m.student.university || '—'}</span></div>
      <div className={CC.joined}><span className="text-[12px] text-gray-600">{reqDate}</span></div>
      <div className={CC.status}><span className="text-[12px] text-gray-400">—</span></div>
      <div className={CC.active}><span className="text-[12px] text-gray-400">—</span></div>
      <div className={CC.actions}>
        <div className="flex items-center gap-1">
          <button onClick={onApprove} disabled={approving || rejecting}
            className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50 transition-colors" title="Approve">
            {approving ? <Clock size={12} /> : <Check size={12} />}
          </button>
          <button onClick={onReject} disabled={approving || rejecting}
            className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 transition-colors" title="Reject">
            {rejecting ? <Clock size={12} /> : <X size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type TabType = 'all' | 'admin' | 'pending' | 'invited' | 'mentors';

const PAGE_SIZE = 10;

export default function WorkspaceMembersPage() {
  const { workspace, isOwner, isMentor } = useWorkspace();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, loading, refetch } = useApi<WorkspaceMembers>(
    () => workspacesApi.getMembers(workspace.id),
    [workspace.id],
  );

  const { data: mentors, refetch: refetchGuests } = useApiList<WorkspaceMentorItem>(
    () => workspacesApi.getMentors(workspace.id),
    [workspace.id],
  );

  const approved = data?.approved ?? [];
  const pending  = data?.pending  ?? [];
  const invited  = data?.invited  ?? [];
  const [inviteQuery, setInviteQuery]         = useState('');
  const [inviteResults, setInviteResults]     = useState<UserSearchResult[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteLoading, setInviteLoading]     = useState<number | null>(null);
  const [inviteError, setInviteError]         = useState('');
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInviteSearch = (q: string) => {
    setInviteQuery(q);
    setInviteError('');
    if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    if (q.trim().length < 2) { setInviteResults([]); return; }
    inviteTimerRef.current = setTimeout(async () => {
      setInviteSearching(true);
      try {
        const res = await workspacesApi.searchUsers(workspace.id, q.trim());
        setInviteResults(res ?? []);
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        setInviteError(`Search failed (${status ?? 'network error'}). Check console.`);
        console.error('searchUsers error:', err);
      } finally {
        setInviteSearching(false);
      }
    }, 300);
  };

  const handleDirectInvite = async (userId: number) => {
    setInviteLoading(userId);
    setInviteError('');
    try {
      await apiClient.initCsrf();
      await workspacesApi.directInvite(workspace.id, userId);
      setInviteResults(r => r.filter(u => u.user_id !== userId));
      setInviteQuery('');
      refetch();
    } catch {
      setInviteError('Failed to send invitation. Please try again.');
    } finally {
      setInviteLoading(null);
    }
  };

  // ── Mentor invite state ──
  const [mentorQuery, setMentorQuery]         = useState('');
  const [mentorResults, setMentorResults]     = useState<UserSearchResult[]>([]);
  const [mentorSearching, setMentorSearching] = useState(false);
  const [mentorInviteLoading, setMentorInviteLoading] = useState<number | null>(null);
  const [mentorInviteError, setMentorInviteError]     = useState('');
  const [removingGuestId, setRemovingGuestId]             = useState<number | null>(null);
  const [confirmInviteUser, setConfirmInviteUser]         = useState<UserSearchResult | null>(null);
  const [confirmRemoveGuest, setConfirmRemoveGuest]       = useState<{ id: number; name: string; isCancel: boolean } | null>(null);
  const [inviteModalOpen, setInviteModalOpen]             = useState(false);
  const mentorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMentorSearch = (q: string) => {
    setMentorQuery(q);
    setMentorInviteError('');
    if (mentorTimerRef.current) clearTimeout(mentorTimerRef.current);
    if (q.trim().length < 2) { setMentorResults([]); return; }
    mentorTimerRef.current = setTimeout(async () => {
      setMentorSearching(true);
      try {
        const res = await workspacesApi.searchMentors(workspace.id, q.trim());
        setMentorResults(res ?? []);
      } catch {
        setMentorInviteError('Search failed. Please try again.');
      } finally {
        setMentorSearching(false);
      }
    }, 300);
  };

  const handleInviteMentor = async (userId: number) => {
    setMentorInviteLoading(userId);
    setMentorInviteError('');
    try {
      await apiClient.initCsrf();
      await workspacesApi.inviteMentor(workspace.id, userId);
      setMentorResults(r => r.filter(u => u.user_id !== userId));
      setMentorQuery('');
      refetchGuests();
    } catch {
      setMentorInviteError('Failed to send mentor invitation. Please try again.');
    } finally {
      setMentorInviteLoading(null);
    }
  };

  const handleRemoveMentor = async (guestId: number) => {
    setRemovingGuestId(guestId);
    try {
      await apiClient.initCsrf();
      await workspacesApi.removeMentor(workspace.id, guestId);
      refetchGuests();
    } catch {
      // silently ignore
    } finally {
      setRemovingGuestId(null);
    }
  };

  // ── UI state ──
  const [tab, setTab]           = useState<TabType>('all');
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [uniFilter, setUni]     = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'admin' | 'mentor' | 'member'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage]         = useState(1);
  const [copied, setCopied]     = useState(false);

  // ── Action states ──
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});

  // ── Derived stats ──
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const totalCount   = 1 + approved.length;
  const newThisMonth = approved.filter(m => m.approved_at && m.approved_at >= monthStart).length;

  // ── Universities list ──
  const universities = useMemo(() =>
    ['all', ...Array.from(new Set(approved.map(m => m.student.university).filter(Boolean) as string[]))],
    [approved],
  );

  // ── Filtered list ──
  const filteredApproved = useMemo(() => {
    let list = approved;

    if (tab === 'admin') list = []; // owner row is shown via OwnerRow, not from approved list
    else if (tab === 'pending') list = [];
    else if (tab === 'invited') list = [];
    else if (tab === 'mentors') list = [];
    else if (tab === 'all' && typeFilter === 'mentor') list = [];
    else if (tab === 'all' && typeFilter === 'admin') list = [];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => {
        const u = m.student.user;
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase();
        return name.includes(q) || u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) || (m.student.university || '').toLowerCase().includes(q);
      });
    }
    if (uniFilter  !== 'all') list = list.filter(m => m.student.university === uniFilter);
    if (statusFilter !== 'all') {
      list = list.filter(m => statusFilter === 'active' ? isActive(m.last_active) : !isActive(m.last_active));
    }
    if (dateFrom) list = list.filter(m => m.approved_at && m.approved_at >= dateFrom);
    if (dateTo)   list = list.filter(m => m.approved_at && m.approved_at <= dateTo + 'T23:59:59');

    return list;
  }, [approved, tab, search, uniFilter, statusFilter, dateFrom, dateTo, typeFilter]);

  const filteredPending = useMemo(() => {
    if (!search) return pending;
    const q = search.toLowerCase();
    return pending.filter(m => {
      const u = m.student.user;
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [pending, search]);

  const filteredMentors = useMemo(() => {
    let list = mentors.filter(g => g.status === 'active');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g => g.mentor_name.toLowerCase().includes(q));
    }
    return list;
  }, [mentors, search]);

  // Show admin row only on "all" and "admin" tabs, and only when type filter allows it
  const showOwnerRow = (tab === 'all' || tab === 'admin') && (typeFilter === 'all' || typeFilter === 'admin');
  const ownerOffset  = showOwnerRow ? 1 : 0;

  const tableRows = tab === 'pending' ? filteredPending : (tab === 'invited' || tab === 'mentors') ? [] : filteredApproved;
  const activeMentorCount = mentors.filter(g => g.status === 'active').length;
  const totalRows = (
    tab === 'invited' ? invited.length :
    tab === 'mentors' ? mentors.length :
    tableRows.length + (tab === 'all' && (typeFilter === 'all' || typeFilter === 'mentor') ? filteredMentors.length : 0)
  ) + (showOwnerRow ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pagedOwnerRow = showOwnerRow && safePage === 1;
  const approvedStart = Math.max(0, (safePage - 1) * PAGE_SIZE - ownerOffset);
  const approvedEnd   = approvedStart + PAGE_SIZE - (pagedOwnerRow ? ownerOffset : 0);
  const pagedRows     = tableRows.slice(approvedStart, approvedEnd);

  const showingFrom = (safePage - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(safePage * PAGE_SIZE, totalRows);

  // ── Actions ──
  const handleMemberAction = useCallback(async (membershipId: number, action: 'approve' | 'reject' | 'remove') => {
    setActionLoading(prev => ({ ...prev, [membershipId]: action }));
    try {
      await apiClient.initCsrf();
      await workspacesApi.memberAction(workspace.id, membershipId, action);
      refetch();
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[membershipId]; return n; });
    }
  }, [workspace.id, refetch]);

  const handleRowAction = useCallback((action: 'remove' | 'message' | 'profile', m: WorkspaceMembership) => {
    if (action === 'remove') handleMemberAction(m.id, 'remove');
    else if (action === 'message') navigate(`/messages/${m.student.user.id}`);
    else if (action === 'profile') navigate(`/profiles/${m.student.user.id}`);
  }, [handleMemberAction, navigate]);

  // ── Bulk select ──
  const toggleSelect = (id: number, val: boolean) =>
    setSelected(prev => { const s = new Set(prev); val ? s.add(id) : s.delete(id); return s; });
  const selectAll = () => setSelected(new Set(pagedRows.map(m => m.id)));
  const clearSelect = () => setSelected(new Set());
  const allChecked = pagedRows.length > 0 && pagedRows.every(m => selected.has(m.id));

  // ── Export CSV ──
  const handleExport = () => {
    const rows = [
      ['Name', 'Email', 'University', 'Country', 'Joined'],
      ...approved.map(m => {
        const u = m.student.user;
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
        return [
          name, u.email, m.student.university || '', m.student.city || '',
          m.approved_at ? new Date(m.approved_at).toLocaleDateString() : '',
        ];
      }),
    ];
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
    URL.revokeObjectURL(url);
  };


  // ── Clear filters ──
  const hasFilters = search || statusFilter !== 'all' || uniFilter !== 'all' || dateFrom || dateTo || typeFilter !== 'all';
  const clearFilters = () => {
    setSearch(''); setStatus('all'); setUni('all'); setDateFrom(''); setDateTo(''); setTypeFilter('all');
  };

  const tabs: { key: TabType; label: string; count: number }[] = isMentor
    ? [
        { key: 'all',       label: 'All members',  count: 1 + approved.length + activeMentorCount },
      ]
    : [
        { key: 'all',       label: 'All members',    count: 1 + approved.length + activeMentorCount },
        { key: 'admin',     label: 'Admins',         count: 1 },
        { key: 'pending',   label: 'Pending invites', count: pending.length },
        ...(workspace.privacy === 'private' && isOwner ? [{ key: 'invited' as TabType, label: 'Invited', count: invited.length }] : []),
        ...(isOwner ? [{ key: 'mentors' as TabType, label: 'Mentors', count: mentors.length }] : []),
      ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Confirm invite dialog */}
      {confirmInviteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <p className="text-[15px] font-bold text-gray-900 mb-1">Send mentor invite?</p>
            <p className="text-[13px] text-gray-500 mb-5">
              <span className="font-semibold text-gray-700">{confirmInviteUser.display_name}</span> will receive an invitation to join this workspace as a mentor.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { handleInviteMentor(confirmInviteUser.user_id); setConfirmInviteUser(null); }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                Send invite
              </button>
              <button
                onClick={() => setConfirmInviteUser(null)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-[13px] font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm remove/cancel dialog */}
      {confirmRemoveGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <p className="text-[15px] font-bold text-gray-900 mb-1">
              {confirmRemoveGuest.isCancel ? 'Cancel invite?' : 'Remove mentor?'}
            </p>
            <p className="text-[13px] text-gray-500 mb-5">
              {confirmRemoveGuest.isCancel
                ? <>The invitation to <span className="font-semibold text-gray-700">{confirmRemoveGuest.name}</span> will be cancelled.</>
                : <><span className="font-semibold text-gray-700">{confirmRemoveGuest.name}</span> will lose access to this workspace.</>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { handleRemoveMentor(confirmRemoveGuest.id); setConfirmRemoveGuest(null); }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                {confirmRemoveGuest.isCancel ? 'Cancel invite' : 'Remove'}
              </button>
              <button
                onClick={() => setConfirmRemoveGuest(null)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-[13px] font-semibold rounded-xl transition-colors"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Users size={20} className="text-primary-600" />
            <h1 className="text-[20px] font-bold text-gray-900">Members</h1>
          </div>
          <p className="text-[12.5px] text-gray-500">
            Manage workspace members and their access.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {isOwner && (
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
              <Download size={13} /> Export
            </button>
          )}
          {isOwner && (
            <button onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm">
              <UserPlus size={13} /> Invite members
            </button>
          )}
        </div>
      </div>

      {/* Invite Members Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm" onClick={() => setInviteModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-primary-600" />
                <p className="text-[15px] font-bold text-gray-900">Invite Members</p>
              </div>
              <button onClick={() => setInviteModalOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* Student invite — private workspace only */}
              {workspace.privacy === 'private' && (
                <div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                    <Mail size={12} /> Add member by username or email
                  </p>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={inviteQuery}
                      onChange={e => handleInviteSearch(e.target.value)}
                      placeholder="Search by username or email…"
                      className="w-full pl-8 pr-4 py-2.5 text-[13px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white transition-colors"
                    />
                    {inviteSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {inviteError && <p className="text-[11.5px] text-red-500 mt-1">{inviteError}</p>}
                  {inviteResults.length > 0 && (
                    <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {inviteResults.map(u => (
                        <div key={u.user_id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-gray-500">{u.display_name[0]?.toUpperCase()}</div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-800 truncate">{u.display_name}</p>
                            <p className="text-[11px] text-gray-400 truncate">@{u.username} · {u.email}</p>
                          </div>
                          <button
                            onClick={() => handleDirectInvite(u.user_id)}
                            disabled={inviteLoading === u.user_id}
                            className="shrink-0 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {inviteLoading === u.user_id ? '…' : 'Invite'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {inviteQuery.length >= 2 && !inviteSearching && inviteResults.length === 0 && (
                    <p className="text-[12px] text-gray-400 mt-2">No users found matching "{inviteQuery}"</p>
                  )}
                </div>
              )}

              {workspace.privacy === 'private' && <div className="border-t border-gray-100" />}

              {/* Mentor invite */}
              <div>
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Eye size={12} /> Invite a mentor
                </p>
                <div className="relative">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-primary-400">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search mentor by name or email…"
                      value={mentorQuery}
                      onChange={e => handleMentorSearch(e.target.value)}
                      className="flex-1 text-[13px] bg-transparent outline-none placeholder-gray-400"
                    />
                    {mentorSearching && <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />}
                  </div>
                  {mentorResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                      {mentorResults.map(u => (
                        <div key={u.user_id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-[11px] font-bold shrink-0">
                            {u.display_name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-semibold text-gray-800 truncate">{u.display_name}</p>
                            <p className="text-[11px] text-gray-400 truncate">{u.username} · {u.email}</p>
                          </div>
                          <button
                            onClick={() => setConfirmInviteUser(u)}
                            disabled={mentorInviteLoading === u.user_id}
                            className="shrink-0 px-2.5 py-1 text-[11.5px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                          >
                            {mentorInviteLoading === u.user_id ? '…' : 'Invite'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {mentorQuery.length >= 2 && !mentorSearching && mentorResults.length === 0 && (
                  <p className="text-[12px] text-gray-400 mt-2">No mentors found matching "{mentorQuery}"</p>
                )}
                {mentorInviteError && <p className="text-[12px] text-red-500 mt-2">{mentorInviteError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar — owner only */}
      {isOwner && (
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { icon: <Users size={16} className="text-primary-600" />, bg: 'bg-primary-50', label: 'Total members', value: totalCount,
            change: newThisMonth > 0 ? `↑ ${newThisMonth} this month` : 'No change', changeColor: newThisMonth > 0 ? 'text-green-600' : 'text-gray-400' },
          { icon: <Shield size={16} className="text-primary-600" />, bg: 'bg-primary-50', label: 'Admins', value: 1,
            change: 'No change', changeColor: 'text-gray-400' },
          { icon: <Clock size={16} className="text-amber-600" />, bg: 'bg-amber-50', label: 'Pending invites', value: pending.length,
            change: pending.length > 0 ? 'View all' : '—', changeColor: pending.length > 0 ? 'text-primary-600 cursor-pointer hover:underline' : 'text-gray-400',
            onChangeClick: pending.length > 0 ? () => setTab('pending') : undefined },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                {stat.icon}
              </div>
              <p className="text-[11.5px] text-gray-500 font-medium">{stat.label}</p>
            </div>
            <p className="text-[22px] font-bold text-gray-900 leading-none mb-1">{stat.value}</p>
            <p className={`text-[11.5px] font-medium ${stat.changeColor}`}
              onClick={stat.onChangeClick}>{stat.change}</p>
          </div>
        ))}
      </div>
      )}

      {/* Main 2-column layout */}
      <div className="flex gap-5">

        {/* Left: table area */}
        <div className="flex-1 min-w-0">

          {/* Tabs — owner or mentor */}
          {(isOwner || isMentor) && (
          <div className="flex gap-0 border-b border-gray-200 mb-4">
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>
          )}

          {/* Filter toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="relative flex-1 min-w-[160px] max-w-[220px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search members..."
                className="w-full pl-8 pr-3 py-2 text-[12.5px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white" />
            </div>
            <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 text-[12.5px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {tab === 'all' && (
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }}
                className="px-3 py-2 text-[12.5px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
                <option value="all">All types</option>
                <option value="admin">Admin</option>
                <option value="mentor">Mentor</option>
                <option value="member">Member</option>
              </select>
            )}
            <select value={uniFilter} onChange={e => { setUni(e.target.value); setPage(1); }}
              className="px-3 py-2 text-[12.5px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer max-w-[160px] truncate">
              {universities.map(u => (
                <option key={u} value={u}>{u === 'all' ? 'All universities' : u}</option>
              ))}
            </select>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold border rounded-lg transition-colors ${
                showFilters || dateFrom || dateTo
                  ? 'bg-primary-50 border-primary-400 text-primary-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
              }`}>
              <SlidersHorizontal size={13} /> Filters
            </button>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-3 py-2 text-[12.5px] font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                Clear all
              </button>
            )}
          </div>

          {/* Advanced filter panel */}
          {showFilters && (
            <div className="mb-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-semibold text-gray-600">Joined from</label>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-semibold text-gray-600">to</label>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-[12px] text-red-500 hover:text-red-700 font-medium">
                  Clear dates
                </button>
              )}
            </div>
          )}

          {/* Bulk action bar */}
          {isOwner && selected.size > 0 && (
            <div className="mb-3 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-xl flex items-center gap-3">
              <span className="text-[12.5px] font-semibold text-primary-700">{selected.size} selected</span>
              <div className="flex-1" />
              <button onClick={clearSelect}
                className="text-[12px] text-gray-500 hover:text-gray-700">Deselect all</button>
            </div>
          )}

          {/* Table */}
          <div className="space-y-1.5">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 pb-2 border-b border-gray-200">
              <div className={CC.check} />
              <div className={`${CC.member} text-[11px] font-bold text-gray-400 uppercase tracking-wide`}>Member</div>
              <div className={`${CC.badge} text-[11px] font-bold text-gray-400 uppercase tracking-wide`}>Type</div>
              <div className={`${CC.uni} text-[11px] font-bold text-gray-400 uppercase tracking-wide`}>University / Org</div>
              <div className={`${CC.joined} text-[11px] font-bold text-gray-400 uppercase tracking-wide`}>
                {tab === 'pending' ? 'Requested on' : 'Joined on'} ↓
              </div>
              <div className={`${CC.status} text-[11px] font-bold text-gray-400 uppercase tracking-wide`}>Status</div>
              <div className={`${CC.active} text-[11px] font-bold text-gray-400 uppercase tracking-wide`}>Last active</div>
              <div className={CC.actions} />
            </div>

            {/* Rows */}
            {pagedOwnerRow && (
              <OwnerRow workspace={workspace} isYou={isOwner} onNavigate={navigate} />
            )}
            {tab === 'invited' ? (
              invited.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-12 text-center text-[13px] text-gray-400">
                  No pending invitations
                </div>
              ) : (
                invited.map(m => {
                  const u = m.student.user;
                  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
                  return (
                    <div key={m.id} className="bg-white border border-indigo-100 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Avatar src={m.student.profile_picture} name={fullName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">{fullName}</p>
                        <p className="text-[11.5px] text-gray-400 truncate">{u.email}</p>
                        <p className="text-[11px] text-indigo-500">Invitation sent · awaiting acceptance</p>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">{relativeTime(m.requested_at)}</span>
                      <button
                        onClick={() => handleMemberAction(m.id, 'remove')}
                        disabled={actionLoading[m.id] === 'remove'}
                        className="shrink-0 px-2.5 py-1.5 text-[11.5px] font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors disabled:opacity-50"
                        title="Cancel invitation"
                      >
                        {actionLoading[m.id] === 'remove' ? '…' : 'Cancel invite'}
                      </button>
                    </div>
                  );
                })
              )
            ) : tab === 'mentors' ? (
              mentors.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-12 text-center text-[13px] text-gray-400">
                  No mentors yet
                </div>
              ) : (
                mentors.map(g => (
                  <div key={g.id} className="bg-white border border-primary-100 rounded-xl px-4 py-3 flex items-center gap-3">
                    <Avatar src={g.mentor_picture} name={g.mentor_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{g.mentor_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                          {g.status === 'invited' ? 'Pending acceptance' : 'Mentor'}
                        </span>
                        {g.joined_at && (
                          <span className="text-[11px] text-gray-400">Joined {relativeTime(g.joined_at)}</span>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => setConfirmRemoveGuest({ id: g.id, name: g.mentor_name, isCancel: g.status === 'invited' })}
                        disabled={removingGuestId === g.id}
                        className="shrink-0 px-2.5 py-1.5 text-[11.5px] font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {removingGuestId === g.id ? '…' : g.status === 'invited' ? 'Cancel invite' : 'Remove'}
                      </button>
                    )}
                  </div>
                ))
              )
            ) : pagedRows.length === 0 && !pagedOwnerRow ? (
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-12 text-center text-[13px] text-gray-400">
                {tab === 'pending' ? 'No pending requests' : 'No members found'}
              </div>
            ) : tab === 'pending' ? (
              (pagedRows as WorkspaceMembership[]).map(m => (
                <PendingRow key={m.id} m={m}
                  onApprove={() => handleMemberAction(m.id, 'approve')}
                  onReject={() => handleMemberAction(m.id, 'reject')}
                  approving={actionLoading[m.id] === 'approve'}
                  rejecting={actionLoading[m.id] === 'reject'} />
              ))
            ) : (
              <>
                {(pagedRows as WorkspaceMembership[]).map(m => (
                  <MemberRow key={m.id} m={m} isOwner={isOwner}
                    checked={selected.has(m.id)}
                    onCheck={toggleSelect}
                    onAction={handleRowAction} />
                ))}
                {tab === 'all' && (typeFilter === 'all' || typeFilter === 'mentor') && filteredMentors.map(g => (
                  <div key={`guest-${g.id}`} className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2 hover:shadow-sm hover:border-gray-300 transition-all">
                    <div className={CC.check} />
                    <div className={`${CC.member} flex items-center gap-3`}>
                      <Avatar src={g.mentor_picture} name={g.mentor_name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">{g.mentor_name}</p>
                          {g.mentor_id === user?.id && (
                            <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full">You</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={CC.badge}><MentorBadge /></div>
                    <div className={CC.uni}><span className="text-[12px] text-gray-400">—</span></div>
                    <div className={CC.joined}>
                      {g.joined_at
                        ? <span className="text-[12px] text-gray-600">{new Date(g.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        : <span className="text-[12px] text-gray-400">—</span>}
                    </div>
                    <div className={CC.status}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[12px] text-gray-600">Active</span>
                      </div>
                    </div>
                    <div className={CC.active}><span className="text-[12px] text-gray-400">—</span></div>
                    <div className={CC.actions} />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalRows > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[12px] text-gray-500">
                Showing {showingFrom} to {showingTo} of {totalRows} members
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
                  totalPages > 7 && p > 3 && p < totalPages - 2 && Math.abs(p - safePage) > 1 ? null : (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-[12px] font-semibold transition-colors ${
                        p === safePage ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="text-[12px] text-gray-400">{PAGE_SIZE} per page</div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-64 xl:w-72 shrink-0 space-y-3">

          {/* Member activity */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12.5px] font-bold text-gray-800">Member activity</p>
              <select className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none cursor-pointer">
                <option>This week</option>
              </select>
            </div>
            <ActivityBarChart memberships={approved} />
          </div>


          {/* Pending requests */}
          {isOwner && (
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12.5px] font-bold text-gray-800">Pending requests ({pending.length})</p>
                {pending.length > 2 && (
                  <button onClick={() => setTab('pending')}
                    className="text-[11.5px] text-primary-600 font-semibold hover:underline">View all</button>
                )}
              </div>
              {pending.length === 0 ? (
                <p className="text-[12px] text-gray-400 text-center py-2">No pending requests</p>
              ) : (
                <div className="space-y-2.5">
                  {pending.slice(0, 2).map(m => {
                    const u = m.student.user;
                    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
                    const daysAgo = Math.floor((Date.now() - new Date(m.requested_at).getTime()) / 86400000);
                    return (
                      <div key={m.id} className="flex items-start gap-2.5">
                        <Avatar src={m.student.profile_picture} name={name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-gray-800 truncate">{name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                          <p className="text-[11px] text-gray-400">Requested {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleMemberAction(m.id, 'approve')}
                            disabled={!!actionLoading[m.id]}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                            {actionLoading[m.id] === 'approve' ? '…' : 'Approve'}
                          </button>
                          <button onClick={() => handleMemberAction(m.id, 'reject')}
                            disabled={!!actionLoading[m.id]}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Member policies */}
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[12.5px] font-bold text-gray-800 mb-2">Member policies</p>
            <div className="space-y-1.5">
              {[
                { label: 'Who can invite members?', value: 'Admins' },
                { label: 'Require approval for joining',
                  value: workspace.auto_accept ? 'Disabled' : 'Enabled' },
                { label: 'Allow members to remove content',
                  value: workspace.allow_self_unenroll ? 'Enabled' : 'Disabled' },
              ].map(p => (
                <div key={p.label} className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-gray-600">{p.label}</span>
                  <span className="text-[11.5px] font-semibold text-gray-800 shrink-0">{p.value}</span>
                </div>
              ))}
            </div>
            {isOwner && (
              <Link to={`/w/${workspace.slug}/settings`}
                className="mt-2.5 flex items-center gap-1.5 w-full px-3 py-1.5 text-[12px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors justify-center">
                <Settings size={12} /> Manage policies
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
