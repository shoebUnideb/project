import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Users, BookOpen, Globe, LayoutGrid, Star,
  Calendar, ChevronRight, MoreHorizontal, ArrowUpRight,
  Lock, EyeOff, CheckSquare, TrendingUp, List,
  ExternalLink, Settings, LogOut, Trash2, Target,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { Workspace } from '../../types';
import { relativeTime } from '../../utils/time';
import Avatar from '../../components/ui/Avatar';
import CreateWorkspaceModal from '../../components/ui/CreateWorkspaceModal';

// ── Color maps ────────────────────────────────────────────────────────────────
const ACCENT_MAP: Record<string, { iconBg: string; iconText: string; cardTint: string; bar: string }> = {
  blue:    { iconBg: 'bg-primary-100',    iconText: 'text-primary-600',    cardTint: '#fdf3ec', bar: 'bg-primary-500' },
  indigo:  { iconBg: 'bg-indigo-100',  iconText: 'text-indigo-600',  cardTint: '#eef2ff', bar: 'bg-indigo-500' },
  purple:  { iconBg: 'bg-purple-100',  iconText: 'text-purple-600',  cardTint: '#f5f3ff', bar: 'bg-purple-500' },
  teal:    { iconBg: 'bg-teal-100',    iconText: 'text-teal-600',    cardTint: '#f0fdfa', bar: 'bg-teal-500' },
  green:   { iconBg: 'bg-green-100',   iconText: 'text-green-600',   cardTint: '#f0fdf4', bar: 'bg-green-500' },
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', cardTint: '#ecfdf5', bar: 'bg-emerald-500' },
  orange:  { iconBg: 'bg-orange-100',  iconText: 'text-orange-600',  cardTint: '#fff7ed', bar: 'bg-orange-400' },
  red:     { iconBg: 'bg-red-100',     iconText: 'text-red-600',     cardTint: '#fef2f2', bar: 'bg-red-500' },
  pink:    { iconBg: 'bg-pink-100',    iconText: 'text-pink-600',    cardTint: '#fdf2f8', bar: 'bg-pink-500' },
  amber:   { iconBg: 'bg-amber-100',   iconText: 'text-amber-600',   cardTint: '#fffbeb', bar: 'bg-amber-400' },
  cyan:    { iconBg: 'bg-cyan-100',    iconText: 'text-cyan-600',    cardTint: '#ecfeff', bar: 'bg-cyan-500' },
  slate:   { iconBg: 'bg-slate-100',   iconText: 'text-slate-600',   cardTint: '#f8fafc', bar: 'bg-slate-400' },
  violet:  { iconBg: 'bg-violet-100',  iconText: 'text-violet-600',  cardTint: '#f5f3ff', bar: 'bg-violet-500' },
  rose:    { iconBg: 'bg-rose-100',    iconText: 'text-rose-600',    cardTint: '#fff1f2', bar: 'bg-rose-500' },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:       { label: 'Active',        cls: 'bg-green-100 text-green-700' },
  winding_down: { label: 'Winding Down',  cls: 'bg-amber-100 text-amber-700' },
  archived:     { label: 'Archived',      cls: 'bg-gray-100 text-gray-500'   },
};

function accent(ws: Workspace) {
  return ACCENT_MAP[ws.accent_color] ?? ACCENT_MAP.blue;
}
function workspacePath(ws: Workspace) {
  return ws.slug ? `/w/${ws.slug}` : `/workspaces/${ws.id}`;
}

// ── Click-outside hook ────────────────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

// ── Dropdown menu ─────────────────────────────────────────────────────────────
interface MenuItem { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }
function DropdownMenu({ items, onClose, triggerRef }: {
  items: MenuItem[];
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  const [fixedStyle, setFixedStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (triggerRef?.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setFixedStyle({ position: 'fixed', top: r.bottom + 4, right: window.innerWidth - r.right, zIndex: 9999 });
    }
  }, []);

  useEffect(() => {
    if (!triggerRef) return;
    const close = () => onClose();
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [triggerRef, onClose]);

  const inner = (
    <div
      ref={ref}
      style={triggerRef ? fixedStyle : undefined}
      className={`${triggerRef ? '' : 'absolute right-0 top-full mt-1 z-50'} bg-white border border-[#e0e0e0] rounded-xl shadow-lg py-1 min-w-[160px]`}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium hover:bg-gray-50 transition-colors text-left ${item.danger ? 'text-red-600' : 'text-gray-700'}`}
        >
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  );

  return triggerRef ? createPortal(inner, document.body) : inner;
}

// ── Confirm delete modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e0e0e0] p-6 w-[340px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-red-600" />
          </div>
          <h3 className="text-[15px] font-bold text-gray-900">Delete workspace?</h3>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
          <span className="font-semibold text-gray-800">{name}</span> and all its content will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#e0e0e0] rounded-xl text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-[13px] font-semibold text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Confirm leave modal ───────────────────────────────────────────────────────
function ConfirmLeaveModal({ name, onConfirm, onCancel }: {
  name: string; onConfirm: () => void; onCancel: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e0e0e0] p-6 w-[340px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <LogOut size={16} className="text-amber-600" />
          </div>
          <h3 className="text-[15px] font-bold text-gray-900">Leave workspace?</h3>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
          You'll lose access to <span className="font-semibold text-gray-800">{name}</span> and all its content. You can request to rejoin later.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#e0e0e0] rounded-xl text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 rounded-xl text-[13px] font-semibold text-white transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.active;
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Workspace icon (calendar-star) ───────────────────────────────────────────
function WorkspaceIcon({ ws, sizeClass = 'w-11 h-11', roundedClass = 'rounded-xl', extraClass = '' }: {
  ws: Workspace; sizeClass?: string; roundedClass?: string; extraClass?: string;
}) {
  const c = accent(ws);
  const isXs = sizeClass.includes('w-7');
  const isSm = sizeClass.includes('w-9');
  const calSize = isXs ? 11 : isSm ? 14 : 16;
  const starSize = isXs ? 5 : 6;
  return (
    <div className={`relative ${sizeClass} ${c.iconBg} ${c.iconText} ${roundedClass} flex items-center justify-center shrink-0 ${extraClass}`}>
      <Calendar size={calSize} />
      <Star size={starSize} fill="currentColor" className="absolute bottom-0.5 right-0.5 opacity-70" />
    </div>
  );
}

// ── Privacy badge ─────────────────────────────────────────────────────────────
function PrivacyBadge({ privacy }: { privacy: string }) {
  if (privacy === 'private') return <><Lock size={10} className="shrink-0" /> Private</>;
  if (privacy === 'secret')  return <><EyeOff size={10} className="shrink-0" /> Secret</>;
  return <><Globe size={10} className="shrink-0" /> Public</>;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, sub, subGreen = false }: {
  icon: React.ReactNode; value: number; label: string; sub: string; subGreen?: boolean;
}) {
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-3.5 flex items-center gap-3.5 flex-1 min-w-0">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[22px] font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">{label}</p>
        <p className={`text-[11px] font-medium mt-0.5 ${subGreen ? 'text-green-600' : 'text-gray-400'}`}>
          {subGreen && '↑ '}{sub}
        </p>
      </div>
    </div>
  );
}

// ── Featured hero card ────────────────────────────────────────────────────────
function FeaturedCard({ ws, navigate, onLeave }: {
  ws: Workspace; navigate: (p: string) => void; onLeave: (id: number) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const canEnter = ws.my_status === 'owner' || ws.my_status === 'approved';
  const path = workspacePath(ws);

  const menuItems: MenuItem[] = [
    { label: 'Open workspace', icon: <ExternalLink size={13} />, onClick: () => navigate(path) },
    ...(ws.my_status === 'owner' ? [
      { label: 'Settings', icon: <Settings size={13} />, onClick: () => navigate(`${path}/settings`) },
    ] : []),
    ...(ws.my_status === 'approved' ? [
      { label: 'Leave workspace', icon: <LogOut size={13} />, onClick: () => setConfirmLeave(true), danger: true },
    ] : []),
  ];

  return (
    <>
    {confirmLeave && (
      <ConfirmLeaveModal
        name={ws.name}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => { setConfirmLeave(false); onLeave(ws.id); }}
      />
    )}
    <div
      className="relative rounded-2xl flex flex-col justify-end cursor-pointer"
      style={{ background: 'linear-gradient(135deg, #1a2035 60%, #1e2d4a)', minHeight: 300 }}
      onClick={() => canEnter && navigate(path)}
    >
      {/* Inner clipping wrapper for image + gradient only */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {ws.cover_image_url && (
          <img src={ws.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1220]/90 via-[#0d1220]/20 to-transparent" />
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 px-2.5 py-1 rounded-full">
        <span className="text-yellow-400 text-xs">⭐</span>
        <span className="text-white text-[11px] font-semibold">Featured</span>
      </div>
      <div className="absolute top-4 right-4">
        <StatusBadge status={ws.workspace_status} />
      </div>

      <div className="relative p-5 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Avatar name={ws.mentor_name} src={ws.mentor_picture} size="sm" />
          {ws.member_count > 1 && (
            <div className="w-7 h-7 rounded-lg bg-white/20 border-2 border-white/30 flex items-center justify-center text-[10px] text-white font-bold -ml-1.5">
              +{ws.member_count - 1}
            </div>
          )}
        </div>
        <h2 className="text-white text-[22px] font-bold leading-tight line-clamp-2">{ws.name}</h2>
        {ws.description && (
          <p className="text-white/65 text-[12.5px] leading-relaxed line-clamp-2">{ws.description}</p>
        )}
        <div className="flex items-center gap-3 text-white/55 text-[11.5px]">
          <span className="flex items-center gap-1"><Users size={11} />{ws.member_count} Members</span>
          <span>·</span>
          <span className="flex items-center gap-1"><BookOpen size={11} />{ws.resource_count} Resources</span>
          <span>·</span>
          <span className="flex items-center gap-1"><PrivacyBadge privacy={ws.privacy} /></span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={e => { e.stopPropagation(); navigate(path); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors"
          >
            Open workspace
          </button>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && <DropdownMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ── Compact side card ─────────────────────────────────────────────────────────
function CompactSideCard({ ws, onClick }: { ws: Workspace; onClick: () => void }) {
  return (
    <div
      className="bg-white border border-[#e0e0e0] rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all flex-1"
      onClick={onClick}
    >
      <WorkspaceIcon ws={ws} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-[13.5px] font-bold text-gray-900 leading-snug line-clamp-1">{ws.name}</h4>
          <StatusBadge status={ws.workspace_status} />
        </div>
        {ws.description && (
          <p className="text-[11.5px] text-gray-500 leading-snug line-clamp-2">{ws.description}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-2">
          <span className="flex items-center gap-1"><Users size={10} />{ws.member_count} Members</span>
          <span className="flex items-center gap-1"><BookOpen size={10} />{ws.resource_count} Resources</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-gray-300 shrink-0 mt-1" />
    </div>
  );
}

// ── Row card (grid mode) — reference-style dark banner card ──────────────────
function RowCard({ ws, onOpen, onJoin, onDelete, onLeave, onAcceptInvite, onDeclineInvite, joiningId, acceptingId, decliningId }: {
  ws: Workspace; onOpen: () => void; onJoin: (id: number) => void;
  onDelete: (id: number) => void; onLeave: (id: number) => void;
  onAcceptInvite?: (id: number) => void; onDeclineInvite?: (id: number) => void;
  joiningId: number | null; acceptingId?: number | null; decliningId?: number | null;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const canEnter = ws.my_status === 'owner' || ws.my_status === 'approved';

  const menuItems: MenuItem[] = [
    { label: 'Open workspace', icon: <ExternalLink size={13} />, onClick: onOpen },
    ...(ws.my_status === 'owner' ? [
      { label: 'Settings', icon: <Settings size={13} />, onClick: () => navigate(`${workspacePath(ws)}/settings`) },
      { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setConfirmDelete(true), danger: true },
    ] : []),
    ...(ws.my_status === 'approved' ? [
      { label: 'Leave', icon: <LogOut size={13} />, onClick: () => setConfirmLeave(true), danger: true },
    ] : []),
  ];

  return (
    <>
    {confirmDelete && (
      <ConfirmDeleteModal
        name={ws.name}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(ws.id); }}
      />
    )}
    {confirmLeave && (
      <ConfirmLeaveModal
        name={ws.name}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => { setConfirmLeave(false); onLeave(ws.id); }}
      />
    )}
    <div className="w-[280px] flex-shrink-0 rounded-2xl border border-[#e0e0e0] hover:shadow-md transition-all flex flex-col bg-white">

      {/* ── Dark banner ─────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-between p-4 cursor-pointer overflow-hidden rounded-t-2xl"
        style={{ background: 'linear-gradient(135deg, #1a2035 60%, #1e2d4a)', minHeight: 200 }}
        onClick={canEnter ? onOpen : undefined}
      >
        {/* Cover image */}
        {ws.cover_image_url && (
          <img src={ws.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1220]/85 via-[#0d1220]/20 to-transparent" />

        {/* Top row: icon + status */}
        <div className="relative flex items-start justify-between">
          <WorkspaceIcon ws={ws} extraClass="shadow-sm" />
          {/* Status badge with green dot */}
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            ws.workspace_status === 'active'
              ? 'bg-white/20 text-white border border-white/20'
              : 'bg-gray-100/20 text-white/70 border border-white/10'
          }`}>
            {ws.workspace_status === 'active' && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            )}
            {STATUS_MAP[ws.workspace_status]?.label ?? 'Active'}
          </span>
        </div>

        {/* Bottom: name + description + stats */}
        <div className="relative mt-auto pt-6 space-y-1.5">
          <h4 className="text-white text-[16px] font-bold leading-snug line-clamp-2">{ws.name}</h4>
          {ws.description && (
            <p className="text-white/65 text-[11.5px] leading-snug line-clamp-2">{ws.description}</p>
          )}
          <div className="flex items-center gap-2.5 text-white/50 text-[11px] pt-1">
            <span className="flex items-center gap-1"><Users size={10} />{ws.member_count} Members</span>
            <span>·</span>
            <span className="flex items-center gap-1"><BookOpen size={10} />{ws.resource_count} Resources</span>
          </div>
        </div>
      </div>

      {/* ── White footer ────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-2 bg-white rounded-b-2xl relative">
        {ws.my_status === 'invited' ? (
          <div className="flex gap-1.5 flex-1">
            <button
              onClick={e => { e.stopPropagation(); onAcceptInvite?.(ws.id); }}
              disabled={acceptingId === ws.id}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-[12px] font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {acceptingId === ws.id ? '…' : 'Accept'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDeclineInvite?.(ws.id); }}
              disabled={decliningId === ws.id}
              className="flex-1 py-2 bg-white border border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500 text-[12px] font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {decliningId === ws.id ? '…' : 'Decline'}
            </button>
          </div>
        ) : canEnter ? (
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[12px] font-semibold rounded-xl transition-colors"
          >
            Open workspace <ChevronRight size={13} />
          </button>
        ) : ws.my_status === 'pending' ? (
          <span className="px-3.5 py-2 text-[12px] font-semibold text-amber-600 border border-amber-200 rounded-xl bg-amber-50">
            Pending…
          </span>
        ) : (
          <button
            onClick={() => onJoin(ws.id)}
            disabled={joiningId === ws.id}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 text-[12px] font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {joiningId === ws.id ? 'Joining…' : ws.auto_accept ? 'Join' : 'Request to join'}
          </button>
        )}

        <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
          <button
            ref={menuBtnRef}
            onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && <DropdownMenu items={menuItems} onClose={() => setMenuOpen(false)} triggerRef={menuBtnRef} />}
        </div>

        {/* Overlapping member avatars */}
        <div className="flex -space-x-2">
          <Avatar name={ws.mentor_name} src={ws.mentor_picture} size="sm" className="border-2 border-white" />
          {ws.member_count > 1 && (
            <div className="w-7 h-7 rounded-lg bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600">
              +{ws.member_count - 1}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ── List row (list mode) ──────────────────────────────────────────────────────
function ListRow({ ws, onOpen, onJoin, onDelete, onLeave, onAcceptInvite, onDeclineInvite, joiningId, acceptingId, decliningId }: {
  ws: Workspace; onOpen: () => void; onJoin: (id: number) => void;
  onDelete: (id: number) => void; onLeave: (id: number) => void;
  onAcceptInvite?: (id: number) => void; onDeclineInvite?: (id: number) => void;
  joiningId: number | null; acceptingId?: number | null; decliningId?: number | null;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const canEnter = ws.my_status === 'owner' || ws.my_status === 'approved';

  const menuItems: MenuItem[] = [
    { label: 'Open workspace', icon: <ExternalLink size={13} />, onClick: onOpen },
    ...(ws.my_status === 'owner' ? [
      { label: 'Settings', icon: <Settings size={13} />, onClick: () => navigate(`${workspacePath(ws)}/settings`) },
      { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setConfirmDelete(true), danger: true },
    ] : []),
    ...(ws.my_status === 'approved' ? [
      { label: 'Leave', icon: <LogOut size={13} />, onClick: () => setConfirmLeave(true), danger: true },
    ] : []),
  ];

  return (
    <>
    {confirmDelete && (
      <ConfirmDeleteModal
        name={ws.name}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(ws.id); }}
      />
    )}
    {confirmLeave && (
      <ConfirmLeaveModal
        name={ws.name}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => { setConfirmLeave(false); onLeave(ws.id); }}
      />
    )}
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[#e0e0e0] bg-white hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={canEnter ? onOpen : undefined}
    >
      <WorkspaceIcon ws={ws} sizeClass="w-9 h-9" roundedClass="rounded-lg" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900 truncate">{ws.name}</p>
        {ws.description && <p className="text-[11px] text-gray-400 truncate">{ws.description}</p>}
      </div>
      <StatusBadge status={ws.workspace_status} />
      <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
        <Users size={10} />{ws.member_count}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
        <BookOpen size={10} />{ws.resource_count}
      </span>
      <p className="text-[11px] text-gray-400 shrink-0 w-16 text-right">{relativeTime(ws.created_at)}</p>
      {ws.my_status === 'invited' ? (
        <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onAcceptInvite?.(ws.id)}
            disabled={acceptingId === ws.id}
            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60"
          >
            {acceptingId === ws.id ? '…' : 'Accept'}
          </button>
          <button
            onClick={() => onDeclineInvite?.(ws.id)}
            disabled={decliningId === ws.id}
            className="px-2.5 py-1 text-[11px] font-semibold text-gray-500 border border-gray-300 hover:border-red-300 hover:text-red-500 rounded-lg transition-colors disabled:opacity-60"
          >
            {decliningId === ws.id ? '…' : 'Decline'}
          </button>
        </div>
      ) : !canEnter && ws.my_status !== 'pending' && ws.my_status !== 'rejected' ? (
        <button
          onClick={e => { e.stopPropagation(); onJoin(ws.id); }}
          disabled={joiningId === ws.id}
          className="px-2.5 py-1 text-[11px] font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-60 shrink-0"
        >
          {joiningId === ws.id ? 'Joining…' : 'Join'}
        </button>
      ) : null}
      <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(v => !v)} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && <DropdownMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
    </>
  );
}

// ── Sidebar deadline row ──────────────────────────────────────────────────────
function DeadlineRow({ ws, navigate }: { ws: Workspace; navigate: (p: string) => void }) {
  if (!ws.target_deadline) return null;
  const d = new Date(ws.target_deadline);
  const month = d.toLocaleDateString('en', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg -mx-1 px-1 transition-colors"
      onClick={() => navigate(workspacePath(ws))}
    >
      <div className="w-11 shrink-0 text-center bg-primary-50 rounded-lg py-1">
        <p className="text-[10px] font-bold text-primary-600">{month}</p>
        <p className="text-[18px] font-bold text-gray-900 leading-none">{day}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-900 line-clamp-1">{ws.name}</p>
        <p className="text-[11px] text-gray-400">{ws.mentor_name}</p>
        <div className="flex items-center gap-1 mt-1">
          <Avatar name={ws.mentor_name} src={ws.mentor_picture} size="sm" />
          <span className="text-[10.5px] text-gray-400">
            {ws.member_count} {ws.member_count === 1 ? 'member' : 'members'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function WorkspacesPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const tabsRef   = useRef<HTMLDivElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [joiningId, setJoiningId]   = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [tab, setTab] = useState<'joined' | 'discover'>('joined');
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid');

  const { data: workspaces, loading, refetch } = useApiList(workspacesApi.list);

  const myWs           = useMemo(() => workspaces.filter(w => w.my_status === 'owner'),    [workspaces]);
  const joinedWs       = useMemo(() => workspaces.filter(w => w.my_status === 'approved'), [workspaces]);
  const invitedWs      = useMemo(() => workspaces.filter(w => w.my_status === 'invited'),  [workspaces]);
  const mentorWs       = useMemo(() => workspaces.filter(w => w.my_status === 'mentor'), [workspaces]);
  const mentorInvitedWs = useMemo(() => workspaces.filter(w => w.my_status === 'mentor_invited'), [workspaces]);
  const memberWs  = useMemo(() => workspaces.filter(w =>
    w.my_status === 'owner' || w.my_status === 'approved' || w.my_status === 'mentor'
  ), [workspaces]);
  const otherWs   = useMemo(() => workspaces.filter(w =>
    w.my_status !== 'owner' && w.my_status !== 'approved' && w.my_status !== 'invited' &&
    w.my_status !== 'mentor' && w.my_status !== 'mentor_invited'
  ), [workspaces]);

  const totalWs        = memberWs.length;
  const activeWs       = memberWs.filter(w => w.workspace_status === 'active').length;
  const totalResources = memberWs.reduce((s, w) => s + w.resource_count, 0);
  const totalMembers   = memberWs.reduce((s, w) => s + w.member_count, 0);

  const featured  = memberWs[0] ?? workspaces[0];
  const sideCards = workspaces.filter(w => w !== featured).slice(0, 2);

  const maxRes    = Math.max(...memberWs.map(w => w.resource_count), 1);
  const glanceWs  = memberWs.slice(0, 4);
  const barColors = ['bg-green-500', 'bg-teal-500', 'bg-orange-400', 'bg-purple-500'];

  const withDeadlines  = workspaces.filter(w => w.target_deadline).slice(0, 3);
  const recentActivity = [...workspaces]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  const tabWs = tab === 'joined' ? memberWs : otherWs;

  const switchTab = (t: typeof tab) => {
    setTab(t);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleJoin = async (id: number) => {
    setJoiningId(id);
    try {
      await apiClient.initCsrf();
      await workspacesApi.join(id);
      refetch();
    } catch { refetch(); }
    finally { setJoiningId(null); }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.initCsrf();
      await workspacesApi.delete(id);
      refetch();
    } catch { refetch(); }
  };

  const handleLeave = async (id: number) => {
    try {
      await apiClient.initCsrf();
      await workspacesApi.leave(id);
      refetch();
    } catch { refetch(); }
  };

  const handleAcceptInvite = async (id: number) => {
    setAcceptingId(id);
    try {
      await apiClient.initCsrf();
      await workspacesApi.acceptInvite(id);
      refetch();
      const ws = workspaces.find(w => w.id === id);
      if (ws) navigate(workspacePath(ws));
    } catch { refetch(); }
    finally { setAcceptingId(null); }
  };

  const handleDeclineInvite = async (id: number) => {
    setDecliningId(id);
    try {
      await apiClient.initCsrf();
      await workspacesApi.declineInvite(id);
      refetch();
    } catch { refetch(); }
    finally { setDecliningId(null); }
  };

  const handleAcceptMentorInvite = async (id: number) => {
    setAcceptingId(id);
    try {
      await apiClient.initCsrf();
      await workspacesApi.acceptMentorInvite(id);
      refetch();
      const ws = workspaces.find(w => w.id === id);
      if (ws) navigate(workspacePath(ws));
    } catch { refetch(); }
    finally { setAcceptingId(null); }
  };

  const handleDeclineMentorInvite = async (id: number) => {
    setDecliningId(id);
    try {
      await apiClient.initCsrf();
      await workspacesApi.declineMentorInvite(id);
      refetch();
    } catch { refetch(); }
    finally { setDecliningId(null); }
  };
  const firstName = user?.first_name || user?.username || 'there';
  const dashboardPath = user?.role === 'mentor' ? '/mentor/dashboard' : '/student/dashboard';
  const firstMemberTasksPath = memberWs[0] ? `${workspacePath(memberWs[0])}/tasks` : '/workspaces';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Welcome back, {firstName}!</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Here's what's happening across your workspaces today.</p>
        </div>
        {user?.role === 'mentor' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors"
          >
            Create workspace
          </button>
        )}
      </div>

      {/* ── Main 2-col layout ───────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left main ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Featured + side cards */}
          {workspaces.length > 0 && (
            <div className="flex gap-3">
              {featured && (
                <div className="flex-[3]">
                  <FeaturedCard ws={featured} navigate={navigate} onLeave={handleLeave} />
                </div>
              )}
              {sideCards.length > 0 && (
                <div className="flex-[2] flex flex-col gap-3">
                  {sideCards.map(ws => (
                    <CompactSideCard key={ws.id} ws={ws} onClick={() => navigate(workspacePath(ws))} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Programs + Upcoming */}
          {memberWs.length > 0 && (
            <div className="flex gap-3">
              <div className="flex-1 bg-white border border-[#e0e0e0] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13.5px] font-bold text-gray-900">Programs at a glance</p>
                  <button
                    onClick={() => switchTab('joined')}
                    className="text-[12px] text-primary-600 font-medium hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {glanceWs.map((ws, i) => {
                    const pct = Math.round((ws.resource_count / maxRes) * 100);
                    return (
                      <div
                        key={ws.id}
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate(workspacePath(ws))}
                      >
                        <WorkspaceIcon ws={ws} sizeClass="w-7 h-7" roundedClass="rounded-lg" />
                        <div className="flex-1 min-w-0 max-w-[200px]">
                          <p className="text-[12px] font-semibold text-gray-800 truncate">{ws.name}</p>
                          <p className="text-[10.5px] text-gray-400 truncate">{ws.mentor_name}</p>
                        </div>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${barColors[i % barColors.length]} rounded-full`} style={{ width: `${pct || 5}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-500 w-7 text-right">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {withDeadlines.length > 0 ? (
                <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={14} className="text-orange-500" />
                    <p className="text-[12px] font-semibold text-orange-600 uppercase tracking-wide">Upcoming soon</p>
                  </div>
                  {(() => {
                    const ws = withDeadlines[0];
                    const d = new Date(ws.target_deadline!);
                    const daysLeft = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
                    return (
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <h4 className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2">{ws.name}</h4>
                          <p className="text-[11.5px] text-gray-500 mt-1">
                            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {ws.target_country && (
                            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Target size={10} /> {ws.target_country}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <Avatar name={ws.mentor_name} src={ws.mentor_picture} size="sm" />
                            <button
                              onClick={() => navigate(workspacePath(ws))}
                              className="px-3 py-1.5 bg-white border border-orange-200 text-orange-700 text-[11.5px] font-semibold rounded-lg hover:bg-orange-50 transition-colors"
                            >
                              Open workspace
                            </button>
                          </div>
                        </div>
                        <div className="w-14 h-14 bg-orange-100 rounded-xl flex flex-col items-center justify-center shrink-0">
                          <p className="text-[18px] font-bold text-orange-600 leading-none">{daysLeft}</p>
                          <p className="text-[9.5px] text-orange-500 font-medium mt-0.5">Days left</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex-1 bg-gradient-to-br from-primary-50 to-indigo-50 border border-primary-100 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
                  <Calendar size={24} className="text-primary-300" />
                  <p className="text-[13px] font-semibold text-gray-700">No upcoming deadlines</p>
                  {user?.role === 'mentor' && (
                    <p className="text-[11.5px] text-gray-400">Set a deadline in workspace settings</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tabs section ──────────────────────────────────────────── */}
          <div ref={tabsRef}>
            <div className="flex items-center border-b border-gray-200 mb-3">
              {(['joined', 'discover'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2.5 mr-5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${
                    tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'joined' ? 'Joined' : 'Discover'}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 pb-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
                  title="Grid view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
                  title="List view"
                >
                  <List size={14} />
                </button>
              </div>
            </div>

            {/* Pending invitations — shown above the main list in Joined tab */}
            {tab === 'joined' && invitedWs.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest mb-2">
                  Pending Invitations ({invitedWs.length})
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {invitedWs.map(ws => (
                    <div key={ws.id} className="relative flex-shrink-0">
                      <RowCard ws={ws} onOpen={() => navigate(workspacePath(ws))} onJoin={handleJoin} onDelete={handleDelete} onLeave={handleLeave} onAcceptInvite={handleAcceptInvite} onDeclineInvite={handleDeclineInvite} joiningId={joiningId} acceptingId={acceptingId} decliningId={decliningId} />
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Invited
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mentor invitations — pending workspace mentor invites */}
            {tab === 'joined' && mentorInvitedWs.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-2">
                  Mentor Invitations ({mentorInvitedWs.length})
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {mentorInvitedWs.map(ws => (
                    <div key={ws.id} className="relative flex-shrink-0">
                      <RowCard ws={ws} onOpen={() => navigate(workspacePath(ws))} onJoin={handleJoin} onDelete={handleDelete} onLeave={handleLeave} onAcceptInvite={handleAcceptMentorInvite} onDeclineInvite={handleDeclineMentorInvite} joiningId={joiningId} acceptingId={acceptingId} decliningId={decliningId} />
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Mentor
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'grid' ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {tabWs.map(ws => (
                  <div key={ws.id} className="relative flex-shrink-0">
                    <RowCard
                      ws={ws}
                      onOpen={() => navigate(workspacePath(ws))}
                      onJoin={handleJoin} onDelete={handleDelete} onLeave={handleLeave}
                      onAcceptInvite={handleAcceptInvite} onDeclineInvite={handleDeclineInvite}
                      joiningId={joiningId} acceptingId={acceptingId} decliningId={decliningId}
                    />
                    {ws.my_status === 'mentor' && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
                        Mentor
                      </div>
                    )}
                  </div>
                ))}
                {user?.role === 'mentor' && tab === 'discover' && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex flex-col items-center justify-center gap-2 w-[200px] flex-shrink-0 bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:border-primary-300 hover:bg-primary-50/30 transition-all"
                  >
                    <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                      <Plus size={22} className="text-primary-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-bold text-primary-600">Create new workspace</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">Start a new workspace and invite others.</p>
                    </div>
                  </button>
                )}
                {tabWs.length === 0 && !(user?.role === 'mentor' && (tab === 'discover')) && (
                  <p className="text-[13px] text-gray-400 py-6">
                    {
                     tab === 'joined' ? "You haven't joined any workspaces yet." :
                     'No workspaces to discover right now.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tabWs.map(ws => (
                  <ListRow
                    key={ws.id} ws={ws}
                    onOpen={() => navigate(workspacePath(ws))}
                    onJoin={handleJoin} onDelete={handleDelete} onLeave={handleLeave}
                    onAcceptInvite={handleAcceptInvite} onDeclineInvite={handleDeclineInvite}
                    joiningId={joiningId} acceptingId={acceptingId} decliningId={decliningId}
                  />
                ))}
                {user?.role === 'mentor' && tab === 'discover' && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-[12.5px] font-semibold text-primary-600 hover:border-primary-300 hover:bg-primary-50/30 transition-all"
                  >
                    <Plus size={15} /> Create new workspace
                  </button>
                )}
                {tabWs.length === 0 && !(user?.role === 'mentor' && (tab === 'discover')) && (
                  <p className="text-[13px] text-gray-400 py-6 text-center">
                    {
                     tab === 'joined' ? "You haven't joined any workspaces yet." :
                     'No workspaces to discover right now.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Discover banner ─────────────────────────────────────────── */}
          {otherWs.length > 0 && (
            <div className="bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-100 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-bold text-gray-900">Discover new possibilities 🚀</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Explore public workspaces and connect with like-minded people.</p>
              </div>
              <button
                onClick={() => switchTab('discover')}
                className="px-4 py-2 bg-white border border-primary-200 text-primary-700 text-[12.5px] font-semibold rounded-lg hover:bg-primary-50 transition-colors shrink-0"
              >
                Explore workspaces
              </button>
            </div>
          )}
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────── */}
        <div className="w-[272px] shrink-0 space-y-4">

          {/* Upcoming Events */}
          <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[13.5px] font-bold text-gray-900">Upcoming Events</p>
              <button
                onClick={() => navigate(dashboardPath)}
                className="text-[12px] text-primary-600 font-medium hover:underline"
              >
                View calendar
              </button>
            </div>
            {withDeadlines.length > 0 ? (
              <>
                {withDeadlines.map(ws => <DeadlineRow key={ws.id} ws={ws} navigate={navigate} />)}
                <button
                  onClick={() => navigate(dashboardPath)}
                  className="mt-2 text-[12px] text-primary-600 font-semibold flex items-center gap-1 hover:underline"
                >
                  See all events <ArrowUpRight size={12} />
                </button>
              </>
            ) : (
              <p className="text-[12px] text-gray-400 py-4 text-center">No upcoming deadlines.</p>
            )}
          </div>

          {/* Tasks in Progress */}
          <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13.5px] font-bold text-gray-900">Tasks in Progress</p>
              <button
                onClick={() => navigate(firstMemberTasksPath)}
                className="text-[12px] text-primary-600 font-medium hover:underline"
              >
                View all
              </button>
            </div>
            {memberWs.length > 0 ? (
              <div className="space-y-2.5">
                {memberWs.slice(0, 4).map((ws, i) => {
                  const priorities = [
                    { label: 'High',   cls: 'bg-red-100 text-red-600' },
                    { label: 'Medium', cls: 'bg-orange-100 text-orange-600' },
                    { label: 'High',   cls: 'bg-red-100 text-red-600' },
                    { label: 'Low',    cls: 'bg-green-100 text-green-700' },
                  ];
                  const p = priorities[i % priorities.length];
                  const c = accent(ws);
                  return (
                    <div
                      key={ws.id}
                      className="flex items-start gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`${workspacePath(ws)}/tasks`)}
                    >
                      <div className={`w-5 h-5 ${c.iconBg} ${c.iconText} rounded flex items-center justify-center shrink-0 mt-0.5`}>
                        <CheckSquare size={11} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800 line-clamp-1">{ws.name}</p>
                        <p className="text-[10.5px] text-gray-400">{ws.mentor_name}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${p.cls}`}>
                        {p.label}
                      </span>
                    </div>
                  );
                })}
                <button
                  onClick={() => navigate(firstMemberTasksPath)}
                  className="text-[12px] text-primary-600 font-semibold flex items-center gap-1 hover:underline mt-1"
                >
                  {totalWs} tasks across all workspaces <ArrowUpRight size={12} />
                </button>
              </div>
            ) : (
              <p className="text-[12px] text-gray-400 text-center py-3">No active workspaces.</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[13.5px] font-bold text-gray-900">Recent Activity</p>
              <button
                onClick={() => switchTab('joined')}
                className="text-[12px] text-primary-600 font-medium hover:underline"
              >
                View all
              </button>
            </div>
            {recentActivity.length > 0 ? (
              <div>
                {recentActivity.map(ws => {
                  const c = accent(ws);
                  return (
                    <div
                      key={ws.id}
                      className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(workspacePath(ws))}
                    >
                      <div className="relative shrink-0">
                        <Avatar name={ws.mentor_name} src={ws.mentor_picture} size="sm" />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${c.iconBg} ${c.iconText} rounded-full border-2 border-white flex items-center justify-center`}>
                          <TrendingUp size={8} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-gray-800 leading-snug line-clamp-2">
                          <span className="font-semibold">{ws.mentor_name}</span>
                          {ws.my_status === 'owner' ? ' created ' : ' updated '}
                          <span className="font-medium">{ws.name}</span>
                        </p>
                      </div>
                      <p className="text-[10.5px] text-gray-400 shrink-0">{relativeTime(ws.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-gray-400 text-center py-3">No recent activity.</p>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreated={w => { setShowCreate(false); navigate(w.slug ? `/w/${w.slug}` : `/workspaces/${w.id}`); }}
        />
      )}
    </div>
  );
}
