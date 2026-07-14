import { useState, useEffect, useRef } from 'react';
import { User, Briefcase, Phone, FileText, Plus, X, Check, Users, Camera, Trash2 } from 'lucide-react';
import { orgApi, type OrgMemberProfile } from '../api/orgApi';
import { useAuth } from '../../context/AuthContext';

// ── Shared helpers ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 disabled:bg-gray-50';

function SectionCard({
  title, description, icon, children, className = '',
}: {
  title: string; description?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        {icon && <span className="text-gray-400">{icon}</span>}
        <div>
          <p className="text-[13px] font-bold text-gray-900">{title}</p>
          {description && <p className="text-[11.5px] text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-4 py-3 flex-1 flex flex-col">{children}</div>
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[12.5px] text-gray-700 font-medium">{value || '—'}</p>
    </div>
  );
}

// ── Skills tag input ──────────────────────────────────────────────────────────

function SkillsInput({
  value, onChange, disabled,
}: {
  value: string[]; onChange: (s: string[]) => void; disabled: boolean;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v) && value.length < 20) {
      onChange([...value, v]);
    }
    setInput('');
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div
      className="min-h-[38px] flex flex-wrap gap-1.5 px-2.5 py-2 border border-gray-200 rounded-lg bg-white cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((s, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-md text-[11.5px] text-gray-700 font-medium"
        >
          {s}
          {!disabled && (
            <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-gray-600">
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !input && value.length > 0) remove(value.length - 1);
          }}
          placeholder={value.length === 0 ? 'Type a skill and press Enter…' : ''}
          className="flex-1 min-w-[120px] text-[12.5px] outline-none bg-transparent placeholder-gray-300"
        />
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 bg-gray-100 rounded w-28 animate-pulse" />
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gray-100 animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-100 rounded w-40 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-56 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="h-3.5 bg-gray-100 rounded w-28 animate-pulse" />
            <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrgProfilePage() {
  const { patchUser } = useAuth();
  const [profile,  setProfile]  = useState<OrgMemberProfile | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [skills,     setSkills]     = useState<string[]>([]);
  const [ecName,     setEcName]     = useState('');
  const [ecPhone,    setEcPhone]    = useState('');
  const [notes,      setNotes]      = useState('');

  const [saving,       setSaving]       = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);
  const [msg,          setMsg]          = useState<{ ok: boolean; text: string } | null>(null);
  const [picUploading, setPicUploading] = useState(false);
  const [picMsg,       setPicMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    orgApi.getMe()
      .then(me => {
        if (!me) {
          setFetchErr('no_member');
          setLoading(false);
          return null;
        }
        setMemberId(me.id);
        return orgApi.getMemberProfile(me.id);
      })
      .then(p => {
        if (!p) return;
        setProfile(p);
        setEmployeeId(p.employee_id || '');
        setSkills(p.skills || []);
        setEcName(p.emergency_contact_name || '');
        setEcPhone(p.emergency_contact_phone || '');
        setNotes(p.notes || '');
      })
      .catch(() => setFetchErr('Failed to load profile. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!memberId) return;
    setSaving(true); setMsg(null);
    try {
      const updated = await orgApi.updateMemberProfile(memberId, {
        skills,
        emergency_contact_name:  ecName,
        emergency_contact_phone: ecPhone,
        notes,
      });
      setProfile(updated);
      setMsg({ ok: true, text: 'Profile updated successfully.' });
    } catch {
      setMsg({ ok: false, text: 'Failed to save. Please try again.' });
    } finally { setSaving(false); }
  };

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !memberId) return;
    e.target.value = '';
    setPicUploading(true); setPicMsg(null);
    try {
      const res = await orgApi.uploadMemberPicture(memberId, file);
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, profile_picture: res.profile_picture } } : prev);
      patchUser({ profile_picture: res.profile_picture });
      setPicMsg({ ok: true, text: 'Photo updated.' });
    } catch {
      setPicMsg({ ok: false, text: 'Upload failed. Max 5 MB, images only.' });
    } finally { setPicUploading(false); }
  };

  const handlePictureDelete = async () => {
    if (!memberId) return;
    setPicUploading(true); setPicMsg(null);
    try {
      await orgApi.deleteMemberPicture(memberId);
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, profile_picture: null } } : prev);
      patchUser({ profile_picture: null });
      setPicMsg({ ok: true, text: 'Photo removed.' });
    } catch {
      setPicMsg({ ok: false, text: 'Failed to remove photo.' });
    } finally { setPicUploading(false); }
  };

  if (loading) return <Skeleton />;

  if (fetchErr || !profile) {
    const noMember = fetchErr === 'no_member';
    return (
      <div className="max-w-lg">
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <User size={15} className="text-gray-600" />
            <h1 className="text-[16px] font-bold text-gray-900">My Profile</h1>
          </div>
          <p className="text-[12px] text-gray-400">Your profile in the GILE Internal Portal.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <User size={20} className="text-gray-400" />
          </div>
          <p className="text-[14px] font-semibold text-gray-800 mb-1">
            {noMember ? 'No org profile found' : 'Could not load profile'}
          </p>
          <p className="text-[12.5px] text-gray-400 max-w-sm mx-auto">
            {noMember
              ? 'You haven\'t been added as an org member yet. Contact an administrator to get your profile set up.'
              : fetchErr}
          </p>
        </div>
      </div>
    );
  }

  const u = profile.user;
  const displayName =
    u.display_name ||
    [u.first_name, u.last_name].filter(Boolean).join(' ') ||
    u.username;
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const pct = profile.profile_completion_pct ?? 0;
  const joinedDate = new Date(profile.joined_date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const statusColors: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    inactive:  'bg-gray-100 text-gray-500',
    suspended: 'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-4">

      {/* Page title + save bar */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <User size={15} className="text-gray-600" />
            <h1 className="text-[16px] font-bold text-gray-900">My Profile</h1>
          </div>
          <p className="text-[12px] text-gray-400">Your profile in the GILE Internal Portal.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {msg && (
            <p className={`text-[12px] px-3 py-1.5 rounded-lg border ${
              msg.ok
                ? 'text-gray-800 bg-gray-50 border-gray-200'
                : 'text-red-600 bg-red-50 border-red-100'
            }`}>
              {msg.ok && <Check size={11} className="inline mr-1.5" />}
              {msg.text}
            </p>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Profile header card (full width) ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div className="relative shrink-0 group">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePictureChange} />
            {u.profile_picture ? (
              <img src={u.profile_picture} alt={displayName} className="w-16 h-16 rounded-xl object-cover border border-gray-100" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-900 text-white flex items-center justify-center text-[22px] font-bold">
                {initials || <User size={24} />}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={picUploading}
              className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
              title="Change photo"
            >
              {picUploading
                ? <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
                : <Camera size={18} className="text-white" />
              }
            </button>
            {u.profile_picture && !picUploading && (
              <button
                type="button"
                onClick={handlePictureDelete}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <X size={10} className="text-white" />
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {picMsg && (
              <p className={`text-[11.5px] mb-1.5 ${picMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
                {picMsg.ok && <Check size={11} className="inline mr-1" />}{picMsg.text}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[17px] font-bold text-gray-900">{displayName}</p>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusColors[profile.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {profile.status}
              </span>
            </div>
            <p className="text-[12.5px] text-gray-500 mt-0.5">
              @{u.username}
              {profile.role_name && <> · {profile.role_name}</>}
              {profile.department_name && <> · {profile.department_name}</>}
            </p>
            <p className="text-[11.5px] text-gray-400 mt-0.5">Joined {joinedDate}</p>
          </div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">

        {/* LEFT: Professional details + About/Notes */}
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Professional Details"
            description="Your role info and skills."
            icon={<Briefcase size={13} />}
          >
            <div className="space-y-3">
              <FormField label="Employee ID">
                <p className="text-[12.5px] text-gray-700 font-medium py-1.5">{employeeId || '—'}</p>
              </FormField>
              <FormField label="Skills">
                <SkillsInput value={skills} onChange={s => { setSkills(s); setMsg(null); }} disabled={saving} />
                <p className="text-[10.5px] text-gray-400 mt-1">Press Enter or comma to add · max 20</p>
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title="About / Notes"
            description="Anything you'd like the team to know about you."
            icon={<FileText size={13} />}
            className="flex-1"
          >
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setMsg(null); }}
              disabled={saving}
              placeholder="Add a short bio, working hours, timezone, or any relevant notes…"
              className={`${inputCls} resize-none flex-1 min-h-[120px]`}
            />
          </SectionCard>
        </div>

        {/* RIGHT: Emergency Contact + Reporting + Account Info */}
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Emergency Contact"
            description="Someone we can reach if needed."
            icon={<Phone size={13} />}
          >
            <div className="space-y-3">
              <FormField label="Contact Name">
                <input
                  type="text"
                  value={ecName}
                  onChange={e => { setEcName(e.target.value); setMsg(null); }}
                  disabled={saving}
                  placeholder="Full name"
                  className={inputCls}
                />
              </FormField>
              <FormField label="Phone Number">
                <input
                  type="tel"
                  value={ecPhone}
                  onChange={e => { setEcPhone(e.target.value); setMsg(null); }}
                  disabled={saving}
                  placeholder="+44 7700 000000"
                  className={inputCls}
                />
              </FormField>
            </div>
          </SectionCard>

          {(profile.manager || profile.buddy) && (
            <SectionCard
              title="Reporting & Support"
              description="Assigned by your administrator."
              icon={<Users size={13} />}
            >
              <div className="grid grid-cols-2 gap-4">
                {profile.manager && (
                  <div className="flex items-center gap-2.5">
                    {profile.manager.profile_picture ? (
                      <img src={profile.manager.profile_picture} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {profile.manager.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Manager</p>
                      <p className="text-[12px] font-semibold text-gray-800">{profile.manager.display_name}</p>
                    </div>
                  </div>
                )}
                {profile.buddy && (
                  <div className="flex items-center gap-2.5">
                    {profile.buddy.profile_picture ? (
                      <img src={profile.buddy.profile_picture} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                        {profile.buddy.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Buddy</p>
                      <p className="text-[12px] font-semibold text-gray-800">{profile.buddy.display_name}</p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Account Information"
            description="Managed by your administrator."
            icon={<User size={13} />}
            className="flex-1"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <ReadOnlyField label="Username"   value={`@${u.username}`} />
              <ReadOnlyField label="Email"      value={u.email} />
              <ReadOnlyField label="Role"       value={profile.role_name} />
              <ReadOnlyField label="Department" value={profile.department_name ?? '—'} />
              <ReadOnlyField label="Status"     value={profile.status.charAt(0).toUpperCase() + profile.status.slice(1)} />
              <ReadOnlyField label="Joined"     value={joinedDate} />
            </div>
            <p className="text-[11px] text-gray-400 mt-3 pt-2.5 border-t border-gray-100">
              To update account details, contact your administrator.
            </p>
          </SectionCard>
        </div>

      </div>

      {/* ── Confirm Save dialog ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Check size={16} className="text-gray-700" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">Save changes?</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Your profile will be updated immediately.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmOpen(false); handleSave(); }}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
