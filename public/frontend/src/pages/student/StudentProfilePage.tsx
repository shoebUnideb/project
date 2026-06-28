import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import Avatar from '../../components/ui/Avatar';
import ThemePicker from '../../components/ui/ThemePicker';
import FontPicker from '../../components/ui/FontPicker';
import { Camera, Save, CheckCircle, Lock, Unlock } from 'lucide-react';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100">
      {children}
    </h3>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-300 transition bg-white';

export default function StudentProfilePage() {
  const { user, updateSettings, refreshUser } = useAuth();
  const { data: profile, refetch } = useApi(profilesApi.getStudentProfile);
  const picInputRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [picFile, setPicFile]       = useState<File | null>(null);

  const [form, setForm] = useState({
    bio: '', headline: '', pronouns: '',
    phone: '', linkedin_url: '', github_url: '', portfolio_url: '',
    city: '', date_of_birth: '',
    university: '', field_of_study: '', graduation_year: '', career_stage: '',
    skills: '', interests: '', hobbies: '',
    mentorship_goals: '', background_experience: '', mentor_expectations: '',
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      bio:                     profile.bio ?? '',
      headline:                profile.headline ?? '',
      pronouns:                profile.pronouns ?? '',
      phone:                   profile.phone ?? '',
      linkedin_url:            profile.linkedin_url ?? '',
      github_url:              profile.github_url ?? '',
      portfolio_url:           profile.portfolio_url ?? '',
      city:                    profile.city ?? '',
      date_of_birth:           profile.date_of_birth ?? '',
      university:              profile.university ?? '',
      field_of_study:          profile.field_of_study ?? '',
      graduation_year:         profile.graduation_year ?? '',
      career_stage:            profile.career_stage ?? '',
      skills:                  profile.skills ?? '',
      interests:               profile.interests ?? '',
      hobbies:                 profile.hobbies ?? '',
      mentorship_goals:        profile.mentorship_goals ?? '',
      background_experience:   profile.background_experience ?? '',
      mentor_expectations:     profile.mentor_expectations ?? '',
    });
  }, [profile]);

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handlePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPicFile(file);
    setPicPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    if (picFile) data.append('profile_picture', picFile);
    await profilesApi.updateStudentProfile(data);
    await refetch();
    await refreshUser();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const avatarName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || '';
  const avatarSrc  = picPreview ?? profile?.profile_picture ?? undefined;

  return (
    <form onSubmit={handleSave} className="h-full flex flex-col">

      {/* Page header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">My Profile</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Complete your profile so your mentor can get to know you better.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-[12px] text-green-600 font-medium">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 flex-1 pb-6">

        {/* ── Left column ── */}
        <div className="space-y-4">

          {/* Avatar + identity */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar name={avatarName} src={avatarSrc} size="xl" />
                <button
                  type="button"
                  onClick={() => picInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center shadow hover:bg-primary-700 transition-colors"
                >
                  <Camera size={13} />
                </button>
                <input ref={picInputRef} type="file" accept="image/*" className="hidden" onChange={handlePicChange} />
              </div>
              <div>
                <p className="text-[16px] font-bold text-gray-900">{user?.first_name} {user?.last_name}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">@{user?.username} · {user?.email}</p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Personal Information</SectionTitle>
            <div className="space-y-3">
              <Field label="Headline" hint="One line — e.g. CS student aiming for MSc in AI">
                <input type="text" maxLength={120} value={form.headline} onChange={set('headline')}
                  placeholder="e.g. CS student aiming for MSc in AI" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Pronouns" hint="e.g. she/her, they/them">
                  <input type="text" maxLength={50} value={form.pronouns} onChange={set('pronouns')}
                    placeholder="she/her" className={inputCls} />
                </Field>
                <Field label="City">
                  <input type="text" value={form.city} onChange={set('city')}
                    placeholder="Vienna" className={inputCls} />
                </Field>
              </div>
              <Field label="Bio" hint="Tell your mentor a bit about yourself">
                <textarea rows={3} value={form.bio} onChange={set('bio')}
                  placeholder="A short introduction about yourself..."
                  className={inputCls + ' resize-none'} />
              </Field>
            </div>
          </div>

          {/* Contact & Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Contact &amp; Links</SectionTitle>
            <div className="space-y-3">
              <Field label="Phone">
                <input type="tel" value={form.phone} onChange={set('phone')}
                  placeholder="+43 699 000 0000" className={inputCls} />
              </Field>
              <Field label="LinkedIn">
                <input type="url" value={form.linkedin_url} onChange={set('linkedin_url')}
                  placeholder="https://linkedin.com/in/yourname" className={inputCls} />
              </Field>
              <Field label="GitHub">
                <input type="url" value={form.github_url} onChange={set('github_url')}
                  placeholder="https://github.com/yourname" className={inputCls} />
              </Field>
              <Field label="Portfolio / Personal website">
                <input type="url" value={form.portfolio_url} onChange={set('portfolio_url')}
                  placeholder="https://yoursite.com" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Messaging Privacy */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Messaging Privacy</SectionTitle>
            <p className="text-[12px] text-gray-400 -mt-2 mb-4">Control who can send you messages.</p>
            <div className="space-y-2">
              {[
                { value: 'open', icon: <Unlock size={14} />, label: 'Anyone can message me', desc: 'Other users can send you messages directly without needing approval.' },
                { value: 'request_required', icon: <Lock size={14} />, label: 'Contact request required', desc: 'Others must send a contact request first. You approve before they can message you.' },
              ].map(opt => (
                <label key={opt.value} className={[
                  'flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors',
                  user?.message_permission === opt.value
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}>
                  <input
                    type="radio"
                    name="message_permission"
                    value={opt.value}
                    checked={user?.message_permission === opt.value}
                    disabled={savingPrivacy}
                    onChange={async () => {
                      setSavingPrivacy(true);
                      try { await updateSettings({ message_permission: opt.value }); }
                      finally { setSavingPrivacy(false); }
                    }}
                    className="mt-0.5 accent-primary-600"
                  />
                  <span className={`mt-0.5 ${user?.message_permission === opt.value ? 'text-primary-600' : 'text-gray-400'}`}>{opt.icon}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-[11.5px] text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {savingPrivacy && <p className="text-[11px] text-gray-400 mt-2">Saving…</p>}
          </div>

          {/* Theme Color */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Appearance</SectionTitle>
            <ThemePicker />
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-5 mb-2">Font</p>
            <FontPicker />
          </div>

        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Academic / Professional */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Academic &amp; Professional</SectionTitle>
            <div className="space-y-3">
              <Field label="Career stage">
                <select value={form.career_stage} onChange={e => setForm(p => ({ ...p, career_stage: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select…</option>
                  <option value="high_school">High school student</option>
                  <option value="undergraduate">Undergraduate student</option>
                  <option value="postgraduate">Postgraduate student</option>
                  <option value="early_career">Early career (0–3 years)</option>
                  <option value="mid_career">Mid career (3–10 years)</option>
                  <option value="career_changer">Career changer</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="University / Institution">
                  <input type="text" value={form.university} onChange={set('university')}
                    placeholder="e.g. TU Wien" className={inputCls} />
                </Field>
                <Field label="Field of Study">
                  <input type="text" value={form.field_of_study} onChange={set('field_of_study')}
                    placeholder="e.g. Computer Science" className={inputCls} />
                </Field>
                <Field label="Graduation Year">
                  <input type="text" maxLength={4} value={form.graduation_year} onChange={set('graduation_year')}
                    placeholder="2026" className={inputCls} />
                </Field>
              </div>
              <Field label="Skills" hint="Comma-separated, e.g. Python, public speaking, design">
                <input type="text" value={form.skills} onChange={set('skills')}
                  placeholder="Python, React, data analysis" className={inputCls} />
              </Field>
            </div>
          </div>

          {/* Interests & Hobbies */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Interests &amp; Hobbies</SectionTitle>
            <div className="space-y-3">
              <Field label="Interests" hint="Topics, fields, or causes you care about">
                <textarea rows={2} value={form.interests} onChange={set('interests')}
                  placeholder="e.g. sustainability, entrepreneurship, machine learning, education"
                  className={inputCls + ' resize-none'} />
              </Field>
              <Field label="Hobbies" hint="What you enjoy outside of work or study">
                <textarea rows={2} value={form.hobbies} onChange={set('hobbies')}
                  placeholder="e.g. hiking, photography, playing guitar, cooking"
                  className={inputCls + ' resize-none'} />
              </Field>
            </div>
          </div>

          {/* Mentee Introduction */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Mentee Introduction</SectionTitle>
            <p className="text-[12px] text-gray-400 -mt-2 mb-4">Visible to your mentor and programme coordinators.</p>
            <div className="space-y-3">
              <Field label="What are you hoping to achieve through mentorship?" hint="Optional · max 1000 characters">
                <textarea rows={4} maxLength={1000} value={form.mentorship_goals} onChange={set('mentorship_goals')}
                  placeholder="I want to improve my chances of admission to top European MSc programmes by..."
                  className={inputCls + ' resize-none'} />
                <p className="text-right text-[11px] text-gray-400 mt-1">{form.mentorship_goals.length}/1000</p>
              </Field>
              <Field label="Your background / experience level" hint="Optional · max 500 characters">
                <textarea rows={3} maxLength={500} value={form.background_experience} onChange={set('background_experience')}
                  placeholder="I have completed 2 years of my BSc and have experience in..."
                  className={inputCls + ' resize-none'} />
                <p className="text-right text-[11px] text-gray-400 mt-1">{form.background_experience.length}/500</p>
              </Field>
              <Field label="What are you looking for in a mentor?" hint="Optional · max 500 characters">
                <textarea rows={3} maxLength={500} value={form.mentor_expectations} onChange={set('mentor_expectations')}
                  placeholder="I'm looking for someone who can guide me on application essays and..."
                  className={inputCls + ' resize-none'} />
                <p className="text-right text-[11px] text-gray-400 mt-1">{form.mentor_expectations.length}/500</p>
              </Field>
            </div>
          </div>

        </div>
      </div>
    </form>
  );
}
