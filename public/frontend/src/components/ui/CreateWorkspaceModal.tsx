import { useState, useRef, type FormEvent } from 'react';
import { X, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import type { Workspace, WorkspaceCategory, WorkspaceLevel, WorkspacePrivacy, WorkspaceStatus } from '../../types';
import { WORKSPACE_COLORS } from '../../utils/workspaceColors';

const BANNER_GRADIENT: Record<string, string> = {
  blue:    'from-primary-500 to-primary-700',
  indigo:  'from-indigo-500 to-indigo-700',
  purple:  'from-purple-500 to-purple-700',
  teal:    'from-teal-500 to-teal-700',
  green:   'from-green-500 to-green-700',
  emerald: 'from-emerald-500 to-emerald-700',
  orange:  'from-orange-500 to-orange-700',
  red:     'from-red-500 to-red-700',
  pink:    'from-pink-500 to-pink-700',
  amber:   'from-amber-500 to-amber-700',
  cyan:    'from-cyan-500 to-cyan-700',
  slate:   'from-slate-500 to-slate-700',
  violet:  'from-violet-500 to-violet-700',
  rose:    'from-rose-500 to-rose-700',
};

const CATEGORIES: { id: WorkspaceCategory | ''; label: string }[] = [
  { id: '',                 label: 'None' },
  { id: 'career_coaching',  label: 'Career Coaching' },
  { id: 'skill_development',label: 'Skill Development' },
  { id: 'academic',         label: 'Academic Support' },
  { id: 'interview_prep',   label: 'Interview Prep' },
  { id: 'project',          label: 'Project-Based' },
  { id: 'personal_growth',  label: 'Personal Growth' },
  { id: 'networking',       label: 'Networking' },
  { id: 'other',            label: 'Other' },
];

const LEVELS: { id: WorkspaceLevel | ''; label: string }[] = [
  { id: '',              label: 'Any level' },
  { id: 'beginner',      label: 'Beginner' },
  { id: 'intermediate',  label: 'Intermediate' },
  { id: 'advanced',      label: 'Advanced' },
];

const WS_STATUSES: { id: WorkspaceStatus; label: string }[] = [
  { id: 'active',       label: 'Active' },
  { id: 'winding_down', label: 'Winding Down' },
  { id: 'archived',     label: 'Archived' },
];

const STEPS = ['Basics', 'Details', 'Access', 'Extras'];

interface Props {
  onClose: () => void;
  onCreated: (w: Workspace) => void;
  mode?: 'create' | 'edit';
  initial?: Workspace;
}

export default function CreateWorkspaceModal({ onClose, onCreated, mode = 'create', initial }: Props) {
  const [step, setStep] = useState(0);

  // Step 0 — Basics
  const [name, setName]           = useState(initial?.name ?? '');
  const [description, setDesc]    = useState(initial?.description ?? '');
  const [goal, setGoal]           = useState(initial?.goal ?? '');
  const [accentColor, setAccentColor] = useState(initial?.accent_color ?? 'blue');
  const [emoji, setEmoji]         = useState(initial?.icon_emoji ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.cover_image_url ?? null);
  const [logoFile, setLogoFile]   = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.logo_url ?? null);
  const coverRef = useRef<HTMLInputElement>(null);
  const logoRef  = useRef<HTMLInputElement>(null);

  // Step 1 — Details
  const [category, setCategory]         = useState<WorkspaceCategory | ''>(initial?.category ?? '');
  const [level, setLevel]               = useState<WorkspaceLevel | ''>(initial?.level ?? '');
  const [focusArea, setFocusArea]       = useState(initial?.target_country ?? '');
  const [language, setLanguage]         = useState(initial?.language ?? '');
  const [targetDeadline, setTargetDeadline] = useState(initial?.target_deadline ?? '');
  const [officeHours, setOfficeHours]   = useState(initial?.office_hours ?? '');
  const [tags, setTags]                 = useState(initial?.tags ?? '');

  // Step 2 — Access
  const [privacy, setPrivacy]           = useState<WorkspacePrivacy>(initial?.privacy ?? 'public');
  const [maxMembers, setMaxMembers]     = useState(initial?.max_members ? String(initial.max_members) : '');
  const [autoAccept, setAutoAccept]     = useState(initial?.auto_accept ?? false);

  // Step 3 — Extras
  const [welcomeMsg, setWelcomeMsg]     = useState(initial?.welcome_message ?? '');
  const [pinnedUrl, setPinnedUrl]       = useState(initial?.pinned_url ?? '');
  const [pinnedUrlTitle, setPinnedUrlTitle] = useState(initial?.pinned_url_title ?? '');
  const [wsStatus, setWsStatus]         = useState<WorkspaceStatus>(initial?.workspace_status ?? 'active');

  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const inputCls = 'w-full px-3.5 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-300 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5';
  const selectCls = inputCls + ' cursor-pointer';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Workspace name is required.'); setStep(0); return; }
    setError('');
    setLoading(true);
    try {
      await apiClient.initCsrf();
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      fd.append('goal', goal.trim());
      fd.append('accent_color', accentColor);
      fd.append('icon_emoji', emoji);
      if (coverFile) fd.append('cover_image', coverFile);
      if (logoFile) fd.append('logo', logoFile);
      fd.append('category', category);
      fd.append('level', level);
      fd.append('target_country', focusArea.trim());
      fd.append('language', language.trim());
      if (targetDeadline) fd.append('target_deadline', targetDeadline);
      fd.append('office_hours', officeHours.trim());
      fd.append('tags', tags.trim());
      fd.append('privacy', privacy);
      if (maxMembers) fd.append('max_members', maxMembers);
      fd.append('auto_accept', String(autoAccept));
      fd.append('welcome_message', welcomeMsg.trim());
      fd.append('pinned_url', pinnedUrl.trim());
      fd.append('pinned_url_title', pinnedUrlTitle.trim());
      fd.append('workspace_status', wsStatus);
      const workspace = mode === 'edit' && initial
        ? await workspacesApi.update(initial.id, fd)
        : await workspacesApi.create(fd);
      onCreated(workspace);
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string; [k: string]: unknown }; status?: number };
      const detail = apiErr?.data?.detail
        || (typeof apiErr?.data === 'object' ? JSON.stringify(apiErr.data) : null)
        || (err instanceof Error ? err.message : null)
        || `Failed to ${mode === 'edit' ? 'save' : 'create'} workspace. Please try again.`;
      setError(String(detail));
    } finally {
      setLoading(false);
    }
  };

  const canNext = step === 0 ? name.trim().length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Cover strip */}
        <div
          className={`relative h-20 rounded-t-2xl bg-gradient-to-r ${
            BANNER_GRADIENT[accentColor] ?? BANNER_GRADIENT.blue
          } overflow-hidden`}
        >
          {coverPreview && (
            <img src={coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          )}
          <div className="absolute inset-0 flex items-center px-5 gap-3">
            {emoji && <span className="text-3xl">{emoji}</span>}
            <span className="text-white font-bold text-[16px] drop-shadow truncate">{name || 'New Workspace'}</span>
          </div>
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="absolute top-2 right-10 bg-black/30 text-white rounded-full p-1.5 hover:bg-black/50 transition-colors"
            title="Upload cover image"
          >
            <ImagePlus size={14} />
          </button>
          <button onClick={onClose} className="absolute top-2 right-2 bg-black/30 text-white rounded-full p-1.5 hover:bg-black/50 transition-colors">
            <X size={14} />
          </button>
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setCoverFile(f);
            setCoverPreview(URL.createObjectURL(f));
          }} />
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setLogoFile(f);
            setLogoPreview(URL.createObjectURL(f));
          }} />
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-5 pt-4 gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => i < step || canNext ? setStep(i) : undefined}
                className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                  i === step ? 'text-primary-600' : i < step ? 'text-gray-400 hover:text-gray-600 cursor-pointer' : 'text-gray-300 cursor-default'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === step ? 'bg-primary-600 text-white' : i < step ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-300'
                }`}>{i + 1}</span>
                {s}
              </button>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-primary-200' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{error}</div>
          )}

          {/* ── Step 0: Basics ── */}
          {step === 0 && (
            <>
              <div>
                <label className={labelCls}>Workspace name <span className="text-red-400 normal-case font-normal">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Career Coaching — Spring 2025" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea rows={3} value={description} onChange={e => setDesc(e.target.value)}
                  placeholder="What is this workspace for? Who is it for?" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>Goal / outcome</label>
                <input value={goal} onChange={e => setGoal(e.target.value)}
                  placeholder="e.g. Land a software engineering role by Q3" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Icon emoji</label>
                <input value={emoji} onChange={e => setEmoji(e.target.value)}
                  placeholder="🎯" maxLength={4} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Workspace logo <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300">
                      <ImagePlus size={18} />
                    </div>
                  )}
                  <button type="button" onClick={() => logoRef.current?.click()}
                    className="px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    {logoPreview ? 'Change logo' : 'Upload logo'}
                  </button>
                  {logoPreview && (
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="text-[12px] text-red-400 hover:text-red-600 transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Cover photo <span className="normal-case font-normal text-gray-400">(background of the workspace hero)</span></label>
                <div className="flex items-center gap-3">
                  {coverPreview ? (
                    <img src={coverPreview} alt="cover" className="w-24 h-14 rounded-lg object-cover border border-gray-200" />
                  ) : (
                    <div className="w-24 h-14 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                      <ImagePlus size={18} />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => coverRef.current?.click()}
                      className="px-3 py-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      {coverPreview ? 'Change cover' : 'Upload cover'}
                    </button>
                    {coverPreview && (
                      <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                        className="text-[12px] text-red-400 hover:text-red-600 transition-colors text-left">
                        Remove
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400">Recommended: 1200×400px</p>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Accent color <span className="normal-case font-normal text-gray-400">(used in workspace shell)</span></label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(Object.entries(WORKSPACE_COLORS) as [string, { bg: string; label: string }][]).map(([key, val]) => (
                    <button key={key} type="button" onClick={() => setAccentColor(key)}
                      title={val.label}
                      className={`w-7 h-7 rounded-full transition-all ${
                        accentColor === key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: val.bg }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value as WorkspaceCategory | '')} className={selectCls}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Level</label>
                  <select value={level} onChange={e => setLevel(e.target.value as WorkspaceLevel | '')} className={selectCls}>
                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Focus area</label>
                  <input value={focusArea} onChange={e => setFocusArea(e.target.value)}
                    placeholder="e.g. Software Engineering" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Working language</label>
                  <input value={language} onChange={e => setLanguage(e.target.value)}
                    placeholder="e.g. English" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Target date</label>
                  <input type="date" value={targetDeadline} onChange={e => setTargetDeadline(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Office hours</label>
                  <input value={officeHours} onChange={e => setOfficeHours(e.target.value)}
                    placeholder="e.g. Tues 6–8pm CET" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Tags <span className="normal-case font-normal text-gray-400">(comma-separated)</span></label>
                <input value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="e.g. Career, Coding, Resume" className={inputCls} />
              </div>
            </>
          )}

          {/* ── Step 2: Access ── */}
          {step === 2 && (
            <>
              <div>
                <label className={labelCls}>Privacy</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'public',  title: 'Public',  desc: 'Anyone can request to join' },
                    { id: 'private', title: 'Private', desc: 'Hidden — you add members directly' },
                  ] as { id: WorkspacePrivacy; title: string; desc: string }[]).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPrivacy(p.id)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        privacy === p.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-[12px] font-semibold ${privacy === p.id ? 'text-primary-700' : 'text-gray-700'}`}>{p.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Max members <span className="normal-case font-normal text-gray-400">(leave blank for unlimited)</span></label>
                <input type="number" min="1" value={maxMembers} onChange={e => setMaxMembers(e.target.value)}
                  placeholder="e.g. 20" className={inputCls} />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={autoAccept} onChange={e => setAutoAccept(e.target.checked)}
                  className="mt-0.5 accent-primary-600" />
                <div>
                  <p className="text-[13px] font-medium text-gray-700">Auto-accept requests</p>
                  <p className="text-[11px] text-gray-400">Members are approved instantly without manual review</p>
                </div>
              </label>
              <div>
                <label className={labelCls}>Status</label>
                <div className="flex gap-2">
                  {WS_STATUSES.map(s => (
                    <button key={s.id} type="button" onClick={() => setWsStatus(s.id)}
                      className={`flex-1 py-2 text-[12px] font-semibold rounded-lg transition-colors ${
                        wsStatus === s.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Extras ── */}
          {step === 3 && (
            <>
              <div>
                <label className={labelCls}>Welcome message</label>
                <textarea rows={3} value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)}
                  placeholder="Shown to new members when they join…"
                  className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>Pinned resource URL</label>
                <input value={pinnedUrl} onChange={e => setPinnedUrl(e.target.value)}
                  placeholder="https://…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pinned resource label</label>
                <input value={pinnedUrlTitle} onChange={e => setPinnedUrlTitle(e.target.value)}
                  placeholder="e.g. Getting started guide" className={inputCls} />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
          <button type="button"
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1 px-3 py-2 text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={15} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button"
              disabled={step === 0 && !name.trim()}
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create workspace'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
