import { useState, useEffect } from 'react';
import { Shield, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useOrg } from '../context/OrgContext';
import { orgApi, type InternalRole } from '../api/orgApi';

const PERM_LABELS: { key: keyof InternalRole; label: string }[] = [
  { key: 'can_manage_members',         label: 'Manage members' },
  { key: 'can_view_all_contributions', label: 'View all contributions' },
  { key: 'can_approve_checkins',       label: 'Approve check-ins' },
  { key: 'can_upload_agreements',      label: 'Upload agreements' },
];

// ── Role Form (create / edit) ─────────────────────────────────────────────────

interface RoleFormState {
  name: string;
  level: number;
  can_manage_members: boolean;
  can_view_all_contributions: boolean;
  can_approve_checkins: boolean;
  can_upload_agreements: boolean;
}

const EMPTY_FORM: RoleFormState = {
  name: '', level: 1,
  can_manage_members: false,
  can_view_all_contributions: false,
  can_approve_checkins: false,
  can_upload_agreements: false,
};

function RoleModal({ initial, onClose, onSaved }: {
  initial?: InternalRole;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]         = useState<RoleFormState>(initial ? {
    name: initial.name,
    level: initial.level,
    can_manage_members: initial.can_manage_members,
    can_view_all_contributions: initial.can_view_all_contributions,
    can_approve_checkins: initial.can_approve_checkins,
    can_upload_agreements: initial.can_upload_agreements,
  } : EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const toggle = (key: keyof RoleFormState) =>
    setForm(p => ({ ...p, [key]: !p[key as keyof RoleFormState] }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (initial) {
        await orgApi.updateRole(initial.id, form);
      } else {
        await orgApi.createRole(form);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const d = (err as { data?: Record<string, string[]> })?.data;
      setError(d?.name?.[0] ?? 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[440px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-gray-900">{initial ? 'Edit Role' : 'New Role'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Role name</label>
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Intern, Volunteer, Coordinator"
            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            autoFocus
          />
        </div>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
            Level <span className="font-normal text-gray-400">— higher level = more sidebar access</span>
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={form.level}
            onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) }))}
            className="w-24 px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
        </div>

        <div className="mb-5">
          <label className="block text-[12px] font-semibold text-gray-600 mb-2">Permissions</label>
          <div className="flex flex-col gap-2">
            {PERM_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => toggle(key)}
                  className={[
                    'w-4 h-4 rounded flex items-center justify-center border transition-colors cursor-pointer',
                    form[key as keyof RoleFormState]
                      ? 'bg-teal-600 border-teal-600'
                      : 'border-gray-300 group-hover:border-teal-400',
                  ].join(' ')}
                >
                  {form[key as keyof RoleFormState] && <Check size={10} className="text-white" />}
                </div>
                <span className="text-[13px] text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-[12.5px] text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-[13px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgRoles() {
  const { isSuperadmin } = useOrg();
  const [roles, setRoles]         = useState<InternalRole[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]     = useState<InternalRole | null>(null);
  const [deleting, setDeleting]   = useState<InternalRole | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRoles(await orgApi.getRoles()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await orgApi.deleteRole(deleting.id);
      setDeleting(null);
      load();
    } catch { /* ignore */ }
  };

  if (!isSuperadmin) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Roles</h1>
          <p className="text-gray-500 text-sm">Define the internal role hierarchy</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
        >
          <Plus size={14} /> New Role
        </button>
      </div>

      {loading ? (
        <div className="text-[13px] text-gray-400 py-8 text-center">Loading roles...</div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <Shield size={22} className="text-gray-300" />
          </div>
          <p className="text-[14px] font-semibold text-gray-600">No roles yet</p>
          <p className="text-[12.5px] text-gray-400 mt-1">Create a role before granting access to members</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {roles.map(role => (
            <div key={role.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                <Shield size={18} className="text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[14px] font-semibold text-gray-800">{role.name}</p>
                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md font-medium">
                    Level {role.level}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">
                    {role.member_count} member{role.member_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {PERM_LABELS.filter(p => role[p.key as keyof InternalRole]).map(p => (
                    <span key={p.key} className="text-[11px] px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full font-medium">
                      {p.label}
                    </span>
                  ))}
                  {!PERM_LABELS.some(p => role[p.key as keyof InternalRole]) && (
                    <span className="text-[11.5px] text-gray-400 italic">Base access only</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(role)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleting(role)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <RoleModal onClose={() => setShowCreate(false)} onSaved={load} />}
      {editing    && <RoleModal initial={editing} onClose={() => setEditing(null)} onSaved={load} />}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[360px] p-6">
            <p className="text-[15px] font-bold text-gray-900 mb-1">Delete role?</p>
            <p className="text-[13px] text-gray-500 mb-5">
              Delete <strong>{deleting.name}</strong>? This cannot be undone. Roles with active members cannot be deleted.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
