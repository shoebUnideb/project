import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, ImagePlus, Check, RefreshCw, Trash2,
  Globe, Lock, BarChart2, GraduationCap, Award,
  AlertTriangle, X, Plus,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import { onboardingApi } from '../../api/onboarding';
import type {
  WorkspaceCategory, WorkspaceLevel,
  WorkspacePrivacy, WorkspaceStatus, WorkspaceGradeDisplay,
  WorkspaceOnboardingQuestion,
} from '../../types';

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white placeholder-gray-300';
const labelCls = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1';

// ── UI primitives ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-gray-200'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <div>
        <p className="text-[13px] font-medium text-gray-800 leading-tight">{label}</p>
        {desc && <p className="text-[11.5px] text-gray-400 mt-0.5 leading-snug">{desc}</p>}
      </div>
    </label>
  );
}

function SectionCard({ title, desc, children, noPad }: {
  title: string; desc?: string; children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 pt-4 pb-2.5 border-b border-gray-100">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        {desc && <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{desc}</p>}
      </div>
      <div className={noPad ? '' : 'px-5 py-4 space-y-3'}>
        {children}
      </div>
    </div>
  );
}

function ConfirmSaveDialog({ onConfirm, onCancel, saving }: {
  onConfirm: () => void; onCancel: () => void; saving: boolean;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
            <Save size={18} className="text-primary-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900">Save changes?</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Your settings will be updated immediately.</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed mb-5">
          Are you sure you want to save these changes? Members will see the updated settings right away.
        </p>
        <div className="flex gap-2.5">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteConfirmDialog({ workspaceName, onConfirm, onCancel, deleting }: {
  workspaceName: string; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed === workspaceName;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors">
          <X size={16} />
        </button>

        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-[16px] font-bold text-gray-900">Delete workspace</p>
            <p className="text-[12px] text-red-500 font-medium mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        {/* Consequences */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-4 space-y-1.5">
          {[
            'All members will be removed',
            'All resources and files will be deleted',
            'All assignments and submissions will be lost',
            'All chat history will be permanently erased',
          ].map(item => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-[12.5px] text-red-700">{item}</p>
            </div>
          ))}
        </div>

        {/* Confirmation input */}
        <div className="mb-5">
          <p className="text-[12.5px] text-gray-600 mb-2">
            Type <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{workspaceName}</span> to confirm:
          </p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && matches) onConfirm(); }}
            placeholder={workspaceName}
            autoFocus
            className={`w-full px-3 py-2.5 text-[13px] border rounded-lg focus:outline-none focus:ring-2 bg-white transition-colors ${
              typed.length > 0
                ? matches
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-gray-300 focus:ring-gray-200'
                : 'border-gray-300 focus:ring-gray-200'
            }`}
          />
        </div>

        <div className="flex gap-2.5">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || deleting}
            className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {deleting ? <><RefreshCw size={13} className="animate-spin" /> Deleting…</> : <><Trash2 size={13} /> Delete workspace</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Intake Questions ──────────────────────────────────────────────────────────

function IntakeQuestionsContent({ workspaceId }: { workspaceId: number }) {
  const [questions, setQuestions] = useState<WorkspaceOnboardingQuestion[]>([]);
  const [newText, setNewText] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let mounted = true;
    onboardingApi.getQuestions(workspaceId).then(qs => { if (mounted) setQuestions(qs); }).catch(() => {});
    return () => { mounted = false; };
  }, [workspaceId]);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    try {
      const q = await onboardingApi.createQuestion(workspaceId, { question_text: newText.trim(), required: newRequired });
      setQuestions(prev => [...prev, q]);
      setNewText('');
      setNewRequired(false);
    } catch (_) {
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await onboardingApi.deleteQuestion(workspaceId, id);
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (_) {}
  };

  const handleToggleRequired = async (q: WorkspaceOnboardingQuestion) => {
    try {
      await onboardingApi.updateQuestion(workspaceId, q.id, { required: !q.required });
      setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, required: !item.required } : item));
    } catch (_) {}
  };

  return (
    <div className="space-y-2">
      {questions.length === 0 && (
        <p className="text-[12.5px] text-gray-400 italic">No intake questions yet. Add one below.</p>
      )}
      {questions.map(q => (
        <div key={q.id} className="flex items-start gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="flex-1 text-[13px] text-gray-800 leading-snug pt-0.5">{q.question_text}</p>
          <button onClick={() => handleToggleRequired(q)}
            className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors mt-0.5 ${
              q.required ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {q.required ? 'Required' : 'Optional'}
          </button>
          <button onClick={() => handleDelete(q.id)} className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder="Add a question…"
          className="flex-1 px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
        />
        <button onClick={() => setNewRequired(r => !r)}
          className={`shrink-0 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
            newRequired ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-500 hover:border-gray-400'
          }`}>
          Required
        </button>
        <button onClick={handleAdd} disabled={!newText.trim() || adding}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-[12.5px] font-semibold transition-colors">
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

// ── Page entry ────────────────────────────────────────────────────────────────

export default function WorkspaceSettingsPage() {
  const { workspace, isOwner, refetch } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (workspace && !isOwner) navigate(`/w/${workspace.slug}`, { replace: true });
  }, [workspace, isOwner, navigate]);

  if (!workspace || !isOwner) return null;

  return <SettingsForm key={workspace.id} workspace={workspace} refetch={refetch} navigate={navigate} />;
}

// ── Settings form ─────────────────────────────────────────────────────────────

function SettingsForm({ workspace, refetch, navigate }: {
  workspace: NonNullable<ReturnType<typeof useWorkspace>['workspace']>;
  refetch: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  // Identity
  const [name, setName]               = useState(workspace.name);
  const [description, setDesc]        = useState(workspace.description);
  const [goal, setGoal]               = useState(workspace.goal);
  const [emoji, setEmoji]             = useState(workspace.icon_emoji);
  const [logoPreview, setLogoPreview] = useState<string | null>(workspace.logo_url ?? null);
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const logoRef  = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(workspace.cover_image_url ?? null);
  const [coverFile, setCoverFile]       = useState<File | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Enrollment
  const [privacy, setPrivacy]             = useState<WorkspacePrivacy>(workspace.privacy);
  const [maxMembers, setMaxMembers]       = useState(workspace.max_members ? String(workspace.max_members) : '');
  const [autoAccept, setAutoAccept]       = useState(workspace.auto_accept);
  const [allowSelfUnenroll, setAllowSelf] = useState(workspace.allow_self_unenroll);
  const [enrollDeadline, setEnrollDead]   = useState(workspace.enrollment_deadline ?? '');

  // Details
  const [category, setCategory]     = useState<WorkspaceCategory | ''>(workspace.category);
  const [level, setLevel]           = useState<WorkspaceLevel | ''>(workspace.level);
  const [language, setLanguage]     = useState(workspace.language);
  const [targetCountry, setCountry] = useState(workspace.target_country);
  const [duration, setDuration]     = useState(workspace.estimated_duration);
  const [startDate, setStartDate]   = useState(workspace.course_start_date ?? '');
  const [endDate, setEndDate]       = useState(workspace.course_end_date ?? '');
  const [deadline, setDeadline]     = useState(workspace.target_deadline ?? '');
  const [officeHours, setOfficeHours] = useState(workspace.office_hours);
  const [tags, setTags]             = useState(workspace.tags);

  // Content
  const [welcomeMsg, setWelcomeMsg]     = useState(workspace.welcome_message);
  const [pinnedUrl, setPinnedUrl]       = useState(workspace.pinned_url);
  const [pinnedTitle, setPinnedTitle]   = useState(workspace.pinned_url_title);
  const [syllabusUrl, setSyllabus]      = useState(workspace.syllabus_url);

  // Features
  const [enableChat, setEnableChat]           = useState(workspace.enable_chat);
  const [enableResources, setEnableResources] = useState(workspace.enable_resources);
  const [enableTasks, setEnableTasks]         = useState(workspace.enable_tasks);
  const [enableProgress, setEnableProgress]   = useState(workspace.enable_progress);

  // Grading
  const [gradeDisplay, setGradeDisplay] = useState<WorkspaceGradeDisplay>(workspace.grade_display);
  const [certificate, setCertificate]   = useState(workspace.completion_certificate);
  const [minPct, setMinPct]             = useState(String(workspace.min_completion_pct));

  // Status
  const [wsStatus, setWsStatus] = useState<WorkspaceStatus>(workspace.workspace_status);

  // UI state
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState('');
  const [deleting, setDeleting]       = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isDirty =
    name !== workspace.name || description !== workspace.description ||
    goal !== workspace.goal || emoji !== workspace.icon_emoji ||
    logoFile !== null || coverFile !== null ||
    privacy !== workspace.privacy ||
    maxMembers !== (workspace.max_members ? String(workspace.max_members) : '') ||
    autoAccept !== workspace.auto_accept ||
    allowSelfUnenroll !== workspace.allow_self_unenroll ||
    enrollDeadline !== (workspace.enrollment_deadline ?? '') ||
    category !== workspace.category || level !== workspace.level ||
    language !== workspace.language || targetCountry !== workspace.target_country ||
    duration !== workspace.estimated_duration ||
    startDate !== (workspace.course_start_date ?? '') ||
    endDate !== (workspace.course_end_date ?? '') ||
    deadline !== (workspace.target_deadline ?? '') ||
    officeHours !== workspace.office_hours || tags !== workspace.tags ||
    welcomeMsg !== workspace.welcome_message ||
    pinnedUrl !== workspace.pinned_url || pinnedTitle !== workspace.pinned_url_title ||
    syllabusUrl !== workspace.syllabus_url ||
    enableChat !== workspace.enable_chat || enableResources !== workspace.enable_resources ||
    enableTasks !== workspace.enable_tasks || enableProgress !== workspace.enable_progress ||
    gradeDisplay !== workspace.grade_display ||
    certificate !== workspace.completion_certificate ||
    minPct !== String(workspace.min_completion_pct) ||
    wsStatus !== workspace.workspace_status;

  const handleSave = async () => {
    if (!name.trim()) { setError('Course name is required.'); setShowConfirmSave(false); return; }
    setSaving(true); setError('');
    try {
      await apiClient.initCsrf();
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      fd.append('goal', goal.trim());
      fd.append('icon_emoji', emoji);
      if (logoFile) fd.append('logo', logoFile);
      if (coverFile) fd.append('cover_image', coverFile);
      fd.append('privacy', privacy);
      if (maxMembers) fd.append('max_members', maxMembers); else fd.append('max_members', '');
      fd.append('auto_accept', String(autoAccept));
      fd.append('allow_self_unenroll', String(allowSelfUnenroll));
      if (enrollDeadline) fd.append('enrollment_deadline', enrollDeadline);
      fd.append('category', category);
      fd.append('level', level);
      fd.append('language', language);
      fd.append('target_country', targetCountry);
      fd.append('estimated_duration', duration);
      if (startDate) fd.append('course_start_date', startDate);
      if (endDate) fd.append('course_end_date', endDate);
      if (deadline) fd.append('target_deadline', deadline);
      fd.append('office_hours', officeHours);
      fd.append('tags', tags);
      fd.append('welcome_message', welcomeMsg.trim());
      fd.append('pinned_url', pinnedUrl.trim());
      fd.append('pinned_url_title', pinnedTitle.trim());
      fd.append('syllabus_url', syllabusUrl.trim());
      fd.append('enable_chat', String(enableChat));
      fd.append('enable_resources', String(enableResources));
      fd.append('enable_tasks', String(enableTasks));
      fd.append('enable_progress', String(enableProgress));
      fd.append('grade_display', gradeDisplay);
      fd.append('completion_certificate', String(certificate));
      fd.append('min_completion_pct', minPct || '80');
      fd.append('workspace_status', wsStatus);
      await workspacesApi.update(workspace.id, fd);
      refetch();
      setShowConfirmSave(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save settings. Please try again.');
      setShowConfirmSave(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.delete(workspace.id);
      navigate('/workspaces');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      {showConfirmSave && (
        <ConfirmSaveDialog onConfirm={handleSave} onCancel={() => setShowConfirmSave(false)} saving={saving} />
      )}
      {showDeleteDialog && (
        <DeleteConfirmDialog
          workspaceName={workspace.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          deleting={deleting}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">Settings</h2>
          <p className="text-[12.5px] text-gray-500 mt-0.5">Manage your workspace configuration.</p>
        </div>
        {isDirty && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            Unsaved changes
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{error}</div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-[3fr_2fr] gap-4 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-4">

          {/* IDENTITY */}
          <SectionCard title="Identity" desc="Name, branding, and visual identity of your workspace.">
            <div>
              <label className={labelCls}>Course name <span className="text-red-400 normal-case font-normal">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Web Development Bootcamp" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={3} value={description} onChange={e => setDesc(e.target.value)}
                className={inputCls + ' resize-none'} placeholder="What will students learn or experience?" />
            </div>
            <div>
              <label className={labelCls}>Learning objective / goal</label>
              <input value={goal} onChange={e => setGoal(e.target.value)} className={inputCls}
                placeholder="e.g. Build 3 full-stack projects and land a job" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Icon emoji</label>
                <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} className={inputCls} placeholder="🎓" />
              </div>
              <div>
                <label className={labelCls}>Logo</label>
                <div className="flex items-center gap-2">
                  {logoPreview
                    ? <img src={logoPreview} className="w-8 h-8 rounded-lg object-cover border border-gray-200" alt="" />
                    : <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300"><ImagePlus size={13} /></div>
                  }
                  <button type="button" onClick={() => logoRef.current?.click()}
                    className="px-2.5 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    {logoPreview ? 'Change' : 'Upload'}
                  </button>
                  {logoPreview && (
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="text-[12px] text-red-400 hover:text-red-600 transition-colors">Remove</button>
                  )}
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setLogoFile(f);
                    setLogoPreview(URL.createObjectURL(f));
                  }} />
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Cover image <span className="normal-case font-normal text-gray-400">(background of the workspace hero)</span></label>
              <div className="flex items-center gap-3">
                {coverPreview
                  ? <img src={coverPreview} className="w-24 h-13 rounded-lg object-cover border border-gray-200" alt="Cover" />
                  : <div className="w-24 h-13 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-300"><ImagePlus size={16} /></div>
                }
                <div className="flex flex-col gap-1.5">
                  <button type="button" onClick={() => coverRef.current?.click()}
                    className="px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    {coverPreview ? 'Change cover' : 'Upload cover'}
                  </button>
                  {coverPreview && (
                    <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                      className="text-[12px] text-red-400 hover:text-red-600 text-left transition-colors">Remove</button>
                  )}
                  <p className="text-[11px] text-gray-400">Recommended: 1200×400px, JPG/PNG</p>
                </div>
                <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setCoverFile(f);
                  setCoverPreview(URL.createObjectURL(f));
                }} />
              </div>
            </div>
          </SectionCard>

          {/* ENROLLMENT & ACCESS */}
          <SectionCard title="Enrollment & Access" desc="Control who can join and how enrollment works.">
            <div>
              <label className={labelCls}>Enrollment type</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'public',  title: 'Open',    icon: <Globe size={13} />,  desc: 'Anyone can request to join' },
                  { id: 'private', title: 'Private', icon: <Lock size={13} />,   desc: 'Hidden — you add members directly' },
                ] as { id: WorkspacePrivacy; title: string; icon: React.ReactNode; desc: string }[]).map(p => (
                  <button key={p.id} type="button" onClick={() => setPrivacy(p.id)}
                    className={`p-3 rounded-xl border text-left transition-colors ${privacy === p.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`flex items-center gap-1.5 mb-0.5 ${privacy === p.id ? 'text-primary-700' : 'text-gray-600'}`}>
                      {p.icon}
                      <p className="text-[12px] font-semibold">{p.title}</p>
                    </div>
                    <p className="text-[10.5px] text-gray-400 leading-snug">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Max students <span className="normal-case font-normal text-gray-400">(blank = unlimited)</span></label>
                <input type="number" min="1" value={maxMembers} onChange={e => setMaxMembers(e.target.value)}
                  placeholder="e.g. 30" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Enrollment deadline</label>
                <input type="date" value={enrollDeadline} onChange={e => setEnrollDead(e.target.value)} className={inputCls} />
              </div>
            </div>
            <Toggle checked={autoAccept} onChange={setAutoAccept}
              label="Auto-approve enrollments"
              desc="Students are approved instantly without manual review" />
            <Toggle checked={allowSelfUnenroll} onChange={setAllowSelf}
              label="Allow self-unenroll"
              desc="Students can leave the course on their own" />
          </SectionCard>

          {/* CONTENT */}
          <SectionCard title="Content" desc="Welcome message, announcements, and pinned resources.">
            <div>
              <label className={labelCls}>Welcome message <span className="normal-case font-normal text-gray-400">(shown on enrollment)</span></label>
              <textarea rows={3} value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)}
                placeholder="Welcome to the course! Here's what to expect…"
                className={inputCls + ' resize-none'} />
            </div>
            <div>
              <label className={labelCls}>Syllabus URL</label>
              <input value={syllabusUrl} onChange={e => setSyllabus(e.target.value)} className={inputCls} placeholder="https://…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Pinned resource URL</label>
                <input value={pinnedUrl} onChange={e => setPinnedUrl(e.target.value)} className={inputCls} placeholder="https://…" />
              </div>
              <div>
                <label className={labelCls}>Pinned resource label</label>
                <input value={pinnedTitle} onChange={e => setPinnedTitle(e.target.value)} className={inputCls} placeholder="e.g. Week 1 Slides" />
              </div>
            </div>
          </SectionCard>

          {/* INTAKE QUESTIONS */}
          <SectionCard title="Intake Questions" desc="Students are asked these after being approved. Answers appear in Submissions.">
            <IntakeQuestionsContent workspaceId={workspace.id} />
          </SectionCard>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-4">

          {/* WORKSPACE DETAILS */}
          <SectionCard title="Workspace Details" desc="Classification, scheduling, and context.">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as WorkspaceCategory | '')}
                  className={inputCls + ' cursor-pointer'}>
                  <option value="">Other</option>
                  <option value="career_coaching">Career Coaching</option>
                  <option value="skill_development">Skill Dev</option>
                  <option value="academic">Academic</option>
                  <option value="interview_prep">Interview Prep</option>
                  <option value="project">Project-Based</option>
                  <option value="personal_growth">Personal Growth</option>
                  <option value="networking">Networking</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Level</label>
                <select value={level} onChange={e => setLevel(e.target.value as WorkspaceLevel | '')}
                  className={inputCls + ' cursor-pointer'}>
                  <option value="">Any level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Language</label>
                <input value={language} onChange={e => setLanguage(e.target.value)} className={inputCls} placeholder="e.g. English" />
              </div>
              <div>
                <label className={labelCls}>Duration</label>
                <input value={duration} onChange={e => setDuration(e.target.value)} className={inputCls} placeholder="e.g. 8 weeks" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Focus area</label>
              <input value={targetCountry} onChange={e => setCountry(e.target.value)} className={inputCls} placeholder="e.g. Software Engineering" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Start date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Target date</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Office hours</label>
                <input value={officeHours} onChange={e => setOfficeHours(e.target.value)} className={inputCls} placeholder="e.g. Tue 6–8pm" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tags <span className="normal-case font-normal text-gray-400">(comma-separated)</span></label>
              <input value={tags} onChange={e => setTags(e.target.value)} className={inputCls} placeholder="React, JavaScript…" />
            </div>
          </SectionCard>

          {/* FEATURES */}
          <SectionCard title="Features" desc="Tabs visible to members.">
            <Toggle checked={enableResources} onChange={setEnableResources}
              label="Materials tab" desc="Files, links, and notes" />
            <Toggle checked={enableTasks} onChange={setEnableTasks}
              label="Assignments tab" desc="View and track tasks" />
            <Toggle checked={enableChat} onChange={setEnableChat}
              label="Discussion tab" desc="Group chat for members" />
            <Toggle checked={enableProgress} onChange={setEnableProgress}
              label="Progress / Grades tab" desc="Progress and grades (coming soon)" />
          </SectionCard>

          {/* PROGRESS & GRADING */}
          <SectionCard title="Progress & Grading" desc="How progress is measured and displayed.">
            <div>
              <label className={labelCls}>Grade display</label>
              <div className="flex gap-1.5">
                {([
                  { id: 'points',     label: 'Points',     icon: <Award size={12} /> },
                  { id: 'percentage', label: '%',          icon: <BarChart2 size={12} /> },
                  { id: 'letter',     label: 'Letter',     icon: <GraduationCap size={12} /> },
                ] as { id: WorkspaceGradeDisplay; label: string; icon: React.ReactNode }[]).map(g => (
                  <button key={g.id} type="button" onClick={() => setGradeDisplay(g.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                      gradeDisplay === g.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {g.icon}{g.label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle checked={certificate} onChange={setCertificate}
              label="Issue completion certificate"
              desc="Students who complete receive a certificate" />
            {certificate && (
              <div>
                <label className={labelCls}>Min completion % for certificate</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="50" max="100" step="5" value={minPct}
                    onChange={e => setMinPct(e.target.value)}
                    className="flex-1 accent-primary-600" />
                  <span className="text-[13px] font-semibold text-gray-700 w-9 text-right">{minPct}%</span>
                </div>
              </div>
            )}
          </SectionCard>

          {/* STATUS */}
          <SectionCard title="Status" desc="Current state of this workspace.">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: 'active',       label: 'Active',       desc: 'Open' },
                { id: 'winding_down', label: 'Winding Down', desc: 'Finishing' },
                { id: 'archived',     label: 'Archived',     desc: 'Read-only' },
              ] as { id: WorkspaceStatus; label: string; desc: string }[]).map(s => (
                <button key={s.id} type="button" onClick={() => setWsStatus(s.id)}
                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                    wsStatus === s.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <p className={`text-[11.5px] font-semibold leading-tight ${wsStatus === s.id ? 'text-primary-700' : 'text-gray-700'}`}>{s.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* DANGER ZONE */}
          <div className="bg-red-50/40 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-red-700 mb-1">Danger Zone</p>
                <p className="text-[11.5px] text-red-600 mb-3 leading-snug">
                  Permanently removes all members, resources, assignments, and chat history.
                </p>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[12px] font-semibold rounded-lg transition-colors"
                >
                  <Trash2 size={12} />
                  {deleting ? 'Deleting…' : `Delete "${workspace.name}"`}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 py-3 flex justify-end">
        <button
          onClick={() => setShowConfirmSave(true)}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl shadow-lg transition-colors"
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save all changes'}
        </button>
      </div>
    </div>
  );
}
