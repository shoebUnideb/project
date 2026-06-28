import { useState, useEffect, useRef } from 'react';
import {
  HelpCircle, ExternalLink, Eye, Upload, Pencil, Trash2, Plus,
} from 'lucide-react';
import {
  resourcesApi,
  type OrgResource, type ResourceCategory,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<ResourceCategory | 'all', string> = {
  all:              'All',
  handbook:         'Handbook',
  guide:            'Guide',
  faq:              'FAQ',
  policy:           'Policy',
  training_material:'Training Material',
};
const CAT_BADGE: Record<ResourceCategory, string> = {
  handbook:          'bg-blue-50 text-blue-700',
  guide:             'bg-teal-50 text-teal-700',
  faq:               'bg-amber-50 text-amber-700',
  policy:            'bg-purple-50 text-purple-700',
  training_material: 'bg-emerald-50 text-emerald-700',
};
const TABS: (ResourceCategory | 'all')[] = ['all', 'handbook', 'guide', 'faq', 'policy', 'training_material'];

// ── Resource Card ─────────────────────────────────────────────────────────────

function ResourceCard({
  resource,
  isAdmin,
  onEdit,
  onDeleted,
}: {
  resource: OrgResource;
  isAdmin: boolean;
  onEdit: (r: OrgResource) => void;
  onDeleted: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await resourcesApi.deleteResource(resource.id);
      onDeleted(resource.id);
    } catch { /* ignore */ }
    finally { setDeleting(false); setConfirming(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${CAT_BADGE[resource.category]}`}>
              {CAT_LABEL[resource.category]}
            </span>
            {isAdmin && !resource.is_published && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">Draft</span>
            )}
          </div>
          <p className="text-[13.5px] font-bold text-gray-900 leading-snug">{resource.title}</p>
          {resource.description && (
            <p className="text-[12px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{resource.description}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(resource)}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        {resource.file_url && (
          <a
            href={resource.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
          >
            <Eye size={12} /> View File
          </a>
        )}
        {resource.external_url && (
          <a
            href={resource.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
          >
            <ExternalLink size={12} /> Open Link
          </a>
        )}
        <p className="text-[11px] text-gray-300 ml-auto">
          {new Date(resource.created_at).toLocaleDateString()}
        </p>
      </div>

      {confirming && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl space-y-2">
          <p className="text-[12.5px] text-red-700 font-medium">Delete "{resource.title}"? This cannot be undone.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={doDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-lg"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setConfirming(false)} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-white rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resource Form ─────────────────────────────────────────────────────────────

function ResourceForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: OrgResource;
  onSaved: (r: OrgResource) => void;
  onCancel: () => void;
}) {
  const [title, setTitle]           = useState(initial?.title ?? '');
  const [desc, setDesc]             = useState(initial?.description ?? '');
  const [category, setCategory]     = useState<ResourceCategory>(initial?.category ?? 'guide');
  const [url, setUrl]               = useState(initial?.external_url ?? '');
  const [published, setPublished]   = useState(initial?.is_published ?? true);
  const [file, setFile]             = useState<File | null>(null);
  const [confirm, setConfirm]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSubmitting(true);
    setConfirm(false);
    setError('');
    try {
      let saved: OrgResource;
      if (initial) {
        saved = await resourcesApi.updateResource(initial.id, {
          title: title.trim(), description: desc.trim(), category, external_url: url.trim(), is_published: published,
        });
      } else {
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('description', desc.trim());
        fd.append('category', category);
        fd.append('external_url', url.trim());
        fd.append('is_published', String(published));
        if (file) fd.append('file', file);
        saved = await resourcesApi.createResource(fd);
      }
      onSaved(saved);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3.5">
      <p className="text-[14px] font-bold text-gray-900">{initial ? 'Edit Resource' : 'Add Resource'}</p>

      {error && (
        <p className="text-[12.5px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      <div>
        <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Title *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
          placeholder="Resource title"
        />
      </div>

      <div>
        <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as ResourceCategory)}
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {(['handbook', 'guide', 'faq', 'policy', 'training_material'] as ResourceCategory[]).map(c => (
            <option key={c} value={c}>{CAT_LABEL[c]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Description</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          placeholder="Brief description (optional)"
        />
      </div>

      <div>
        <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">External URL</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
          placeholder="https://..."
        />
      </div>

      {!initial && (
        <div>
          <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">File (optional)</label>
          <div className="flex items-center gap-2">
            <input type="file" ref={fileRef} className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl"
            >
              <Upload size={12} /> {file ? file.name : 'Upload file'}
            </button>
            {file && <button onClick={() => setFile(null)} className="text-[11.5px] text-gray-400 hover:text-gray-600">Remove</button>}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={published}
          onChange={e => setPublished(e.target.checked)}
          className="rounded"
        />
        Publish (visible to all members)
      </label>

      {!confirm ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => { setError(''); setConfirm(true); }}
            disabled={submitting}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 rounded-xl transition-colors"
          >
            {initial ? 'Save Changes' : 'Add Resource'}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">
            Cancel
          </button>
        </div>
      ) : (
        <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
          <p className="text-[12.5px] text-amber-800 font-medium">
            {initial ? 'Save changes to this resource?' : 'Add this resource?'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={doSave}
              disabled={submitting}
              className="px-3 py-1.5 text-[12px] font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 rounded-lg"
            >
              {submitting ? 'Saving…' : 'Confirm'}
            </button>
            <button onClick={() => setConfirm(false)} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Form Panel ────────────────────────────────────────────────────────────

function AddPanel({ onAdded }: { onAdded: (r: OrgResource) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-xl transition-colors"
      >
        <Plus size={15} /> Add Resource
      </button>
    );
  }

  return (
    <ResourceForm
      onSaved={r => { onAdded(r); setOpen(false); }}
      onCancel={() => setOpen(false)}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgHelp() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [resources, setResources] = useState<OrgResource[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<ResourceCategory | 'all'>('all');
  const [editing, setEditing]     = useState<OrgResource | null>(null);

  useEffect(() => {
    resourcesApi.getResources()
      .then(setResources)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = tab === 'all' ? resources : resources.filter(r => r.category === tab);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl w-48 animate-pulse" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Help & Support</h1>
          <p className="text-gray-500 text-sm">Handbooks, guides, FAQs and policy documents</p>
        </div>
        {isAdmin && !editing && <AddPanel onAdded={r => setResources(prev => [r, ...prev])} />}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mb-6">
          <ResourceForm
            initial={editing}
            onSaved={updated => {
              setResources(rs => rs.map(r => r.id === updated.id ? updated : r));
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Category tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setEditing(null); }}
            className={`px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {CAT_LABEL[t]}
            {t !== 'all' && (
              <span className="ml-1 text-[11px] text-gray-400">
                ({resources.filter(r => r.category === t).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
            <HelpCircle size={28} className="text-teal-400" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">
            {tab === 'all' ? 'No resources yet' : `No ${CAT_LABEL[tab].toLowerCase()} resources yet`}
          </p>
          {isAdmin && (
            <p className="text-[13px] text-gray-400 mt-1">Add a resource using the button above.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <ResourceCard
              key={r.id}
              resource={r}
              isAdmin={isAdmin}
              onEdit={setEditing}
              onDeleted={id => setResources(rs => rs.filter(x => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
