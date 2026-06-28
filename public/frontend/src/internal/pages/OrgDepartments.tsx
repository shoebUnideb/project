import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Pencil, Trash2, X, Users, MoreHorizontal,
  Search, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Download,
  UserCog, Archive, RotateCcw,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { useOrg } from '../context/OrgContext';
import { orgApi, type Department, type DeptStats, type OrgMember } from '../api/orgApi';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const DEPARTMENTS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Department?',
    bullets: [
      'A **department** is a team or business unit within your organisation — Engineering, Marketing, Software Part, etc.',
      'Every member belongs to **one department** (or none for cross-team contributors).',
      'Departments roll up reporting, filtering, and permissions across the platform.',
    ],
  },
  {
    eyebrow: '2 · Add a Department',
    bullets: [
      'Click **+ Add Department** to create a new team.',
      'Give it a **name**, optional **description**, and a **department head** (a user from your org).',
      'Departments can be **nested** — set a **parent** to create sub-departments (e.g., Software Part > Backend).',
      'New departments default to **Active** — toggle to Inactive if archiving.',
    ],
  },
  {
    eyebrow: '3 · Assign Members & Heads',
    bullets: [
      'Click the **employee count** in a row to view all members of that department.',
      'Use **Assign Head** in Quick Actions to set or change a department head — they get manager-level visibility for that team.',
      'Add members to a department from the **Users & Roles** page (edit user → department field).',
    ],
  },
  {
    eyebrow: '4 · Hierarchy View',
    bullets: [
      'The right-side **Department Hierarchy** card shows the parent-child structure at a glance.',
      'Click any node to expand or collapse its sub-departments.',
      'Use this to verify reporting lines and team structure quickly.',
    ],
  },
  {
    eyebrow: '5 · Sort, Filter, Archive',
    bullets: [
      'Sort by **name, head, employee count, sub-departments, status, or created date** — click any column header.',
      'Tabs at the top filter by **All / Active / Inactive**.',
      'Use **Archive Active Depts** to bulk-archive teams that are no longer in use — members stay but lose department affiliation.',
      'The row 3-dot menu has per-department actions: edit, archive, restore, delete.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Departments power filters across **Onboarding, Forms, Events, Training, and Reports** — keep them clean and current so dashboards stay meaningful.',
  },
];

const PAGE_SIZE = 8;
const CHART_COLORS = ['#111827', '#E5E7EB'];

type SortKey = 'name' | 'head_name' | 'member_count' | 'sub_department_count' | 'is_active' | 'created_at';

// ── Hierarchy Node ─────────────────────────────────────────────────────────────

function HierarchyNode({ dept, all, level = 0 }: {
  dept: Department;
  all: Department[];
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const children = all.filter(d => d.parent_id === dept.id);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-gray-50 cursor-default"
        style={{ paddingLeft: 6 + level * 14 }}
      >
        <button
          onClick={() => children.length && setExpanded(p => !p)}
          className={['w-4 shrink-0 flex items-center justify-center', children.length ? 'cursor-pointer' : ''].join(' ')}
        >
          {children.length > 0 ? (
            expanded
              ? <ChevronDown size={11} className="text-gray-400" />
              : <ChevronRight size={11} className="text-gray-400" />
          ) : null}
        </button>
        <Building2 size={11} className="text-gray-400 shrink-0" />
        <span className="text-[12px] text-gray-700 truncate flex-1">{dept.name}</span>
        {!dept.is_active && (
          <span className="text-[9.5px] text-gray-400 shrink-0">(inactive)</span>
        )}
      </div>
      {expanded && children.map(c => (
        <HierarchyNode key={c.id} dept={c} all={all} level={level + 1} />
      ))}
    </div>
  );
}

// ── Sort Header Cell ───────────────────────────────────────────────────────────

function SortTh({ label, col, sortCol, sortDir, onSort, className = '' }: {
  label: string;
  col: SortKey;
  sortCol: SortKey | null;
  sortDir: 'asc' | 'desc';
  onSort: (col: SortKey) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className={`text-left text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc'
            ? <ChevronUp size={11} className="text-gray-700" />
            : <ChevronDown size={11} className="text-gray-700" />
          : <ChevronUp size={11} className="text-gray-300" />}
      </span>
    </th>
  );
}

// ── Row Action Menu (portal-based, bypasses overflow:hidden) ──────────────────

function RowMenu({ dept, onEdit, onDelete, onArchiveConfirm, onAssignHead }: {
  dept: Department;
  onEdit: () => void;
  onDelete: () => void;
  onArchiveConfirm: () => void;
  onAssignHead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

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

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={12} /> Edit Department
          </button>
          <button
            onClick={() => { onAssignHead(); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50"
          >
            <UserCog size={12} /> Assign Head
          </button>
          <button
            onClick={() => { onArchiveConfirm(); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50"
          >
            {dept.is_active ? <Archive size={12} /> : <RotateCcw size={12} />}
            {dept.is_active ? 'Archive' : 'Restore'}
          </button>
          <div className="my-0.5 border-t border-gray-100" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12.5px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Department Modal ───────────────────────────────────────────────────────────

function DeptModal({ dept, departments, members, onClose, onSaved }: {
  dept: Department | null;
  departments: Department[];
  members: OrgMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!dept;
  const [name, setName]         = useState(dept?.name ?? '');
  const [desc, setDesc]         = useState(dept?.description ?? '');
  const [parentId, setParentId] = useState<number | ''>(dept?.parent_id ?? '');
  const [headId, setHeadId]     = useState<number | ''>(dept?.head_id != null ? dept.head_id : '');
  const [isActive, setIsActive] = useState(dept?.is_active ?? true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const parentOptions = departments.filter(d => d.id !== dept?.id);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: name.trim(),
        description: desc.trim(),
        parent_id: parentId || null,
        head_id:   headId   || null,
        is_active: isActive,
      };
      if (editing) {
        await orgApi.updateDepartment(dept!.id, payload);
      } else {
        await orgApi.createDepartment(payload);
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string; name?: string[] } };
      setError(e?.data?.detail ?? e?.data?.name?.[0] ?? 'Failed to save.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[480px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">
            {editing ? 'Edit Department' : 'New Department'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
              Department Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Engineering, Programs, HR"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Brief description of this department..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                Parent Department <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
              >
                <option value="">None (top-level)</option>
                {parentOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                Department Head <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={headId}
                onChange={e => setHeadId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
              >
                <option value="">Not assigned</option>
                {members.map(m => (
                  <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>
                ))}
              </select>
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 accent-gray-900"
              />
              <span className="text-[13px] text-gray-700 font-medium">Department is active</span>
            </label>
          )}
        </div>

        {error && (
          <p className="mt-3 text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Department'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ dept, onClose, onDeleted }: {
  dept: Department;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const handleDelete = async () => {
    setDeleting(true); setError('');
    try {
      await orgApi.deleteDepartment(dept.id);
      onDeleted(); onClose();
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } };
      setError(e?.data?.detail ?? 'Failed to delete department.');
    } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[380px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-gray-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Delete department?</p>
            <p className="text-[12.5px] text-gray-500 mt-0.5">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 mb-4">
          You are about to permanently delete <strong>{dept.name}</strong>.
          {dept.member_count > 0 && (
            <span className="block mt-1 text-gray-500">
              This department has {dept.member_count} member{dept.member_count !== 1 ? 's' : ''} assigned to it.
            </span>
          )}
        </p>
        {error && (
          <p className="text-[12.5px] text-gray-700 bg-gray-100 px-3 py-2 rounded-lg mb-4">{error}</p>
        )}
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Archive Confirmation Modal ─────────────────────────────────────────────────

function ConfirmArchiveModal({ dept, onClose, onSaved }: {
  dept: Department;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const isArchiving = dept.is_active;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await orgApi.updateDepartment(dept.id, { is_active: !dept.is_active });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            {isArchiving
              ? <Archive size={18} className="text-gray-600" />
              : <RotateCcw size={18} className="text-gray-600" />}
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">
              {isArchiving ? 'Archive' : 'Restore'} department?
            </p>
            <p className="text-[12.5px] text-gray-500 mt-0.5">{dept.name}</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 mb-5">
          {isArchiving
            ? 'This department will be marked inactive. Members assigned to it are not affected.'
            : 'This department will be restored to active status.'}
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : isArchiving ? 'Archive Department' : 'Restore Department'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Head Modal ─────────────────────────────────────────────────────────

function AssignHeadModal({ dept, members, onClose, onSaved }: {
  dept: Department;
  members: OrgMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [headId, setHeadId] = useState<number | ''>(dept.head_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await orgApi.updateDepartment(dept.id, { head_id: headId || null });
      onSaved(); onClose();
    } catch {
      setError('Failed to update department head.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">Assign Department Head</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">{dept.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Select Department Head</label>
          <select
            value={headId}
            onChange={e => setHeadId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
          >
            <option value="">No head assigned</option>
            {members.map(m => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.display_name} — {m.role.name}
              </option>
            ))}
          </select>
          {dept.head_name && (
            <p className="text-[11.5px] text-gray-400 mt-1.5">Current head: {dept.head_name}</p>
          )}
        </div>

        {error && <p className="text-[12.5px] text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Assign Head'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage Department Heads Modal ─────────────────────────────────────────────

function ManageHeadsModal({ departments, members, onClose, onSaved }: {
  departments: Department[];
  members: OrgMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [headMap, setHeadMap] = useState<Record<number, number | ''>>(() => {
    const m: Record<number, number | ''> = {};
    departments.forEach(d => { m[d.id] = d.head_id ?? ''; });
    return m;
  });
  const [saving, setSaving]     = useState(false);
  const [progress, setProgress] = useState('');

  const handleSave = async () => {
    const changed = departments.filter(d => (d.head_id ?? '') !== headMap[d.id]);
    if (!changed.length) { onClose(); return; }
    setSaving(true);
    for (let i = 0; i < changed.length; i++) {
      setProgress(`Saving ${i + 1}/${changed.length}…`);
      await orgApi.updateDepartment(changed[i].id, { head_id: headMap[changed[i].id] || null }).catch(() => {});
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[580px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-[16px] font-bold text-gray-900">Manage Department Heads</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50/95 border-b border-gray-200">
              <tr>
                <th className="px-5 py-2 text-left text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="px-5 py-2 text-left text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide">Current Head</th>
                <th className="px-5 py-2 text-left text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide">Assign Head</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-2.5">
                    <p className="text-[13px] font-medium text-gray-900">{d.name}</p>
                    {d.parent_name && <p className="text-[11px] text-gray-400">under {d.parent_name}</p>}
                  </td>
                  <td className="px-5 py-2.5 text-[12.5px] text-gray-500">
                    {d.head_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <select
                      value={headMap[d.id] ?? ''}
                      onChange={e => setHeadMap(prev => ({ ...prev, [d.id]: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full px-2.5 py-1.5 text-[12.5px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    >
                      <option value="">No head</option>
                      {members.map(m => (
                        <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-[12px] text-gray-500">{saving ? progress : ''}</span>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Department Detail Drawer ───────────────────────────────────────────────────

function DeptDrawer({ dept, departments, onClose, onEdit, onArchiveConfirm }: {
  dept: Department;
  departments: Department[];
  onClose: () => void;
  onEdit: () => void;
  onArchiveConfirm: () => void;
}) {
  const [drawerMembers, setDrawerMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading]             = useState(true);
  const subDepts = departments.filter(d => d.parent_id === dept.id);

  useEffect(() => {
    setLoading(true);
    orgApi.getMembers({ deptId: dept.id })
      .then(setDrawerMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dept.id]);

  const shown = drawerMembers.slice(0, 6);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[400px] h-full bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-bold text-gray-900 truncate">{dept.name}</h2>
              <span className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                dept.is_active ? 'text-gray-700 border-gray-300' : 'text-gray-400 border-gray-200'
              }`}>
                {dept.is_active ? 'Active' : 'Archived'}
              </span>
            </div>
            {dept.description && (
              <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{dept.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Info row */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
          {[
            { label: 'Parent', value: dept.parent_name ?? 'Top-level' },
            { label: 'Head',   value: dept.head_name ?? 'Not assigned' },
            { label: 'Created', value: new Date(dept.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
          ].map(item => (
            <div key={item.label} className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
              <p className="text-[12px] text-gray-800 font-medium truncate">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Members */}
          <div>
            <p className="text-[12.5px] font-semibold text-gray-900 mb-2.5">
              Members <span className="text-gray-400 font-normal">({dept.member_count})</span>
            </p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : drawerMembers.length === 0 ? (
              <p className="text-[12px] text-gray-400 py-2">No members assigned to this department.</p>
            ) : (
              <div className="space-y-1.5">
                {shown.map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.user.profile_picture
                        ? <img src={m.user.profile_picture} className="w-full h-full object-cover" alt="" />
                        : <span className="text-[11px] font-semibold text-gray-500">{(m.user.display_name || m.user.username).charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-gray-800 truncate">{m.user.display_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{m.role.name}</p>
                    </div>
                  </div>
                ))}
                {drawerMembers.length > 6 && (
                  <p className="text-[11.5px] text-gray-400 pl-2 pt-0.5">+ {drawerMembers.length - 6} more members</p>
                )}
              </div>
            )}
          </div>

          {/* Sub-departments */}
          {subDepts.length > 0 && (
            <div>
              <p className="text-[12.5px] font-semibold text-gray-900 mb-2.5">
                Sub-departments <span className="text-gray-400 font-normal">({subDepts.length})</span>
              </p>
              <div className="space-y-1.5">
                {subDepts.map(s => (
                  <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
                    <Building2 size={12} className="text-gray-400 shrink-0" />
                    <span className="text-[12.5px] text-gray-700 flex-1 truncate">{s.name}</span>
                    <span className="text-[11px] text-gray-400">{s.member_count} members</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12.5px] font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={onArchiveConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12.5px] font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
          >
            {dept.is_active ? <Archive size={12} /> : <RotateCcw size={12} />}
            {dept.is_active ? 'Archive' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Count Popover ───────────────────────────────────────────────────────

function MemberPopover({ dept, pos, members, loading, onClose }: {
  dept: Department;
  pos: { top: number; left: number };
  members: OrgMember[];
  loading: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const closeScroll = () => onClose();
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', closeScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', closeScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-2"
    >
      <p className="px-3 pb-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
        {dept.member_count} Members — {dept.name}
      </p>
      <div className="max-h-52 overflow-y-auto pt-1">
        {loading ? (
          <div className="px-3 py-2 space-y-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-gray-400">No members assigned.</p>
        ) : (
          members.slice(0, 8).map(m => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                {m.user.profile_picture
                  ? <img src={m.user.profile_picture} className="w-full h-full object-cover" alt="" />
                  : <span className="text-[9px] font-semibold text-gray-500">{(m.user.display_name || m.user.username).charAt(0).toUpperCase()}</span>}
              </div>
              <p className="text-[12px] text-gray-800 truncate flex-1">{m.user.display_name}</p>
            </div>
          ))
        )}
        {!loading && members.length > 8 && (
          <p className="px-3 py-1.5 text-[11px] text-gray-400">+ {members.length - 8} more</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ tab, search, onClear, onAdd, canManage }: {
  tab: 'all' | 'active' | 'inactive';
  search: string;
  onClear: () => void;
  onAdd: () => void;
  canManage: boolean;
}) {
  if (search) {
    return (
      <div className="py-16 text-center">
        <Search size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-[14px] font-medium text-gray-600">No results for &ldquo;{search}&rdquo;</p>
        <p className="text-[12.5px] text-gray-400 mt-1">Try a different search term</p>
        <button
          onClick={onClear}
          className="mt-4 px-4 py-2 text-[12.5px] font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
        >
          Clear search
        </button>
      </div>
    );
  }

  if (tab === 'all') {
    return (
      <div className="py-16 text-center">
        <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-[14px] font-medium text-gray-600">No departments yet</p>
        <p className="text-[12.5px] text-gray-400 mt-1">Create your first department to get started</p>
        {canManage && (
          <button
            onClick={onAdd}
            className="mt-4 px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
          >
            + Create Department
          </button>
        )}
      </div>
    );
  }

  if (tab === 'active') {
    return (
      <div className="py-16 text-center">
        <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-[14px] font-medium text-gray-600">No active departments</p>
        <p className="text-[12.5px] text-gray-400 mt-1">All departments are currently archived</p>
      </div>
    );
  }

  return (
    <div className="py-16 text-center">
      <Archive size={32} className="text-gray-200 mx-auto mb-3" />
      <p className="text-[14px] font-medium text-gray-600">No archived departments</p>
      <p className="text-[12.5px] text-gray-400 mt-1">No departments have been archived yet</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgDepartments() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const canManage = isSuperadmin || canManageMembers;
  const navigate = useNavigate();

  // Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers]         = useState<OrgMember[]>([]);
  const [stats, setStats]             = useState<DeptStats | null>(null);
  const [loading, setLoading]         = useState(true);

  // Filtering / pagination
  const [tab, setTab]               = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch]         = useState('');
  const [headFilter, setHeadFilter] = useState('');
  const [page, setPage]             = useState(1);

  // Sorting
  const [sortCol, setSortCol] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Bulk selection
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Modals
  const [editTarget, setEditTarget]               = useState<Department | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget]           = useState<Department | null>(null);
  const [archiveTarget, setArchiveTarget]         = useState<Department | null>(null);
  const [assignHeadTarget, setAssignHeadTarget]   = useState<Department | null>(null);
  const [manageHeadsOpen, setManageHeadsOpen]     = useState(false);

  // Drawer
  const [drawerDept, setDrawerDept] = useState<Department | null>(null);

  // Member count popover
  const [popoverDept, setPopoverDept]       = useState<Department | null>(null);
  const [popoverPos, setPopoverPos]         = useState({ top: 0, left: 0 });
  const [popoverMembers, setPopoverMembers] = useState<OrgMember[]>([]);
  const [popoverLoading, setPopoverLoading] = useState(false);

  // More dropdown
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [d, m, s] = await Promise.all([
        orgApi.getDepartments(),
        canManage ? orgApi.getMembers()         : Promise.resolve([] as OrgMember[]),
        canManage ? orgApi.getDepartmentStats() : Promise.resolve(null),
      ]);
      setDepartments(d);
      setMembers(m);
      setStats(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = departments.filter(d => {
    if (tab === 'active'   && !d.is_active) return false;
    if (tab === 'inactive' &&  d.is_active) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (headFilter && d.head_id?.toString() !== headFilter) return false;
    return true;
  });

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sorted = sortCol ? [...filtered].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (av === null && bv === null) return 0;
    if (av === null) return sortDir === 'asc' ? -1 : 1;
    if (bv === null) return sortDir === 'asc' ? 1 : -1;
    return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
  }) : filtered;

  const handleSort = (col: SortKey) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const uniqueHeads = [
    ...new Map(
      departments
        .filter(d => d.head_id && d.head_name)
        .map(d => [d.head_id, { id: d.head_id!, name: d.head_name! }]),
    ).values(),
  ];

  const topLevelDepts = departments.filter(d => !d.parent_id);

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const pageIds = paginated.map(d => d.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAction = async (action: 'archive' | 'restore') => {
    setBulkSaving(true);
    await Promise.all(
      [...selected].map(id =>
        orgApi.updateDepartment(id, { is_active: action === 'restore' }).catch(() => {}),
      ),
    );
    setSelected(new Set());
    setBulkSaving(false);
    load();
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} department(s)? This cannot be undone.`)) return;
    setBulkSaving(true);
    for (const id of [...selected]) {
      await orgApi.deleteDepartment(id).catch(() => {});
    }
    setSelected(new Set());
    setBulkSaving(false);
    load();
  };

  // ── Member count popover ───────────────────────────────────────────────────
  const openPopover = async (e: React.MouseEvent, dept: Department) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverPos({ top: r.bottom + 4, left: r.left });
    setPopoverDept(dept);
    setPopoverLoading(true);
    setPopoverMembers([]);
    try {
      const res = await orgApi.getMembers({ deptId: dept.id });
      setPopoverMembers(res);
    } catch { /* ignore */ }
    setPopoverLoading(false);
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Name', 'Description', 'Head', 'Employees', 'Status', 'Created'],
      ...departments.map(d => [
        d.name, d.description, d.head_name ?? '',
        String(d.member_count), d.is_active ? 'Active' : 'Inactive',
        new Date(d.created_at).toLocaleDateString(),
      ]),
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'departments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const archiveAllActive = async () => {
    const active = departments.filter(d => d.is_active);
    await Promise.all(active.map(d => orgApi.updateDepartment(d.id, { is_active: false }).catch(() => {})));
    if (active.length) load();
    setMoreOpen(false);
  };

  const tabCount = (t: 'all' | 'active' | 'inactive') =>
    t === 'all'      ? departments.length
    : t === 'active' ? departments.filter(d => d.is_active).length
    : departments.filter(d => !d.is_active).length;

  const chartData = [
    { name: 'Active',   value: stats?.active_departments   ?? 0 },
    { name: 'Inactive', value: stats?.inactive_departments ?? 0 },
  ];
  const total = stats?.total_departments ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 items-start">

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <nav className="flex items-center gap-1 mb-1.5 text-[11.5px]" aria-label="Breadcrumb">
              <button
                onClick={() => navigate('/org/members')}
                className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Users & Roles
              </button>
              <ChevronRight size={11} className="text-gray-300" />
              <span className="font-semibold text-gray-900">Departments</span>
            </nav>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Departments Overview</h1>
              <PageHelp title="How Departments Work" sections={DEPARTMENTS_HELP} />
            </div>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Organize and manage organization departments and their structure
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={12} /> Export
            </button>
            {canManage && (
              <button
                onClick={() => setEditTarget('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus size={12} /> Add Department
              </button>
            )}
            {canManage && (
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen(p => !p)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  More <ChevronDown size={11} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-20">
                    <button
                      onClick={() => { setManageHeadsOpen(true); setMoreOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                    >
                      <Users size={12} /> Manage Department Heads
                    </button>
                    <button
                      onClick={archiveAllActive}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50"
                    >
                      <Archive size={12} /> Archive All Active
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-gray-200 mb-3">
          {(['all', 'active', 'inactive'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); setSelected(new Set()); }}
              className={[
                'px-3 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {t === 'all' ? 'All Departments' : t === 'active' ? 'Active' : 'Inactive'}
              <span className="ml-1 text-[10.5px] text-gray-400">({tabCount(t)})</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search departments…"
              className="w-full pl-7 pr-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
            />
          </div>
          <select
            value={headFilter}
            onChange={e => { setHeadFilter(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">All Department Heads</option>
            {uniqueHeads.map(h => (
              <option key={h.id} value={String(h.id)}>{h.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              tab={tab}
              search={search}
              onClear={() => setSearch('')}
              onAdd={() => setEditTarget('new')}
              canManage={canManage}
            />
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/60">
                    {canManage && (
                      <th className="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900 cursor-pointer"
                        />
                      </th>
                    )}
                    <SortTh label="Department Name" col="name"                   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-4 py-2" />
                    <SortTh label="Head"            col="head_name"              sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-3 py-2" />
                    <SortTh label="Employees"       col="member_count"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-3 py-2" />
                    <SortTh label="Sub-depts"       col="sub_department_count"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-3 py-2" />
                    <SortTh label="Status"          col="is_active"              sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-3 py-2" />
                    <SortTh label="Created"         col="created_at"             sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="px-3 py-2" />
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(dept => (
                    <tr
                      key={dept.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => setDrawerDept(dept)}
                    >
                      {canManage && (
                        <td className="w-8 px-3 py-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(dept.id)}
                            onChange={() => toggleSelect(dept.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                            <Building2 size={13} className="text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-gray-900 truncate">{dept.name}</p>
                            {dept.description && (
                              <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{dept.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-gray-600">
                        {dept.head_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td
                        className="px-3 py-2"
                        onClick={e => dept.member_count > 0 ? openPopover(e, dept) : e.stopPropagation()}
                      >
                        <span className={`text-[12.5px] ${dept.member_count > 0
                          ? 'font-medium text-gray-900 underline underline-offset-2 decoration-dashed decoration-gray-400 cursor-pointer hover:text-gray-600'
                          : 'text-gray-400'}`}>
                          {dept.member_count}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12.5px] text-gray-500">
                        {dept.sub_department_count > 0
                          ? dept.sub_department_count
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={dept.is_active
                          ? 'text-[12px] font-medium text-gray-800'
                          : 'text-[12px] text-gray-400'}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-500">
                        {new Date(dept.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        {canManage && (
                          <RowMenu
                            dept={dept}
                            onEdit={() => setEditTarget(dept)}
                            onDelete={() => setDeleteTarget(dept)}
                            onArchiveConfirm={() => setArchiveTarget(dept)}
                            onAssignHead={() => setAssignHeadTarget(dept)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[12px] text-gray-500">
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)} to{' '}
                  {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} departments
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={[
                        'w-7 h-7 rounded-lg text-[12px] font-medium transition-colors',
                        page === i + 1
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100',
                      ].join(' ')}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-[248px] shrink-0 space-y-3 sticky top-4">

        {/* Departments Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-[13px] font-semibold text-gray-900 mb-2">Departments Summary</p>
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <PieChart width={76} height={76}>
                <Pie
                  data={chartData}
                  cx={38}
                  cy={38}
                  innerRadius={22}
                  outerRadius={35}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[13px] font-bold text-gray-900 leading-none">{total}</p>
                <p className="text-[8px] text-gray-400 mt-0.5">Total</p>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-900 shrink-0" />
                <span className="text-[11px] text-gray-600 flex-1">Active</span>
                <span className="text-[11px] font-semibold text-gray-900">
                  {stats?.active_departments ?? 0} ({total ? Math.round((stats?.active_departments ?? 0) / total * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-200 border border-gray-300 shrink-0" />
                <span className="text-[11px] text-gray-600 flex-1">Inactive</span>
                <span className="text-[11px] font-semibold text-gray-900">
                  {stats?.inactive_departments ?? 0} ({total ? Math.round((stats?.inactive_departments ?? 0) / total * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Employees</p>
              <p className="text-[14px] font-bold text-gray-900">{stats?.total_employees ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg team size</p>
              <p className="text-[14px] font-bold text-gray-900">{stats?.avg_team_size ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {canManage && (
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[13px] font-semibold text-gray-900 mb-1.5">Quick Actions</p>
            <div className="divide-y divide-gray-100">
              {[
                { icon: <Plus size={12} />,    label: 'Add Department',       action: () => setEditTarget('new') },
                { icon: <UserCog size={12} />, label: 'Assign Head',           action: () => setAssignHeadTarget(departments[0] ?? null) },
                { icon: <Users size={12} />,   label: 'Manage All Heads',     action: () => setManageHeadsOpen(true) },
                { icon: <Archive size={12} />, label: 'Archive Active Depts', action: archiveAllActive },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className="flex items-center gap-2 w-full py-2 text-[12px] text-gray-700 hover:text-gray-900 transition-colors text-left"
                >
                  <span className="text-gray-400">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Department Hierarchy */}
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-[13px] font-semibold text-gray-900 mb-1.5">Department Hierarchy</p>
          <div className="max-h-[240px] overflow-y-auto">
            {departments.length === 0 ? (
              <p className="text-[12px] text-gray-400 py-3 text-center">No departments yet</p>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 px-1.5 rounded mb-0.5">
                  <ChevronDown size={11} className="text-gray-400 shrink-0" />
                  <Building2 size={11} className="text-gray-500 shrink-0" />
                  <span className="text-[12px] font-semibold text-gray-700">Organization</span>
                </div>
                {topLevelDepts.map(d => (
                  <HierarchyNode key={d.id} dept={d} all={departments} level={1} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bulk Action Bar ────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-2xl shadow-2xl">
            <button
              onClick={() => setSelected(new Set())}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={13} />
            </button>
            <span className="text-[12.5px] font-medium pr-2 border-r border-white/20">
              {selected.size} selected
            </span>
            <button
              onClick={() => bulkAction('archive')}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <Archive size={12} /> Archive
            </button>
            <button
              onClick={() => bulkAction('restore')}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} /> Restore
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {editTarget && (
        <DeptModal
          dept={editTarget === 'new' ? null : editTarget}
          departments={departments}
          members={members}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          dept={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={load}
        />
      )}
      {archiveTarget && (
        <ConfirmArchiveModal
          dept={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onSaved={load}
        />
      )}
      {assignHeadTarget && (
        <AssignHeadModal
          dept={assignHeadTarget}
          members={members}
          onClose={() => setAssignHeadTarget(null)}
          onSaved={load}
        />
      )}
      {manageHeadsOpen && (
        <ManageHeadsModal
          departments={departments}
          members={members}
          onClose={() => setManageHeadsOpen(false)}
          onSaved={load}
        />
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {drawerDept && (
        <DeptDrawer
          dept={drawerDept}
          departments={departments}
          onClose={() => setDrawerDept(null)}
          onEdit={() => { setEditTarget(drawerDept); setDrawerDept(null); }}
          onArchiveConfirm={() => { setArchiveTarget(drawerDept); setDrawerDept(null); }}
        />
      )}

      {/* ── Member Count Popover ──────────────────────────────────────────── */}
      {popoverDept && (
        <MemberPopover
          dept={popoverDept}
          pos={popoverPos}
          members={popoverMembers}
          loading={popoverLoading}
          onClose={() => setPopoverDept(null)}
        />
      )}
    </div>
  );
}
