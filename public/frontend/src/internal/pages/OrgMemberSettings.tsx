import { useState, useEffect } from 'react';
import { User, Eye, EyeOff, Key, Check } from 'lucide-react';
import { orgApi, type OrgMember } from '../api/orgApi';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 disabled:bg-gray-50';

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[13px] font-bold text-gray-900">{title}</p>
        {description && <p className="text-[11.5px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusMsg({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={`text-[12px] px-3 py-1.5 rounded-lg border ${
      ok ? 'text-gray-800 bg-gray-50 border-gray-200' : 'text-red-600 bg-red-50 border-red-100'
    }`}>
      {ok && <Check size={11} className="inline mr-1.5" />}{text}
    </p>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-xl space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
          <div className="h-3.5 bg-gray-100 rounded w-28 animate-pulse" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Section: Account Info ─────────────────────────────────────────────────────

function AccountSection({ member }: { member: OrgMember }) {
  const u = member.user;
  const displayName = u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;

  const rows = [
    { label: 'Full Name',   value: displayName },
    { label: 'Username',    value: `@${u.username}` },
    { label: 'Email',       value: u.email },
    { label: 'Role',        value: member.role?.name ?? '—' },
    { label: 'Department',  value: member.department_name ?? '—' },
    { label: 'Employee ID', value: member.employee_id || '—' },
    { label: 'Status',      value: member.status.charAt(0).toUpperCase() + member.status.slice(1) },
    { label: 'Joined',      value: new Date(member.joined_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  return (
    <SectionCard title="Account Information" description="Your profile details in this organisation.">
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100">
          {u.profile_picture ? (
            <img src={u.profile_picture} alt={displayName} className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center text-[14px] font-bold shrink-0">
              {displayName[0]?.toUpperCase() ?? <User size={16} />}
            </div>
          )}
          <div>
            <p className="text-[13px] font-bold text-gray-900">{displayName}</p>
            <p className="text-[11.5px] text-gray-400">{u.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-2">
          {rows.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-[12.5px] text-gray-700 font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 pt-0.5">
          To update profile details, contact your administrator.
        </p>
      </div>
    </SectionCard>
  );
}

// ── Section: Messaging Privacy ────────────────────────────────────────────────

function MessagingSection({ currentPerm }: { currentPerm: string }) {
  const [perm,   setPerm]   = useState<'open' | 'request_required'>(
    currentPerm === 'request_required' ? 'request_required' : 'open',
  );
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      await authApi.updateSettings({ message_permission: perm });
      setMsg({ ok: true, text: 'Messaging preference saved.' });
    } catch {
      setMsg({ ok: false, text: 'Failed to save. Please try again.' });
    } finally { setSaving(false); }
  };

  const Option = ({ value, label, desc }: { value: 'open' | 'request_required'; label: string; desc: string }) => (
    <button type="button"
      onClick={() => { setPerm(value); setMsg(null); }}
      disabled={saving}
      className={`flex items-start gap-2.5 w-full p-3 rounded-lg border text-left transition-all ${
        perm === value ? 'border-gray-800 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
        perm === value ? 'border-gray-800' : 'border-gray-300'
      }`}>
        {perm === value && <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />}
      </div>
      <div>
        <p className="text-[12.5px] font-semibold text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
      </div>
    </button>
  );

  return (
    <SectionCard title="Messaging Privacy" description="Control who can send you direct messages.">
      <div className="space-y-2.5">
        <Option value="open"
          label="Open — anyone can message me"
          desc="Other members can send you direct messages without restriction." />
        <Option value="request_required"
          label="Request required — approve before messaging"
          desc="Others must send a contact request first. You approve before messages are exchanged." />
        {msg && <StatusMsg ok={msg.ok} text={msg.text} />}
        <div className="flex justify-end pt-0.5">
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save Preference'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Section: Change Password ──────────────────────────────────────────────────

function PasswordSection() {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async () => {
    setMsg(null);
    if (!current || !next) { setMsg({ ok: false, text: 'All fields are required.' }); return; }
    if (next !== confirm)   { setMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    if (next.length < 8)    { setMsg({ ok: false, text: 'New password must be at least 8 characters.' }); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      setMsg({ ok: true, text: 'Password changed successfully.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: unknown) {
      const detail = (e as { data?: { detail?: string } })?.data?.detail;
      setMsg({ ok: false, text: detail ?? 'Failed to change password. Check your current password.' });
    } finally { setSaving(false); }
  };

  const EyeBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
      {show ? <EyeOff size={12} /> : <Eye size={12} />}
    </button>
  );

  return (
    <SectionCard title="Change Password" description="Update your account password. Your session will remain active.">
      <div className="space-y-3">
        <FormField label="Current Password">
          <div className="relative">
            <input type={showCur ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
              disabled={saving} className={`${inputCls} pr-8`} placeholder="Enter current password" />
            <EyeBtn show={showCur} toggle={() => setShowCur(p => !p)} />
          </div>
        </FormField>
        <FormField label="New Password">
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)}
              disabled={saving} className={`${inputCls} pr-8`} placeholder="Minimum 8 characters" />
            <EyeBtn show={showNew} toggle={() => setShowNew(p => !p)} />
          </div>
        </FormField>
        <FormField label="Confirm New Password">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            disabled={saving} className={inputCls} placeholder="Repeat new password" />
        </FormField>
        {msg && <StatusMsg ok={msg.ok} text={msg.text} />}
        <div className="flex justify-end pt-0.5">
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrgMemberSettings() {
  const { user } = useAuth();
  const [member,  setMember]  = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orgApi.getMe()
      .then(setMember)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  return (
    <div className="max-w-xl space-y-4">
      <div className="mb-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Key size={15} className="text-gray-600" />
          <h1 className="text-[16px] font-bold text-gray-900">My Settings</h1>
        </div>
        <p className="text-[12px] text-gray-400">Manage your account preferences and security.</p>
      </div>

      {member && <AccountSection member={member} />}

      <MessagingSection currentPerm={user?.message_permission ?? 'open'} />

      <PasswordSection />
    </div>
  );
}
