import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Upload, Plus, Pencil, Trash2, X, Search,
  Building2, CheckCircle2, AlertCircle, Users, ChevronDown, ChevronRight,
  MoreVertical, Eye, Copy, ToggleLeft, ToggleRight,
  Download, Settings2, FileUp, SlidersHorizontal, Calendar,
} from 'lucide-react';
import {
  docApi, orgApi,
  type DocumentTemplate, type DocCategory, type OrgMember, type Department,
} from '../api/orgApi';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const DOC_TEMPLATES_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is a Document Template?',
    bullets: [
      'A **document template** is a reusable file (PDF, Word, image) you assign to members for review, upload, or signature.',
      'Common examples: NDA, study contract, offer letter, code of conduct, parental consent.',
      'Members see their assigned documents in **My Documents**; admins review submissions in **All Documents**.',
    ],
  },
  {
    eyebrow: '2 · Create a Template',
    bullets: [
      'Click **+ Create New Template** to upload a file with a name, category, and description.',
      'Choose a **category** (Required / Optional / Certificate / Policy etc.) — categories drive how it surfaces to members.',
      'Mark **Active** to make it available for assignment.',
    ],
  },
  {
    eyebrow: '3 · Assign to Members',
    bullets: [
      'Click the row 3-dot menu → **Assign** to choose recipients (individuals or whole departments).',
      'Members are notified and the document appears in their **My Documents** page.',
      'Track per-member status: Pending / Uploaded / Signed / Approved.',
    ],
  },
  {
    eyebrow: '4 · Use Inside Onboarding Tasks',
    bullets: [
      'Document templates can also be referenced from an **Upload** or **Info** task inside a Task Template.',
      'This lets a single document flow as part of a larger onboarding program.',
    ],
  },
  {
    eyebrow: '5 · Review, Toggle, Replace',
    bullets: [
      'Use the row 3-dot menu to **Toggle Active**, **Replace File** (version up), or **Delete**.',
      'Inactive templates remain visible to members who already have them assigned, but cannot be assigned to new members.',
      'The **Used In** column shows how many active assignments reference the template.',
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days < 7)    return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (weeks < 5)   return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}

const fmtDocId = (id: number) => `DOC-${String(id).padStart(3, '0')}`;

const CAT_COLORS: Record<DocCategory, string> = {
  required:    'text-red-600',
  policy:      'text-blue-600',
  form:        'text-purple-600',
  certificate: 'text-amber-600',
  agreement:   'text-teal-600',
};
const CAT_LABELS: Record<DocCategory, string> = {
  required: 'Required', policy: 'Policy', form: 'Form', certificate: 'Certificate',
  agreement: 'Agreement',
};

const PAGE_SIZE = 8;

// ── Row Menu ──────────────────────────────────────────────────────────────────

function DocRowMenu({ tmpl, onEdit, onDelete, onDuplicate, onToggleActive, onAssign, onPreview }: {
  tmpl: DocumentTemplate;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
  onToggleActive: () => void; onAssign: () => void; onPreview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const estimatedH = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < estimatedH ? Math.max(8, rect.top - estimatedH - 4) : rect.bottom + 4;
    setPos({ top, left: rect.right - 210 });
    setOpen(true);
    setTimeout(() => {
      const close = (ev: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
          setOpen(false);
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  };

  const act = (fn: () => void) => { setOpen(false); fn(); };

  const menu = (
    <div ref={menuRef}
      className="fixed bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-[9999] min-w-[180px] overflow-hidden"
      style={{ top: pos.top, left: pos.left }}>
      <button onClick={() => act(onPreview)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors">
        <Eye size={13} className="text-gray-400 shrink-0" /> Preview Template
      </button>
      <button onClick={() => act(onEdit)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors">
        <Pencil size={13} className="text-gray-400 shrink-0" /> Edit Template
      </button>
      <button onClick={() => act(onDuplicate)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors">
        <Copy size={13} className="text-gray-400 shrink-0" /> Duplicate
      </button>
      <button onClick={() => act(onAssign)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors">
        <Users size={13} className="text-gray-400 shrink-0" /> Assign to Members
      </button>
      <button onClick={() => act(onToggleActive)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-gray-600 hover:bg-gray-50 transition-colors">
        {tmpl.is_active
          ? <ToggleLeft size={13} className="text-amber-500 shrink-0" />
          : <ToggleRight size={13} className="text-teal-500 shrink-0" />}
        {tmpl.is_active ? 'Deactivate' : 'Activate'}
      </button>
      <div className="my-0.5 border-t border-gray-100" />
      <button onClick={() => act(onDelete)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 size={13} className="shrink-0" /> Delete Template
      </button>
    </div>
  );

  return (
    <>
      {open && createPortal(menu, document.body)}
      <button ref={btnRef} onClick={openMenu}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <MoreVertical size={15} />
      </button>
    </>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DocDetailPanel({ tmpl, onClose, onEdit, onDuplicate, onToggleActive, onDelete, onAssign, toggling }: {
  tmpl: DocumentTemplate; onClose: () => void;
  onEdit: () => void; onDuplicate: () => void; onToggleActive: () => void;
  onDelete: () => void; onAssign: () => void; toggling: boolean;
}) {
  return (
    <div className="w-[280px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <p className="text-[12px] font-bold text-gray-900">Template Details</p>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={12} /></button>
      </div>

      <div className="px-3.5 py-3 space-y-3 flex-1">
        {/* Icon + name + status */}
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={14} className="text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 leading-snug">{tmpl.name}</p>
            {tmpl.description && (
              <p className="text-[10.5px] text-gray-500 mt-0.5 leading-relaxed">{tmpl.description}</p>
            )}
          </div>
          <span className={`shrink-0 text-[10.5px] font-semibold ${tmpl.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
            {tmpl.is_active ? 'Active' : 'Draft'}
          </span>
        </div>

        <div className="border-t border-gray-100" />

        {/* Meta grid */}
        <div className="space-y-2">
          {[
            { label: 'Category',           value: CAT_LABELS[tmpl.category] },
            { label: 'Applies To',         value: tmpl.department_name || 'All Departments' },
            { label: 'Used In Onboardings',value: String(tmpl.used_in_count) },
            {
              label: 'Last Updated',
              value: timeAgo(tmpl.created_at),
              sub: tmpl.created_by_name ? `by ${tmpl.created_by_name}` : undefined,
            },
            { label: 'Template ID',        value: fmtDocId(tmpl.id) },
          ].map(r => (
            <div key={r.label} className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-gray-500 shrink-0">{r.label}</p>
              <div className="text-right">
                <p className="text-[11.5px] font-semibold text-gray-800">{r.value}</p>
                {r.sub && <p className="text-[10px] text-gray-400">{r.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Description section */}
        {tmpl.description && (
          <>
            <div className="border-t border-gray-100" />
            <div>
              <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
              <p className="text-[11px] text-gray-600 leading-relaxed">{tmpl.description}</p>
            </div>
          </>
        )}

        <div className="border-t border-gray-100" />

        {/* Template settings */}
        <div>
          <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mb-2">Template Settings</p>
          <div className="space-y-2">
            {[
              { label: 'Visible to',               value: tmpl.visible_to || 'All Departments' },
              { label: 'Assignable by',             value: tmpl.assignable_by || 'HR Admin' },
              { label: 'Approval Required',         value: tmpl.approval_required ? 'Yes' : 'No' },
              { label: 'Auto request in onboarding',value: tmpl.auto_request_in_onboarding ? 'Yes' : 'No' },
              { label: 'Reminder',                  value: tmpl.reminder_enabled ? 'Enabled' : 'Disabled' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500">{r.label}</p>
                <p className="text-[11.5px] font-semibold text-gray-800 text-right">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3.5 py-2.5 border-t border-gray-100 space-y-1.5 shrink-0">
        <button onClick={() => tmpl.file_url ? window.open(tmpl.file_url, '_blank') : undefined}
          disabled={!tmpl.file_url}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
          <Eye size={12} /> Preview Template
        </button>
        <button onClick={onEdit}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          <Pencil size={12} /> Edit Template
        </button>
        <button onClick={onDuplicate}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-gray-200 rounded-lg text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          <Copy size={12} /> Duplicate Template
        </button>
        <button onClick={onToggleActive} disabled={toggling}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-[12px] font-semibold text-gray-600 disabled:opacity-50 transition-colors">
          {tmpl.is_active ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
          {tmpl.is_active ? 'Deactivate Template' : 'Activate Template'}
        </button>
      </div>
    </div>
  );
}

// ── Template Modal (Create / Edit / Duplicate) ────────────────────────────────

function TemplateModal({ template, departments, onClose, onSaved }: {
  template?: DocumentTemplate | null;
  isDuplicate?: boolean;
  departments: Department[];
  onClose: () => void;
  onSaved: (t: DocumentTemplate) => void;
}) {
  const [name, setName]           = useState(template?.name ?? '');
  const [description, setDesc]    = useState(template?.description ?? '');
  const [category, setCategory]   = useState<DocCategory>(template?.category ?? 'required');
  const [version, setVersion]     = useState(template?.version ?? '1.0');
  const [deptId, setDeptId]       = useState<number | null>(null);
  const [mandatory, setMandatory] = useState(template?.is_mandatory ?? true);
  const [requiresSig, setReqSig]  = useState(template?.requires_signature ?? false);
  const [allowResign, setAllowResign] = useState(template?.allow_resign ?? false);
  const [expMonths, setExpMonths] = useState(template?.expiration_months ?? 0);
  const [isActive, setIsActive]   = useState(template?.is_active ?? true);
  const [visibleTo, setVisibleTo] = useState(template?.visible_to ?? 'All Departments');
  const [assignableBy, setAssignBy] = useState(template?.assignable_by ?? 'HR Admin, Managers');
  const [approvalReq, setApproval]  = useState(template?.approval_required ?? false);
  const [autoReq, setAutoReq]       = useState(template?.auto_request_in_onboarding ?? false);
  const [reminder, setReminder]     = useState(template?.reminder_enabled ?? false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!template?.id;

  const submit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description);
      fd.append('category', category);
      fd.append('version', version);
      fd.append('is_mandatory', String(mandatory));
      fd.append('requires_signature', String(requiresSig));
      fd.append('allow_resign', String(allowResign));
      fd.append('expiration_months', String(expMonths));
      fd.append('is_active', String(isActive));
      fd.append('visible_to', visibleTo);
      fd.append('assignable_by', assignableBy);
      fd.append('approval_required', String(approvalReq));
      fd.append('auto_request_in_onboarding', String(autoReq));
      fd.append('reminder_enabled', String(reminder));
      if (deptId) fd.append('department_id', String(deptId));
      if (fileRef.current?.files?.[0]) fd.append('file', fileRef.current.files[0]);
      const saved = isEdit
        ? await docApi.updateDocTemplate(template!.id, fd)
        : await docApi.createDocTemplate(fd);
      onSaved(saved);
    } catch {
      setError('Failed to save template.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-[14px] font-bold text-gray-900">
            {isEdit ? 'Edit Template' : 'New Document Template'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Name + Description */}
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NDA Agreement"
              className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Brief description of this template..."
              className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none" />
          </div>

          {/* Category + Version */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as DocCategory)}
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white">
                {(Object.entries(CAT_LABELS) as [DocCategory, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0"
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
          </div>

          {/* Department + Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Department</label>
              <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white">
                <option value="">All departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Expiry (months, 0=never)</label>
              <input type="number" min={0} value={expMonths} onChange={e => setExpMonths(Number(e.target.value))}
                className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
          </div>

          {/* Template Settings */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Template Settings</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Visible To</label>
                <input value={visibleTo} onChange={e => setVisibleTo(e.target.value)}
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
              </div>
              <div>
                <label className="block text-[10.5px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">Assignable By</label>
                <input value={assignableBy} onChange={e => setAssignBy(e.target.value)}
                  className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                { label: 'Mandatory',                   state: mandatory,    set: setMandatory },
                { label: 'Requires Signature',          state: requiresSig,  set: setReqSig },
                { label: 'Allow Re-sign',               state: allowResign,  set: setAllowResign },
                { label: 'Approval Required',           state: approvalReq,  set: setApproval },
                { label: 'Auto Request in Onboarding',  state: autoReq,      set: setAutoReq },
                { label: 'Reminder Enabled',            state: reminder,     set: setReminder },
                { label: 'Active',                      state: isActive,     set: setIsActive },
              ].map(({ label, state, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={state} onChange={e => set(e.target.checked)} className="w-3.5 h-3.5 accent-teal-500" />
                  <span className="text-[12px] text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* File */}
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              {isEdit ? 'Replace File (optional)' : 'File (optional)'}
            </label>
            <input type="file" ref={fileRef}
              className="w-full text-[12px] text-gray-600 file:mr-3 file:text-[11.5px] file:font-semibold file:px-3 file:py-1 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 text-[12.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-xl">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (t: DocumentTemplate) => void }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview]   = useState<object | null>(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setPreview(data); setError('');
      } catch {
        setError('Invalid JSON file.'); setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    if (!preview) return;
    setSaving(true); setError('');
    try {
      const tmpl = await docApi.importDocTemplate(preview);
      onImported(tmpl);
    } catch {
      setError('Import failed. Check JSON structure.');
    } finally { setSaving(false); }
  };

  const p = preview as Record<string, unknown> | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">Import Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'}`}>
            <FileUp size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-[12.5px] font-semibold text-gray-600">Drop a JSON file here or click to browse</p>
            <p className="text-[11px] text-gray-400 mt-1">{"{ name, description, category, version, ... }"}</p>
            <input type="file" accept=".json" ref={fileRef} className="hidden"
              onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
          </div>

          {/* Preview */}
          {p && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Preview</p>
              {[
                { label: 'Name',     value: String(p.name ?? '—') },
                { label: 'Category', value: String(p.category ?? 'required') },
                { label: 'Version',  value: String(p.version ?? '1.0') },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-500">{r.label}</p>
                  <p className="text-[11.5px] font-semibold text-gray-800">{r.value}</p>
                </div>
              ))}
              <p className="text-[10.5px] text-amber-600 mt-1">Will be created as a Draft (inactive)</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
          <button onClick={handleImport} disabled={!preview || saving}
            className="px-4 py-2 text-[12.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-40 rounded-xl">
            {saving ? 'Importing…' : 'Import Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Modal ──────────────────────────────────────────────────────────────

function AssignModal({ template, members, departments, onClose, onAssigned }: {
  template: DocumentTemplate; members: OrgMember[];
  departments: Department[]; onClose: () => void; onAssigned: () => void;
}) {
  const [mode, setMode]         = useState<'users' | 'dept' | 'all'>('users');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [deptId, setDeptId]     = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);
  const [count, setCount]       = useState(0);

  const filtered = members.filter(m =>
    m.user.display_name.toLowerCase().includes(search.toLowerCase()) ||
    m.user.email.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const assign = async () => {
    setSaving(true);
    try {
      const res = await docApi.assignDocTemplate(template.id, {
        ...(mode === 'all' ? { assign_all: true } : {}),
        ...(mode === 'users' ? { user_ids: selected.map(id => members.find(m => m.id === id)!.user.id) } : {}),
        ...(mode === 'dept' && deptId ? { department_id: deptId } : {}),
      } as Parameters<typeof docApi.assignDocTemplate>[1] & { assign_all?: boolean });
      setCount(res.created); setDone(true); onAssigned();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">Assign — {template.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-emerald-500" />
            </div>
            <p className="text-[13.5px] font-semibold text-gray-700">{count} assignment{count !== 1 ? 's' : ''} created</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 text-[12.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-xl">Done</button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 space-y-4">
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(['users', 'dept', 'all'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 text-[12px] font-semibold transition-colors ${mode === m ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {m === 'users' ? 'Specific Users' : m === 'dept' ? 'By Department' : 'All Active'}
                  </button>
                ))}
              </div>
              {mode === 'all' ? (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[12.5px] font-semibold text-gray-700">Assign to All Active Members</p>
                  <p className="text-[11.5px] text-gray-500 mt-1">This will create an assignment for every active org member. Existing assignments are skipped.</p>
                </div>
              ) : mode === 'users' ? (
                <>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
                      className="w-full pl-8 pr-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {filtered.map(m => (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="w-3.5 h-3.5 accent-teal-500" />
                        <div>
                          <p className="text-[12.5px] font-semibold text-gray-800">{m.user.display_name}</p>
                          <p className="text-[11px] text-gray-400">{m.user.email}</p>
                        </div>
                      </label>
                    ))}
                    {filtered.length === 0 && <p className="text-[12px] text-gray-400 text-center py-4">No members found</p>}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10.5px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Department</label>
                  <select value={deptId ?? ''} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 text-[12.5px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white">
                    <option value="">Select department...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 rounded-xl">Cancel</button>
              <button onClick={assign} disabled={saving || (mode === 'users' ? selected.length === 0 : mode === 'dept' ? !deptId : false)}
                className="px-4 py-2 text-[12.5px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-xl">
                {saving ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OrgDocTemplates() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromAgreements = (location.state as { from?: string } | null)?.from === 'agreements';
  const backLabel = fromAgreements ? 'Agreements' : 'Onboarding Management';
  const backPath  = fromAgreements ? '/org/documents' : '/org/onboarding-mgmt';
  const [templates, setTemplates]     = useState<DocumentTemplate[]>([]);
  const [members, setMembers]         = useState<OrgMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);

  // Filters
  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('');
  const [deptFilter, setDeptFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);

  // Panels / modals
  const [detailPanel, setDetailPanel] = useState<DocumentTemplate | null>(null);
  const [creating, setCreating]       = useState(false);
  const [editing, setEditing]         = useState<DocumentTemplate | null>(null);
  const [duplicating, setDuplicating] = useState<DocumentTemplate | null>(null);
  const [assigning, setAssigning]     = useState<DocumentTemplate | null>(null);
  const [deletingTmpl, setDeletingTmpl] = useState<DocumentTemplate | null>(null);
  const [importOpen, setImportOpen]   = useState(false);
  const [toggling, setToggling]       = useState<number | null>(null);

  useEffect(() => {
    Promise.all([docApi.getDocTemplates(), orgApi.getMembers(), orgApi.getDepartments()])
      .then(([t, m, d]) => { setTemplates(t); setMembers(m); setDepartments(d); })
      .finally(() => setLoading(false));
  }, []);

  // Stats
  const stats = useMemo(() => {
    const active    = templates.filter(t => t.is_active).length;
    const usedIn    = templates.filter(t => t.used_in_count > 0).length;
    const latest    = templates.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return { total: templates.length, active, usedIn, latest };
  }, [templates]);

  // Filtered + paginated
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter(t => {
      const matchQ    = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      const matchCat  = !catFilter  || t.category === catFilter;
      const matchDept = !deptFilter || t.department_name === deptFilter;
      const matchSt   = !statusFilter || (statusFilter === 'active' ? t.is_active : !t.is_active);
      return matchQ && matchCat && matchDept && matchSt;
    });
  }, [templates, search, catFilter, deptFilter, statusFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const uniqueDepts = useMemo(() =>
    [...new Set(templates.map(t => t.department_name).filter(Boolean))] as string[],
    [templates]);

  const resetPage = () => setPage(1);

  // Actions
  const handleDelete = async () => {
    if (!deletingTmpl) return;
    try {
      await docApi.deleteDocTemplate(deletingTmpl.id);
      setTemplates(ts => ts.filter(t => t.id !== deletingTmpl.id));
      if (detailPanel?.id === deletingTmpl.id) setDetailPanel(null);
    } catch { /* ignore */ }
    finally { setDeletingTmpl(null); }
  };

  const handleToggleActive = async (tmpl: DocumentTemplate) => {
    setToggling(tmpl.id);
    try {
      const updated = await docApi.toggleDocTemplate(tmpl.id, !tmpl.is_active);
      setTemplates(ts => ts.map(t => t.id === updated.id ? updated : t));
      if (detailPanel?.id === updated.id) setDetailPanel(updated);
    } catch { /* ignore */ }
    finally { setToggling(null); }
  };

  const handleSaved = (saved: DocumentTemplate) => {
    setTemplates(ts => {
      const idx = ts.findIndex(t => t.id === saved.id);
      return idx >= 0 ? ts.map(t => t.id === saved.id ? saved : t) : [saved, ...ts];
    });
    setCreating(false); setEditing(null); setDuplicating(null);
    setDetailPanel(saved);
  };

  const openDuplicate = (tmpl: DocumentTemplate) => {
    // Open create modal pre-filled (will POST as new)
    setDuplicating({ ...tmpl, id: 0, name: `${tmpl.name} (Copy)`, is_active: false } as DocumentTemplate);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-40" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <nav className="flex items-center gap-1 mb-1.5 text-[11.5px]" aria-label="Breadcrumb">
            <button
              onClick={() => navigate(backPath)}
              className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              {backLabel}
            </button>
            <ChevronRight size={11} className="text-gray-300" />
            <span className="font-semibold text-gray-900">Doc Templates</span>
          </nav>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Document Templates</h1>
            <PageHelp title="How Document Templates Work" sections={DOC_TEMPLATES_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">Create, manage and reuse document templates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
            <Download size={12} /> Import Template
          </button>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
            <Plus size={12} /> Create New Template
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search templates by name or description..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
        </div>
        {[
          {
            value: catFilter, set: (v: string) => { setCatFilter(v); resetPage(); },
            placeholder: 'All Categories',
            options: Object.entries(CAT_LABELS).map(([k, v]) => ({ value: k, label: v })),
          },
          {
            value: deptFilter, set: (v: string) => { setDeptFilter(v); resetPage(); },
            placeholder: 'All Departments',
            options: uniqueDepts.map(d => ({ value: d, label: d })),
          },
          {
            value: statusFilter, set: (v: string) => { setStatusFilter(v); resetPage(); },
            placeholder: 'All Status',
            options: [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }],
          },
        ].map((f, i) => (
          <div key={i} className="relative">
            <select value={f.value} onChange={e => f.set(e.target.value)}
              className="pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white appearance-none min-w-[120px]">
              <option value="">{f.placeholder}</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        ))}
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <SlidersHorizontal size={12} /> Filters
        </button>
      </div>

      {/* Main content: table + optional right panel */}
      <div className="flex flex-1 min-h-0 gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_60px_90px_140px_44px] gap-0 px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
            {['Template Name', 'Category', 'Applies To', 'Used In', 'Status', 'Last Updated', 'Actions'].map(h => (
              <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</p>
            ))}
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
                  <FileText size={24} className="text-teal-400" />
                </div>
                <p className="text-[14px] font-semibold text-gray-700">No templates found</p>
                <p className="text-[12px] text-gray-400 mt-1">Try adjusting your filters or create a new template.</p>
              </div>
            ) : paginated.map(t => (
              <div key={t.id}
                onClick={() => setDetailPanel(prev => prev?.id === t.id ? null : t)}
                className={`grid grid-cols-[2fr_1fr_1fr_60px_90px_140px_44px] gap-0 px-4 py-2 cursor-pointer transition-colors ${detailPanel?.id === t.id ? 'bg-teal-50/60' : 'hover:bg-gray-50'}`}>

                {/* Template Name */}
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <FileText size={13} className="text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900 leading-tight truncate">{t.name}</p>
                    {t.description && (
                      <p className="text-[10.5px] text-gray-400 mt-0.5 truncate">{t.description}</p>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="flex items-center">
                  <span className={`text-[11.5px] font-medium ${CAT_COLORS[t.category]}`}>
                    {CAT_LABELS[t.category]}
                  </span>
                </div>

                {/* Applies To */}
                <div className="flex items-center">
                  <p className="text-[11.5px] text-gray-600 truncate">{t.department_name || 'All Departments'}</p>
                </div>

                {/* Used In */}
                <div className="flex items-center">
                  <p className="text-[12px] font-semibold text-gray-700">{t.used_in_count}</p>
                </div>

                {/* Status */}
                <div className="flex items-center">
                  <span className={`text-[11.5px] font-medium ${t.is_active ? 'text-gray-700' : 'text-amber-600'}`}>
                    {t.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>

                {/* Last Updated */}
                <div className="flex flex-col justify-center">
                  <p className="text-[11.5px] font-semibold text-gray-700">{timeAgo(t.created_at)}</p>
                  {t.created_by_name && (
                    <p className="text-[10px] text-gray-400">by {t.created_by_name}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
                  <DocRowMenu
                    tmpl={t}
                    onEdit={() => setEditing(t)}
                    onDelete={() => setDeletingTmpl(t)}
                    onDuplicate={() => openDuplicate(t)}
                    onToggleActive={() => handleToggleActive(t)}
                    onAssign={() => setAssigning(t)}
                    onPreview={() => t.file_url ? window.open(t.file_url, '_blank') : undefined}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shrink-0 px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[11.5px] text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} templates
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 text-[11.5px] text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-lg text-[11.5px] font-semibold transition-colors ${n === page ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 text-[11.5px] text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors">›</button>
              </div>
            </div>
          )}
        </div>

        {/* Right detail panel */}
        {detailPanel && (
          <DocDetailPanel
            tmpl={detailPanel}
            onClose={() => setDetailPanel(null)}
            onEdit={() => setEditing(detailPanel)}
            onDuplicate={() => openDuplicate(detailPanel)}
            onToggleActive={() => handleToggleActive(detailPanel)}
            onDelete={() => setDeletingTmpl(detailPanel)}
            onAssign={() => setAssigning(detailPanel)}
            toggling={toggling === detailPanel.id}
          />
        )}
      </div>

      {/* Create / Edit / Duplicate Modal */}
      {(creating || editing || duplicating) && (
        <TemplateModal
          template={editing ?? (duplicating ? { ...duplicating, id: 0 } as DocumentTemplate : null)}
          departments={departments}
          onClose={() => { setCreating(false); setEditing(null); setDuplicating(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Import Modal */}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)}
          onImported={t => { setTemplates(ts => [t, ...ts]); setImportOpen(false); }} />
      )}

      {/* Assign Modal */}
      {assigning && (
        <AssignModal template={assigning} members={members} departments={departments}
          onClose={() => setAssigning(null)} onAssigned={() => {}} />
      )}

      {/* Delete Confirm */}
      {deletingTmpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={17} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Delete Template?</p>
                <p className="text-[12px] text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
              <p className="text-[12.5px] font-semibold text-gray-700 truncate">"{deletingTmpl.name}"</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeletingTmpl(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[12.5px] font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
