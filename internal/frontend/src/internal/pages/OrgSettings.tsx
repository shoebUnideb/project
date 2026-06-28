import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Image, Globe, Lock, Users, UserCog,
  BarChart2, ScrollText, CalendarDays, Puzzle, Settings,
  GraduationCap, ChevronRight, Sparkles, FileText, FileCode,
  Key, Shield, Activity, X, Eye, EyeOff,
  FolderOpen, BookOpen, UserPlus, Clock,
} from 'lucide-react';
import {
  settingsApi, auditApi, membersStatsApi,
  type OrgSettingsData, type AuditLogEntry, type MemberStats,
} from '../api/orgApi';
import { authApi } from '../../api/auth';
import { useOrg } from '../context/OrgContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Modal Shell ───────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[460px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-900">{title}</p>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
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

const inputCls = 'w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 disabled:bg-gray-50';

// ── Modal: Org Info ───────────────────────────────────────────────────────────

function OrgInfoModal({ settings, onSuccess, onClose }: {
  settings: OrgSettingsData;
  onSuccess: (updated: OrgSettingsData) => void;
  onClose: () => void;
}) {
  const [orgName, setOrgName] = useState(settings.org_name);
  const [desc,    setDesc]    = useState(settings.description);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  const handleSave = async () => {
    if (!orgName.trim()) return;
    setSaving(true); setErr(null);
    try {
      const updated = await settingsApi.updateSettings({ org_name: orgName.trim(), description: desc.trim() });
      onSuccess(updated);
    } catch {
      setErr('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Organisation Profile" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <FormField label="Organisation Name *">
          <input value={orgName} onChange={e => setOrgName(e.target.value)} disabled={saving} className={inputCls} placeholder="e.g. Acme Foundation" />
        </FormField>
        <FormField label="Description">
          <textarea value={desc} onChange={e => setDesc(e.target.value)} disabled={saving} rows={3}
            className={`${inputCls} resize-none`} placeholder="Brief description of your organisation" />
        </FormField>
        {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving || !orgName.trim()}
          className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Contact Info ───────────────────────────────────────────────────────

function ContactModal({ settings, onSuccess, onClose }: {
  settings: OrgSettingsData;
  onSuccess: (updated: OrgSettingsData) => void;
  onClose: () => void;
}) {
  const [email,   setEmail]   = useState(settings.contact_email);
  const [website, setWebsite] = useState(settings.website);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const updated = await settingsApi.updateSettings({ contact_email: email.trim(), website: website.trim() });
      onSuccess(updated);
    } catch {
      setErr('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Contact & Web" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <FormField label="Contact Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={saving} className={inputCls} placeholder="contact@example.com" />
        </FormField>
        <FormField label="Website URL">
          <input type="url" value={website} onChange={e => setWebsite(e.target.value)} disabled={saving} className={inputCls} placeholder="https://example.com" />
        </FormField>
        {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Logo ───────────────────────────────────────────────────────────────

function LogoModal({ settings, onSuccess, onClose }: {
  settings: OrgSettingsData;
  onSuccess: (updated: OrgSettingsData) => void;
  onClose: () => void;
}) {
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(f ? URL.createObjectURL(f) : null); setErr(null);
  };

  const handleSave = async () => {
    if (!file) return;
    setSaving(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const updated = await settingsApi.updateSettingsWithLogo(fd);
      onSuccess(updated);
    } catch {
      setErr('Failed to upload. Please try again.');
    } finally { setSaving(false); }
  };

  const currentLogo = preview ?? settings.logo_url;

  return (
    <ModalShell title="Logo & Branding" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
            {currentLogo
              ? <img src={currentLogo} alt="logo" className="w-full h-full object-cover" />
              : <Image size={22} className="text-gray-300" />
            }
          </div>
          <div className="flex-1 space-y-1.5">
            <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleChange} />
            <button onClick={() => fileRef.current?.click()} disabled={saving}
              className="px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg disabled:opacity-60 transition-colors">
              {file ? 'Change File' : 'Choose Logo'}
            </button>
            {file && <p className="text-[11px] text-gray-500 truncate max-w-[180px]">{file.name}</p>}
            <p className="text-[11px] text-gray-400">PNG or SVG, min 200×200px</p>
          </div>
        </div>
        {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving || !file}
          className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Uploading…' : 'Upload Logo'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Localisation ───────────────────────────────────────────────────────

function LocalizationModal({ settings, onSuccess, onClose }: {
  settings: OrgSettingsData;
  onSuccess: (updated: OrgSettingsData) => void;
  onClose: () => void;
}) {
  const [timezone, setTimezone] = useState(settings.timezone);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const updated = await settingsApi.updateSettings({ timezone });
      onSuccess(updated);
    } catch {
      setErr('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Localisation" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <FormField label="Timezone">
          <select value={timezone} onChange={e => setTimezone(e.target.value)} disabled={saving} className={inputCls}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </FormField>
        <p className="text-[11px] text-gray-400">
          Applies to event scheduling, check-in periods, and report timestamps.
        </p>
        {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Training Config ────────────────────────────────────────────────────

function TrainingConfigModal({ settings, onSuccess, onClose }: {
  settings: OrgSettingsData;
  onSuccess: (updated: OrgSettingsData) => void;
  onClose: () => void;
}) {
  const [autoEnroll,   setAutoEnroll]   = useState(settings.training_auto_enroll_mandatory);
  const [certEnabled,  setCertEnabled]  = useState(settings.training_certificate_enabled);
  const [reminderDays, setReminderDays] = useState(String(settings.training_reminder_days));
  const [passScore,    setPassScore]    = useState(String(settings.training_default_pass_score));
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState<string | null>(null);

  const handleSave = async () => {
    const rd = parseInt(reminderDays, 10);
    const ps = parseInt(passScore, 10);
    if (isNaN(rd) || rd < 0 || isNaN(ps) || ps < 0 || ps > 100) {
      setErr('Reminder days must be ≥ 0 and pass score must be 0–100.'); return;
    }
    setSaving(true); setErr(null);
    try {
      const updated = await settingsApi.updateSettings({
        training_auto_enroll_mandatory: autoEnroll,
        training_certificate_enabled: certEnabled,
        training_reminder_days: rd,
        training_default_pass_score: ps,
      });
      onSuccess(updated);
    } catch {
      setErr('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!value)} disabled={saving}
      className={`relative inline-flex h-4.5 h-[18px] w-8 items-center rounded-full transition-colors disabled:opacity-60 ${value ? 'bg-gray-800' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[17px]' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <ModalShell title="Training Configuration" onClose={onClose}>
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12.5px] font-semibold text-gray-800">Auto-enrol in mandatory courses</p>
            <p className="text-[11px] text-gray-400 mt-0.5">New members enrolled in mandatory training automatically</p>
          </div>
          <Toggle value={autoEnroll} onChange={setAutoEnroll} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12.5px] font-semibold text-gray-800">Issue completion certificates</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Members receive a certificate on course completion</p>
          </div>
          <Toggle value={certEnabled} onChange={setCertEnabled} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Reminder days before deadline">
            <input type="number" min={0} value={reminderDays} onChange={e => setReminderDays(e.target.value)} disabled={saving} className={inputCls} />
          </FormField>
          <FormField label="Default pass score (%)">
            <input type="number" min={0} max={100} value={passScore} onChange={e => setPassScore(e.target.value)} disabled={saving} className={inputCls} />
          </FormField>
        </div>
        {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal: Change Password ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const handleSave = async () => {
    if (!current || !next) { setErr('All fields are required.'); return; }
    if (next !== confirm)   { setErr('New passwords do not match.'); return; }
    if (next.length < 8)    { setErr('New password must be at least 8 characters.'); return; }
    setSaving(true); setErr(null);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      setSuccess(true);
    } catch (e: unknown) {
      const detail = (e as { data?: { detail?: string } })?.data?.detail;
      setErr(detail ?? 'Failed to change password. Please try again.');
    } finally { setSaving(false); }
  };

  if (success) {
    return (
      <ModalShell title="Change Password" onClose={onClose}>
        <div className="px-5 py-8 flex flex-col items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
            <Key size={17} className="text-white" />
          </div>
          <p className="text-[13px] font-semibold text-gray-800">Password changed successfully</p>
          <p className="text-[12px] text-gray-400">Your session remains active.</p>
          <button onClick={onClose} className="mt-1.5 px-4 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors">Done</button>
        </div>
      </ModalShell>
    );
  }

  const EyeBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
      {show ? <EyeOff size={13} /> : <Eye size={13} />}
    </button>
  );

  return (
    <ModalShell title="Change Password" onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
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
        {err && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
        <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Changing…' : 'Change Password'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Setting Card ──────────────────────────────────────────────────────────────

type ModalType = 'org-info' | 'contact' | 'logo' | 'localization' | 'training' | 'password';

function SettingCard({ icon, title, subtitle, onClick }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2.5 p-3.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm text-left transition-all group w-full"
    >
      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-gray-200 transition-colors">
        <span className="text-gray-700">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-800">{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{subtitle}</p>
      </div>
      <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-1.5 transition-colors" />
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[12.5px] font-bold text-gray-800">{title}</p>
      {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 bg-gray-100 rounded w-28 animate-pulse" />
            <div className="grid grid-cols-2 gap-2.5">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-[60px] bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="w-60 space-y-3">
        <div className="h-[150px] bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[170px] bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[190px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgSettings() {
  const { isSuperadmin, canManageMembers, isLoading: orgLoading } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;
  const navigate = useNavigate();

  const [settings,    setSettings]    = useState<OrgSettingsData | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [auditLogs,   setAuditLogs]   = useState<AuditLogEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState<ModalType | null>(null);

  useEffect(() => {
    if (orgLoading) return;
    if (!isAdmin) { setLoading(false); return; }
    Promise.all([
      settingsApi.getSettings(),
      membersStatsApi.getStats(),
      auditApi.getLogs({ limit: 5 }),
    ]).then(([s, ms, logs]) => {
      setSettings(s); setMemberStats(ms); setAuditLogs(logs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [orgLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModalSuccess = (updated: OrgSettingsData) => { setSettings(updated); setModal(null); };
  const nav = (path: string) => navigate(path);

  if (orgLoading || loading) return <PageSkeleton />;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
          <Lock size={20} className="text-gray-400" />
        </div>
        <p className="text-[14px] font-semibold text-gray-700">Access Denied</p>
        <p className="text-[12.5px] text-gray-400 mt-0.5">Only admins can access settings.</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-[13px] text-gray-500">Could not load settings.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Settings size={15} className="text-gray-600" />
          <h1 className="text-[16px] font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-[12px] text-gray-400">Manage organisation preferences, access, and system configuration.</p>
      </div>

      {/* ── Two-column Layout ────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Organisation */}
          <section>
            <SectionHeader title="Organisation" description="Profile, branding, and regional settings." />
            <div className="grid grid-cols-2 gap-2.5">
              <SettingCard icon={<Building2 size={13} />} title="Organisation Profile"
                subtitle="Update name and description" onClick={() => setModal('org-info')} />
              <SettingCard icon={<Image size={13} />} title="Logo & Branding"
                subtitle="Upload or replace organisation logo" onClick={() => setModal('logo')} />
              <SettingCard icon={<Globe size={13} />} title="Localisation"
                subtitle={`Timezone: ${settings.timezone}`} onClick={() => setModal('localization')} />
              <SettingCard icon={<Activity size={13} />} title="Contact & Web"
                subtitle={settings.contact_email || 'Set contact email and website'} onClick={() => setModal('contact')} />
            </div>
          </section>

          {/* Members & Access */}
          <section>
            <SectionHeader title="Members & Access" description="Users, roles, departments, and directory." />
            <div className="grid grid-cols-2 gap-2.5">
              <SettingCard icon={<UserCog size={13} />} title="Users & Roles"
                subtitle={`${memberStats?.total ?? '–'} members · manage access`} onClick={() => nav('/org/members')} />
              <SettingCard icon={<Shield size={13} />} title="Role Permissions"
                subtitle="Configure role levels and capabilities" onClick={() => nav('/org/roles')} />
              <SettingCard icon={<Building2 size={13} />} title="Departments"
                subtitle="Manage teams and department structure" onClick={() => nav('/org/departments')} />
              <SettingCard icon={<Users size={13} />} title="People Directory"
                subtitle="Searchable member directory" onClick={() => nav('/org/directory')} />
            </div>
          </section>

          {/* Content & Templates */}
          <section>
            <SectionHeader title="Content & Templates" description="Onboarding templates, documents, and training." />
            <div className="grid grid-cols-2 gap-2.5">
              <SettingCard icon={<FileCode size={13} />} title="Task Templates"
                subtitle="Build and manage onboarding task templates" onClick={() => nav('/org/task-templates')} />
              <SettingCard icon={<FileText size={13} />} title="Document Templates"
                subtitle="Manage required document templates" onClick={() => nav('/org/doc-templates')} />
              <SettingCard icon={<Sparkles size={13} />} title="Template Hub"
                subtitle="Browse and import templates" onClick={() => nav('/org/template-hub')} />
              <SettingCard icon={<GraduationCap size={13} />} title="Training Courses"
                subtitle="Manage courses and enrolments" onClick={() => nav('/org/training')} />
            </div>
          </section>

          {/* Reports & Monitoring */}
          <section>
            <SectionHeader title="Reports & Monitoring" description="Analytics, audit trails, events, and integrations." />
            <div className="grid grid-cols-2 gap-2.5">
              <SettingCard icon={<BarChart2 size={13} />} title="Analytics & Reports"
                subtitle="Contributions, training, check-in reports" onClick={() => nav('/org/analytics')} />
              <SettingCard icon={<ScrollText size={13} />} title="Audit Logs"
                subtitle="Complete system activity trail" onClick={() => nav('/org/audit')} />
              <SettingCard icon={<CalendarDays size={13} />} title="Events & Meetings"
                subtitle="Schedule and manage organisation events" onClick={() => nav('/org/events')} />
              <SettingCard icon={<Puzzle size={13} />} title="Integrations"
                subtitle="Connect third-party tools" onClick={() => nav('/org/integrations')} />
            </div>
          </section>

          {/* Security & System */}
          <section>
            <SectionHeader title="Security & System" description="Password, training defaults, agreements, and recruitment." />
            <div className="grid grid-cols-2 gap-2.5">
              <SettingCard icon={<Key size={13} />} title="Change Password"
                subtitle="Update your admin account password" onClick={() => setModal('password')} />
              <SettingCard icon={<GraduationCap size={13} />} title="Training Configuration"
                subtitle="Auto-enrol, certificates, pass scores" onClick={() => setModal('training')} />
              <SettingCard icon={<BookOpen size={13} />} title="Agreements"
                subtitle="Manage organisation agreements" onClick={() => nav('/org/agreements')} />
              <SettingCard icon={<UserPlus size={13} />} title="Recruitment"
                subtitle="Review member referrals and requests" onClick={() => nav('/org/recruitment')} />
            </div>
          </section>
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
        <div className="w-60 shrink-0 space-y-3">

          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-[12px] font-bold text-gray-800">Quick Actions</p>
            </div>
            <div className="py-0.5">
              {[
                { icon: <UserPlus size={12} />,   label: 'Add Member',      action: () => nav('/org/members') },
                { icon: <Image size={12} />,       label: 'Upload Logo',     action: () => setModal('logo') },
                { icon: <Key size={12} />,         label: 'Change Password', action: () => setModal('password') },
                { icon: <BarChart2 size={12} />,   label: 'View Analytics',  action: () => nav('/org/analytics') },
                { icon: <ScrollText size={12} />,  label: 'Audit Logs',      action: () => nav('/org/audit') },
                { icon: <Building2 size={12} />,   label: 'Departments',     action: () => nav('/org/departments') },
              ].map(({ icon, label, action }) => (
                <button key={label} onClick={action}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                  <span className="text-gray-400">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-[12px] font-bold text-gray-800">System Information</p>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              {[
                { label: 'Organisation',   value: settings.org_name || '—' },
                { label: 'Timezone',       value: settings.timezone },
                { label: 'Total Members',  value: memberStats ? String(memberStats.total) : '—' },
                { label: 'Active Members', value: memberStats ? String(memberStats.active) : '—' },
                { label: 'Last Updated',   value: settings.updated_at ? fmtTime(settings.updated_at) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{label}</span>
                  <span className="text-[11.5px] font-medium text-gray-700 text-right max-w-[120px] truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[12px] font-bold text-gray-800">Recent Activity</p>
              <button onClick={() => nav('/org/audit')} className="text-[10.5px] text-gray-400 hover:text-gray-700 transition-colors">
                View all
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {auditLogs.length === 0 ? (
                <div className="px-3 py-5 text-center">
                  <Clock size={14} className="text-gray-300 mx-auto mb-1" />
                  <p className="text-[11px] text-gray-400">No recent activity</p>
                </div>
              ) : auditLogs.map(log => (
                <div key={log.id} className="px-3 py-2">
                  <div className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[8.5px] font-bold text-gray-500">
                        {log.actor_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-700 leading-snug">
                        <span className="font-medium">{log.actor_name}</span>
                        {' '}<span className="text-gray-400">{log.action}</span>
                        {log.record_repr && <span className="text-gray-500 font-medium"> {log.record_repr}</span>}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(log.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}
      {modal === 'org-info'     && <OrgInfoModal       settings={settings} onSuccess={handleModalSuccess} onClose={() => setModal(null)} />}
      {modal === 'contact'      && <ContactModal        settings={settings} onSuccess={handleModalSuccess} onClose={() => setModal(null)} />}
      {modal === 'logo'         && <LogoModal           settings={settings} onSuccess={handleModalSuccess} onClose={() => setModal(null)} />}
      {modal === 'localization' && <LocalizationModal   settings={settings} onSuccess={handleModalSuccess} onClose={() => setModal(null)} />}
      {modal === 'training'     && <TrainingConfigModal settings={settings} onSuccess={handleModalSuccess} onClose={() => setModal(null)} />}
      {modal === 'password'     && <ChangePasswordModal onClose={() => setModal(null)} />}
    </>
  );
}
