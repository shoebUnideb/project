import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen, Search, ChevronDown, SlidersHorizontal, Plus, Upload,
  Link as LinkIcon, FileText, Trash2, Pencil, EyeOff, Eye,
  Star, StarOff, X, AlertTriangle, ChevronLeft, ChevronRight,
  Lightbulb, CloudUpload, ExternalLink, Download, Layers,
  File as FileIcon, Database, List, LayoutGrid,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { WorkspaceResource } from '../../types';
import AddResourceModal from '../../components/ui/AddResourceModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function getExtension(url?: string): string {
  if (!url) return '';
  const name = url.split('/').pop()?.split('?')[0] ?? '';
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

// ── FileTypeIcon ──────────────────────────────────────────────────────────────

const EXT_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pdf:  { bg: 'bg-red-100',    text: 'text-red-600',    label: 'PDF' },
  docx: { bg: 'bg-primary-100',   text: 'text-primary-600',   label: 'DOCX' },
  doc:  { bg: 'bg-primary-100',   text: 'text-primary-600',   label: 'DOC' },
  xlsx: { bg: 'bg-green-100',  text: 'text-green-600',  label: 'XLSX' },
  xls:  { bg: 'bg-green-100',  text: 'text-green-600',  label: 'XLS' },
  csv:  { bg: 'bg-green-100',  text: 'text-green-600',  label: 'CSV' },
  pptx: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'PPTX' },
  ppt:  { bg: 'bg-orange-100', text: 'text-orange-600', label: 'PPT' },
  zip:  { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'ZIP' },
  rar:  { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'RAR' },
  png:  { bg: 'bg-teal-100',   text: 'text-teal-600',   label: 'PNG' },
  jpg:  { bg: 'bg-teal-100',   text: 'text-teal-600',   label: 'JPG' },
  jpeg: { bg: 'bg-teal-100',   text: 'text-teal-600',   label: 'JPG' },
  gif:  { bg: 'bg-teal-100',   text: 'text-teal-600',   label: 'GIF' },
  webp: { bg: 'bg-teal-100',   text: 'text-teal-600',   label: 'IMG' },
};

function FileTypeIcon({ resource, size = 'md' }: { resource: WorkspaceResource; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-[9px]' : size === 'lg' ? 'w-12 h-12 text-[11px]' : 'w-10 h-10 text-[10px]';
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 15;

  if (resource.resource_type === 'link') {
    return (
      <div className={`${dim} rounded-lg bg-sky-100 flex items-center justify-center shrink-0`}>
        <LinkIcon size={iconSize} className="text-sky-600" />
      </div>
    );
  }
  if (resource.resource_type === 'note') {
    return (
      <div className={`${dim} rounded-lg bg-purple-100 flex items-center justify-center shrink-0`}>
        <FileText size={iconSize} className="text-purple-600" />
      </div>
    );
  }
  const ext = getExtension(resource.file_url ?? resource.file);
  const cfg = EXT_CONFIG[ext];
  if (cfg) {
    return (
      <div className={`${dim} rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
        <span className={`font-bold ${cfg.text}`}>{cfg.label}</span>
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-lg bg-gray-100 flex items-center justify-center shrink-0`}>
      <FileIcon size={iconSize} className="text-gray-500" />
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function Dropdown({ trigger, children, align = 'left', closeOnClick = true }: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  closeOnClick?: boolean;
}) {
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
    function close(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen}>{trigger}</div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]"
          onClick={closeOnClick ? () => setOpen(false) : undefined}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

function DropItem({ onClick, icon, label, danger }: {
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-[12.5px] font-medium transition-colors text-left ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel, loading }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <p className="text-[15px] font-bold text-gray-900">{title}</p>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed mb-5">{message}</p>
        <div className="flex gap-2.5">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-60 transition-colors">
            {loading ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'documents',     label: 'Documents' },
  { value: 'presentations', label: 'Presentations' },
  { value: 'guides',        label: 'Guides' },
  { value: 'links',         label: 'Links' },
  { value: 'other',         label: 'Other' },
];

function EditResourceModal({ resource, workspaceId, onClose, onSaved }: {
  resource: WorkspaceResource; workspaceId: number; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle]       = useState(resource.title);
  const [description, setDesc]  = useState(resource.description);
  const [url, setUrl]           = useState(resource.url ?? '');
  const [body, setBody]         = useState(resource.body ?? '');
  const [category, setCategory] = useState(resource.category ?? 'other');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const save = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setLoading(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.updateResource(workspaceId, resource.id, {
        title: title.trim(), description: description.trim(), category,
        ...(resource.resource_type === 'link' ? { url } : {}),
        ...(resource.resource_type === 'note' ? { body } : {}),
      });
      onSaved();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white placeholder-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        <p className="text-[15px] font-bold text-gray-900 mb-4">Edit resource</p>
        {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Description</label>
            <input value={description} onChange={e => setDesc(e.target.value)} className={inputCls} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls + ' cursor-pointer'}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {resource.resource_type === 'link' && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} className={inputCls} />
            </div>
          )}
          {resource.resource_type === 'note' && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Note content</label>
              <textarea rows={4} value={body} onChange={e => setBody(e.target.value)} className={inputCls + ' resize-none'} />
            </div>
          )}
        </div>
        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={loading}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 rounded-xl transition-colors">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UserAvatar ────────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: WorkspaceResource['posted_by'] }) {
  const initials = (user.first_name || user.last_name)
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : user.username[0].toUpperCase();
  const colors = ['bg-primary-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500'];
  const color = colors[user.username.charCodeAt(0) % colors.length];
  if (user.profile_picture) {
    return (
      <img
        src={user.profile_picture}
        alt={initials}
        className="w-6 h-6 rounded-md object-cover shrink-0"
      />
    );
  }
  return (
    <div className={`w-6 h-6 rounded-md ${color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Shared resource actions hook ──────────────────────────────────────────────

function useResourceActions(workspaceId: number, onRefetch: () => void) {
  const patch = useCallback(async (id: number, data: Record<string, unknown>) => {
    await apiClient.initCsrf();
    await workspacesApi.updateResource(workspaceId, id, data);
    onRefetch();
  }, [workspaceId, onRefetch]);

  const remove = useCallback(async (id: number) => {
    await apiClient.initCsrf();
    await workspacesApi.deleteResource(workspaceId, id);
    onRefetch();
  }, [workspaceId, onRefetch]);

  return { patch, remove };
}

// ── ResourceRowActions ─────────────────────────────────────────────────────────

function ResourceRowActions({ resource, canEdit, workspaceId, onRefetch }: {
  resource: WorkspaceResource; canEdit: boolean; workspaceId: number; onRefetch: () => void;
}) {
  const [editOpen, setEditOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const { patch, remove } = useResourceActions(workspaceId, onRefetch);

  const handleDelete = async () => {
    setDeleting(true);
    try { await remove(resource.id); } finally { setDeleting(false); }
  };

  return (
    <>
      <Dropdown
        align="right"
        trigger={
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <span className="text-[16px] font-bold leading-none tracking-wider">⋯</span>
          </button>
        }
      >
        {resource.resource_type === 'file' && resource.file_url && (
          <DropItem onClick={() => window.open(resource.file_url, '_blank')} icon={<Download size={13} />} label="Download" />
        )}
        {resource.resource_type === 'link' && resource.url && (
          <DropItem onClick={() => window.open(resource.url, '_blank')} icon={<ExternalLink size={13} />} label="Open link" />
        )}
        {canEdit && (
          <>
            <DropItem onClick={() => setEditOpen(true)} icon={<Pencil size={13} />} label="Edit" />
            <DropItem
              onClick={() => patch(resource.id, { is_featured: !resource.is_featured })}
              icon={resource.is_featured ? <StarOff size={13} /> : <Star size={13} />}
              label={resource.is_featured ? 'Unfeature' : 'Feature'}
            />
            <DropItem
              onClick={() => patch(resource.id, { is_hidden: !resource.is_hidden })}
              icon={resource.is_hidden ? <Eye size={13} /> : <EyeOff size={13} />}
              label={resource.is_hidden ? 'Show to members' : 'Hide from members'}
            />
            <div className="border-t border-gray-100 my-1" />
            <DropItem onClick={() => setDeleteOpen(true)} icon={<Trash2 size={13} />} label="Delete" danger />
          </>
        )}
      </Dropdown>
      {editOpen && (
        <EditResourceModal resource={resource} workspaceId={workspaceId}
          onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); onRefetch(); }} />
      )}
      {deleteOpen && (
        <ConfirmDialog
          title="Delete resource?"
          message={`"${resource.title}" will be permanently removed. This cannot be undone.`}
          loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)}
        />
      )}
    </>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function ResourceRow({ resource, canEdit, workspaceId, onRefetch, visibleColumns }: {
  resource: WorkspaceResource; canEdit: boolean; workspaceId: number;
  onRefetch: () => void; visibleColumns: Set<string>;
}) {
  const ext = getExtension(resource.file_url ?? resource.file);
  const typeLabel = resource.resource_type === 'file'
    ? (EXT_CONFIG[ext]?.label ?? 'File') : resource.resource_type === 'link' ? 'Link' : 'Note';
  const displayName = (resource.posted_by.first_name || resource.posted_by.last_name)
    ? `${resource.posted_by.first_name ?? ''} ${resource.posted_by.last_name ?? ''}`.trim()
    : resource.posted_by.username;

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50/60 transition-colors ${resource.is_hidden ? 'opacity-50' : ''}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <FileTypeIcon resource={resource} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-gray-900 truncate max-w-[200px]">{resource.title}</span>
              {resource.is_featured && <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full shrink-0">Featured</span>}
              {isNew(resource.created_at) && <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full shrink-0">New</span>}
              {resource.is_template && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full shrink-0 flex items-center gap-0.5">
                  <Layers size={9} />Template
                </span>
              )}
              {canEdit && resource.is_hidden && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full shrink-0 flex items-center gap-0.5">
                  <EyeOff size={9} />Hidden
                </span>
              )}
            </div>
            {resource.description && <p className="text-[11.5px] text-gray-400 truncate max-w-[240px] mt-0.5">{resource.description}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 px-4"><span className="text-[11.5px] font-medium text-gray-500">{typeLabel}</span></td>
      {visibleColumns.has('size') && <td className="py-3 px-4"><span className="text-[11.5px] text-gray-500">{formatBytes(resource.file_size)}</span></td>}
      {visibleColumns.has('addedBy') && (
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <UserAvatar user={resource.posted_by} />
            <span className="text-[11.5px] text-gray-600">{displayName}</span>
          </div>
        </td>
      )}
      {visibleColumns.has('addedOn') && <td className="py-3 px-4"><span className="text-[11.5px] text-gray-500">{formatDate(resource.created_at)}</span></td>}
      <td className="py-3 px-4">
        <ResourceRowActions resource={resource} canEdit={canEdit} workspaceId={workspaceId} onRefetch={onRefetch} />
      </td>
    </tr>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function ResourceGridCard({ resource, canEdit, workspaceId, onRefetch }: {
  resource: WorkspaceResource; canEdit: boolean; workspaceId: number; onRefetch: () => void;
}) {
  const ext = getExtension(resource.file_url ?? resource.file);
  const typeLabel = resource.resource_type === 'file'
    ? (EXT_CONFIG[ext]?.label ?? 'File') : resource.resource_type === 'link' ? 'Link' : 'Note';

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow ${resource.is_hidden ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <FileTypeIcon resource={resource} size="lg" />
        <ResourceRowActions resource={resource} canEdit={canEdit} workspaceId={workspaceId} onRefetch={onRefetch} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <p className="text-[13px] font-semibold text-gray-900 truncate">{resource.title}</p>
          {resource.is_featured && <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded-full shrink-0">Featured</span>}
          {isNew(resource.created_at) && <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full shrink-0">New</span>}
        </div>
        {resource.description && <p className="text-[11.5px] text-gray-400 line-clamp-2">{resource.description}</p>}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-[11px] font-medium text-gray-400">{typeLabel} · {formatBytes(resource.file_size)}</span>
        <span className="text-[11px] text-gray-400">{formatDate(resource.created_at)}</span>
      </div>
    </div>
  );
}

// ── Storage modal ─────────────────────────────────────────────────────────────

function StorageModal({ resources, onClose }: { resources: WorkspaceResource[]; onClose: () => void }) {
  const files = useMemo(() =>
    [...resources]
      .filter(r => r.resource_type === 'file')
      .sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0)),
    [resources]
  );
  const totalBytes = files.reduce((s, r) => s + (r.file_size ?? 0), 0);
  const LIMIT = 10 * 1024 * 1024 * 1024;
  const pct = Math.min(100, (totalBytes / LIMIT) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Database size={16} className="text-gray-500" />
            <p className="text-[15px] font-bold text-gray-900">Storage usage</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
        </div>

        {/* Usage bar */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-gray-600">{formatBytes(totalBytes)} of 10 GB used</span>
            <span className="text-[13px] font-bold text-gray-700">{pct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : '#cf6535' }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">{formatBytes(LIMIT - totalBytes)} remaining</p>
        </div>

        {/* File list */}
        <div className="px-6 py-3 max-h-72 overflow-y-auto">
          {files.length === 0 ? (
            <p className="text-[13px] text-gray-400 text-center py-6">No files uploaded yet.</p>
          ) : (
            <div className="space-y-1">
              {files.map(r => {
                const filePct = totalBytes > 0 ? ((r.file_size ?? 0) / totalBytes) * 100 : 0;
                return (
                  <div key={r.id} className="flex items-center gap-3 py-2">
                    <FileTypeIcon resource={r} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-gray-800 truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-400 rounded-full" style={{ width: `${filePct}%` }} />
                        </div>
                        <span className="text-[10.5px] text-gray-400 shrink-0">{filePct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-gray-600 shrink-0 tabular-nums">{formatBytes(r.file_size)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-gray-600">Total: {formatBytes(totalBytes)}</span>
          <button onClick={onClose}
            className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
type SortKey = 'latest' | 'oldest' | 'az' | 'za';
const ALL_COLUMNS = ['size', 'addedBy', 'addedOn'] as const;
const COLUMN_LABELS: Record<string, string> = { size: 'Size', addedBy: 'Added By', addedOn: 'Added On' };

export default function WorkspaceResourcesPage() {
  const { workspace, isOwner, isMentor } = useWorkspace();
  const { user } = useAuth();
  const canWrite = isOwner || isMentor;
  const workspaceId = workspace?.id ?? 0;

  const { data: resources, refetch } = useApiList<WorkspaceResource>(
    () => workspacesApi.getResources(workspaceId),
    [workspaceId],
  );

  // ── view state ──
  const [viewMode, setViewMode]         = useState<'list' | 'grid'>('list');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['size', 'addedBy', 'addedOn']));
  const toggleColumn = (col: string) => setVisibleColumns(prev => {
    const next = new Set(prev);
    next.has(col) ? next.delete(col) : next.add(col);
    return next;
  });

  // ── basic filters ──
  const [search, setSearch]   = useState('');
  const [typeFilter, setType] = useState('all');
  const [catFilter, setCat]   = useState('all');
  const [sort, setSort]       = useState<SortKey>('latest');
  const [page, setPage]       = useState(1);

  // ── advanced filters ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [uploaderFilter, setUploader]   = useState('');

  const hasAdvancedFilters = !!(dateFrom || dateTo || uploaderFilter);

  const clearAdvanced = () => { setDateFrom(''); setDateTo(''); setUploader(''); };

  // ── misc state ──
  const [tipsDismissed, setTipsDismissed] = useState(false);
  const [showAdd, setShowAdd]             = useState(false);
  const [addType, setAddType]             = useState<'file' | 'link' | 'note'>('link');
  const [showStorage, setShowStorage]     = useState(false);

  // ── drag-drop ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true); setUploadErr('');
    try {
      await apiClient.initCsrf();
      const fd = new FormData();
      fd.append('resource_type', 'file');
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      fd.append('description', '');
      fd.append('category', 'documents');
      fd.append('is_template', 'false');
      fd.append('file', file);
      await workspacesApi.addResource(workspaceId, fd);
      refetch();
    } catch {
      setUploadErr('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [workspaceId, refetch]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  // ── derived data ──
  const uniqueUploaders = useMemo(() => {
    const seen = new Set<string>();
    return resources.filter(r => { if (seen.has(r.posted_by.username)) return false; seen.add(r.posted_by.username); return true; }).map(r => r.posted_by);
  }, [resources]);

  const filtered = useMemo(() => {
    let r = [...resources];
    if (search) { const q = search.toLowerCase(); r = r.filter(x => x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q)); }
    if (typeFilter !== 'all') r = r.filter(x => x.resource_type === typeFilter);
    if (catFilter !== 'all') r = r.filter(x => x.category === catFilter);
    if (dateFrom) r = r.filter(x => new Date(x.created_at) >= new Date(dateFrom));
    if (dateTo) r = r.filter(x => new Date(x.created_at) <= new Date(dateTo + 'T23:59:59'));
    if (uploaderFilter) r = r.filter(x => x.posted_by.username === uploaderFilter);
    if (sort === 'oldest') r = r.reverse();
    else if (sort === 'az') r = r.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'za') r = r.sort((a, b) => b.title.localeCompare(a.title));
    return r;
  }, [resources, search, typeFilter, catFilter, dateFrom, dateTo, uploaderFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── sidebar stats ──
  const totalFiles = resources.filter(r => r.resource_type === 'file').length;
  const totalLinks = resources.filter(r => r.resource_type === 'link').length;
  const totalNotes = resources.filter(r => r.resource_type === 'note').length;
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { documents: 0, presentations: 0, guides: 0, links: 0, other: 0 };
    resources.forEach(r => { if (m[r.category] !== undefined) m[r.category]++; else m['other']++; });
    return m;
  }, [resources]);
  const totalBytes     = useMemo(() => resources.reduce((s, r) => s + (r.file_size ?? 0), 0), [resources]);
  const recentUploads  = useMemo(() => [...resources].slice(0, 3), [resources]);
  const STORAGE_LIMIT  = 10 * 1024 * 1024 * 1024;
  const storagePercent = Math.min(100, (totalBytes / STORAGE_LIMIT) * 100);

  const openAdd = (type: 'file' | 'link' | 'note') => { setAddType(type); setShowAdd(true); };

  if (!workspace) return null;

  const selectCls = 'flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer appearance-none';

  return (
    <div className="flex gap-6">
      {/* ── Main ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-gray-900">Resources</h1>
              <p className="text-[12px] text-gray-400 mt-0.5">Store, organize and share important files, links and notes with your workspace.</p>
            </div>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2 shrink-0">
              {/* View options dropdown */}
              <Dropdown
                align="right"
                closeOnClick={false}
                trigger={
                  <button className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/>
                      <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/>
                      <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/>
                      <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/>
                    </svg>
                    View options
                    <ChevronDown size={12} />
                  </button>
                }
              >
                {/* View toggle */}
                <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">View</p>
                  <div className="flex gap-1">
                    {([['list', <List size={13} />, 'List'], ['grid', <LayoutGrid size={13} />, 'Grid']] as const).map(([mode, icon, label]) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                          viewMode === mode
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {icon}{label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Column toggles (list only) */}
                {viewMode === 'list' && (
                  <div className="px-3 pt-2.5 pb-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Columns</p>
                    {ALL_COLUMNS.map(col => (
                      <label key={col} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col)}
                          onChange={() => toggleColumn(col)}
                          className="w-3.5 h-3.5 accent-primary-600 cursor-pointer"
                        />
                        <span className="text-[12.5px] text-gray-700 group-hover:text-gray-900">{COLUMN_LABELS[col]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </Dropdown>

              {/* Add resource split button */}
              <div className="flex h-9">
                <button
                  onClick={() => openAdd('file')}
                  className="px-3.5 h-full text-[12.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-l-lg transition-colors border-r border-primary-700"
                >
                  Add resource
                </button>
                <Dropdown
                  align="right"
                  trigger={
                    <button className="px-2.5 h-full flex items-center text-white bg-primary-600 hover:bg-primary-700 rounded-r-lg transition-colors">
                      <ChevronDown size={14} />
                    </button>
                  }
                >
                  <DropItem onClick={() => openAdd('file')} icon={<Upload size={13} />} label="Upload file" />
                  <DropItem onClick={() => openAdd('link')} icon={<LinkIcon size={13} />} label="Add link" />
                  <DropItem onClick={() => openAdd('note')} icon={<FileText size={13} />} label="Add note" />
                </Dropdown>
              </div>
            </div>
          )}
        </div>

        {/* Drop zone */}
        {canWrite && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <CloudUpload size={20} className="text-primary-500" />
            </div>
            <p className="text-[13px] font-medium text-gray-700">
              {uploading ? 'Uploading…' : <>Drag and drop files here, or <span className="text-primary-600">click to browse</span></>}
            </p>
            <p className="text-[11.5px] text-gray-400 mt-1">Supports: PDF, DOCX, XLSX, PPTX, ZIP, PNG, JPG (Max. 50MB)</p>
            {uploadErr && <p className="text-[12px] text-red-500 mt-2">{uploadErr}</p>}
            <input ref={fileInputRef} type="file" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
          </div>
        )}

        {/* Filter toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search resources…"
              className="w-full pl-8 pr-3 py-2 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
          </div>
          <div className="relative">
            <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(1); }} className={selectCls}>
              <option value="all">All types</option>
              <option value="file">Files</option>
              <option value="link">Links</option>
              <option value="note">Notes</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={catFilter} onChange={e => { setCat(e.target.value); setPage(1); }} className={selectCls}>
              <option value="all">All categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={sort} onChange={e => { setSort(e.target.value as SortKey); setPage(1); }} className={selectCls}>
              <option value="latest">Sort by: Latest</option>
              <option value="oldest">Sort by: Oldest</option>
              <option value="az">Sort by: A → Z</option>
              <option value="za">Sort by: Z → A</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`p-2 border rounded-lg transition-colors ${
              showAdvanced || hasAdvancedFilters
                ? 'text-primary-600 bg-primary-50 border-primary-200 hover:bg-primary-100'
                : 'text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
            }`}
            title="Advanced filters"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Advanced filter panel */}
        {showAdvanced && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12.5px] font-bold text-gray-700">Advanced filters</p>
              {hasAdvancedFilters && (
                <button onClick={clearAdvanced} className="text-[11.5px] font-semibold text-red-500 hover:text-red-600 transition-colors">
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Date range */}
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-medium text-gray-600 shrink-0">Added between</label>
                <input
                  type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                />
                <span className="text-[12px] text-gray-400">and</span>
                <input
                  type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                />
              </div>
              {/* Uploader */}
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-medium text-gray-600 shrink-0">Uploaded by</label>
                <div className="relative">
                  <select
                    value={uploaderFilter}
                    onChange={e => { setUploader(e.target.value); setPage(1); }}
                    className="pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Anyone</option>
                    {uniqueUploaders.map(u => {
                      const name = (u.first_name || u.last_name)
                        ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                        : u.username;
                      return <option key={u.username} value={u.username}>{name}</option>;
                    })}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            {hasAdvancedFilters && (
              <p className="text-[11.5px] text-primary-600 font-medium">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} match the active filters
              </p>
            )}
          </div>
        )}

        {/* Table / Grid */}
        {viewMode === 'list' ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {resources.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen size={20} className="text-gray-300" />
                </div>
                <p className="text-[13px] font-medium text-gray-400">
                  {canWrite ? 'No resources yet. Upload files or add links.' : 'No resources available yet.'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Resource</th>
                    <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Type</th>
                    {visibleColumns.has('size') && <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Size</th>}
                    {visibleColumns.has('addedBy') && <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Added by</th>}
                    {visibleColumns.has('addedOn') && <th className="text-left py-2.5 px-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Added on ↓</th>}
                    <th className="py-2.5 px-4 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={3 + visibleColumns.size + 1} className="py-10 text-center text-[13px] text-gray-400">No resources match your filters.</td></tr>
                  ) : (
                    paginated.map(r => (
                      <ResourceRow key={r.id} resource={r} canEdit={isOwner || (isMentor && r.posted_by.id === user?.id)} workspaceId={workspaceId} onRefetch={refetch} visibleColumns={visibleColumns} />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div>
            {paginated.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
                <BookOpen size={20} className="text-gray-300 mx-auto mb-3" />
                <p className="text-[13px] font-medium text-gray-400">
                  {resources.length === 0 ? (canWrite ? 'No resources yet. Upload files or add links.' : 'No resources available yet.') : 'No resources match your filters.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {paginated.map(r => (
                  <ResourceGridCard key={r.id} resource={r} canEdit={isOwner || (isMentor && r.posted_by.id === user?.id)} workspaceId={workspaceId} onRefetch={refetch} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] text-gray-400">
              Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} resources
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-7 h-7 text-[12px] font-medium rounded-lg border transition-colors ${n === safePage ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Tips bar — mentor only */}
        {canWrite && !tipsDismissed && (
          <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 border border-primary-100 rounded-xl">
            <Lightbulb size={15} className="text-primary-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[12.5px] font-semibold text-primary-800">Tips for organizing resources </span>
              <span className="text-[12.5px] text-primary-700">Use clear names, add categories, and feature important resources for quick access by your team.</span>
            </div>
            <button onClick={() => setTipsDismissed(true)} className="text-primary-400 hover:text-primary-600 shrink-0"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-72 shrink-0 space-y-4">

        {/* Resources overview — mentor only */}
        {canWrite && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-green-600" />
            <p className="text-[12.5px] font-bold text-gray-800">Resources overview</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Total resources', value: resources.length, iconBg: 'bg-primary-50',   icon: <FileIcon size={16} className="text-primary-500" /> },
              { label: 'Files',           value: totalFiles,       iconBg: 'bg-primary-50',   icon: <FileIcon size={16} className="text-primary-400" /> },
              { label: 'Links',           value: totalLinks,       iconBg: 'bg-teal-50',   icon: <LinkIcon size={16} className="text-teal-500" /> },
              { label: 'Notes',           value: totalNotes,       iconBg: 'bg-purple-50', icon: <FileText size={16} className="text-purple-500" /> },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-50 rounded-lg p-2.5 flex items-center gap-2">
                <div className={`w-7 h-7 ${stat.iconBg} rounded-lg flex items-center justify-center shrink-0`}>{stat.icon}</div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">{stat.value}</p>
                  <p className="text-[10.5px] text-gray-400 leading-none">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Categories */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12.5px] font-bold text-gray-800">Categories</p>
            {canWrite && (
              <button onClick={() => setCat('all')} className="text-[11.5px] font-semibold text-primary-600 hover:text-primary-700">
                Manage
              </button>
            )}
          </div>
          <div className="space-y-1">
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.value] ?? 0;
              const icons: Record<string, React.ReactNode> = {
                documents:     <FileIcon size={14} className="text-primary-500" />,
                presentations: <FileIcon size={14} className="text-orange-500" />,
                guides:        <FileIcon size={14} className="text-green-500" />,
                links:         <LinkIcon size={14} className="text-teal-500" />,
                other:         <FileIcon size={14} className="text-gray-400" />,
              };
              return (
                <button key={cat.value} onClick={() => { setCat(cat.value); setPage(1); }}
                  className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg transition-colors ${catFilter === cat.value ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-2">{icons[cat.value]}<span className="text-[12px] font-medium text-gray-700">{cat.label}</span></div>
                  <span className="text-[12px] font-semibold text-gray-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Storage usage — owner only */}
        {isOwner && <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-gray-500" />
            <p className="text-[12.5px] font-bold text-gray-800">Storage usage</p>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[12px] text-gray-600">{formatBytes(totalBytes)} of 10 GB used</p>
            <p className="text-[12px] font-semibold text-gray-500">{storagePercent.toFixed(0)}%</p>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${storagePercent}%` }} />
          </div>
          <button
            onClick={() => setShowStorage(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Database size={12} />
            Manage storage
          </button>
        </div>}

        {/* Recent uploads */}
        {recentUploads.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12.5px] font-bold text-gray-800">Recent uploads</p>
              <button className="text-[11.5px] font-semibold text-primary-600 hover:text-primary-700" onClick={() => setCat('all')}>
                View all
              </button>
            </div>
            <div className="space-y-2.5">
              {recentUploads.map(r => (
                <div key={r.id} className="flex items-center gap-2.5">
                  <FileTypeIcon resource={r} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{r.title}</p>
                    <p className="text-[10.5px] text-gray-400">
                      {r.resource_type === 'file' ? formatBytes(r.file_size) : r.resource_type === 'link' ? 'Link' : 'Note'}
                      {' · '}{formatDate(r.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add resource modal */}
      {showAdd && (
        <AddResourceModal workspaceId={workspaceId} onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); refetch(); void addType; }} />
      )}

      {/* Storage modal */}
      {showStorage && <StorageModal resources={resources} onClose={() => setShowStorage(false)} />}
    </div>
  );
}
