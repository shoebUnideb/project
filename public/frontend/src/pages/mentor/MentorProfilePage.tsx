import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Save, Camera, Lock, Unlock, Calendar, Eye, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi, useApiList } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import { profileViewsApi } from '../../api/profileViews';
import type { ProfileViewEntry } from '../../api/profileViews';
import Avatar from '../../components/ui/Avatar';
import ThemePicker from '../../components/ui/ThemePicker';
import FontPicker from '../../components/ui/FontPicker';
import AvailabilityManager from '../../components/sessions/AvailabilityManager';
import SessionsCard from '../../components/sessions/SessionsCard';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">
      {children}
    </h3>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-300 transition bg-white';

export default function MentorProfilePage() {
  const { user, updateSettings, refreshUser } = useAuth();
  const { data: profile, refetch } = useApi(profilesApi.getMentorProfile);
  const { data: students } = useApiList(profilesApi.getMentorStudents);
  const { data: viewers } = useApi(profileViewsApi.getMyViews);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pictureFile, setPictureFile]       = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [bio, setBio]                       = useState('');
  const [headline, setHeadline]             = useState('');
  const [nationality, setNationality]       = useState('');
  const [city, setCity]                     = useState('');
  const [phone, setPhone]                   = useState('');
  const [linkedin, setLinkedin]             = useState('');
  const [github, setGithub]                 = useState('');
  const [website, setWebsite]               = useState('');
  const [currentRole, setCurrentRole]       = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [yearsExp, setYearsExp]             = useState('');
  const [education, setEducation]           = useState('');
  const [languages, setLanguages]           = useState('');
  const [expertise, setExpertise]           = useState('');
  const [mentoringAreas, setMentoringAreas] = useState('');
  const [countriesExp, setCountriesExp]     = useState('');
  const [mentoringStyle, setMentoringStyle] = useState('');
  const [whatIOffer, setWhatIOffer]         = useState('');
  const [domain, setDomain]                 = useState('');
  const [preferredLevel, setPreferredLevel] = useState('');
  const [timezone, setTimezone]             = useState('');
  const [ownDegree, setOwnDegree]           = useState('');
  const [ownField, setOwnField]             = useState('');
  const [ownUniversity, setOwnUniversity]   = useState('');
  const [ownYear, setOwnYear]               = useState('');
  const [saved, setSaved]                   = useState(false);
  const [savingPrivacy, setSavingPrivacy]   = useState(false);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setHeadline(profile.headline ?? '');
    setNationality(profile.nationality ?? '');
    setCity(profile.city ?? '');
    setPhone(profile.phone ?? '');
    setLinkedin(profile.linkedin_url ?? '');
    setGithub(profile.github_url ?? '');
    setWebsite(profile.website_url ?? '');
    setCurrentRole(profile.current_role ?? '');
    setCurrentCompany(profile.current_company ?? '');
    setYearsExp(profile.years_experience ?? '');
    setEducation(profile.education ?? '');
    setLanguages(profile.languages ?? '');
    setExpertise(profile.expertise ?? '');
    setMentoringAreas(profile.mentoring_areas ?? '');
    setCountriesExp(profile.countries_expertise ?? '');
    setMentoringStyle(profile.mentoring_style ?? '');
    setWhatIOffer(profile.what_i_offer ?? '');
    setDomain(profile.domain ?? '');
    setPreferredLevel(profile.preferred_student_level ?? '');
    setTimezone(profile.timezone ?? '');
    setOwnDegree(profile.own_degree ?? '');
    setOwnField(profile.own_field_of_study ?? '');
    setOwnUniversity(profile.own_university ?? '');
    setOwnYear(profile.own_graduation_year ?? '');
  }, [profile]);

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPictureFile(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    if (pictureFile) form.append('profile_picture', pictureFile);
    form.append('bio', bio);
    form.append('headline', headline);
    form.append('nationality', nationality);
    form.append('city', city);
    form.append('phone', phone);
    form.append('linkedin_url', linkedin);
    form.append('github_url', github);
    form.append('website_url', website);
    form.append('current_role', currentRole);
    form.append('current_company', currentCompany);
    form.append('years_experience', yearsExp);
    form.append('education', education);
    form.append('languages', languages);
    form.append('expertise', expertise);
    form.append('mentoring_areas', mentoringAreas);
    form.append('countries_expertise', countriesExp);
    form.append('mentoring_style', mentoringStyle);
    form.append('what_i_offer', whatIOffer);
    form.append('domain', domain);
    form.append('preferred_student_level', preferredLevel);
    form.append('timezone', timezone);
    form.append('own_degree', ownDegree);
    form.append('own_field_of_study', ownField);
    form.append('own_university', ownUniversity);
    form.append('own_graduation_year', ownYear);
    await profilesApi.updateMentorProfile(form);
    await refreshUser();
    setPictureFile(null);
    refetch();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const displayName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || (user?.username ?? '');
  const avatarSrc   = picturePreview ?? profile?.profile_picture;

  return (
    <div className="flex flex-col pb-8">

      {/* Page header */}
      <form onSubmit={handleSave}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">My Profile</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">Your profile is visible to assigned students and connected users.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {saved && (
              <span className="flex items-center gap-1.5 text-[12px] text-green-600 font-medium">
                <CheckCircle size={14} /> Saved
              </span>
            )}
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Save size={14} /> Save changes
            </button>
          </div>
        </div>

        {/* Two-column form grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Identity card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar name={displayName} src={avatarSrc} size="xl" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center shadow-md transition-colors"
                  >
                    <Camera size={13} />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePictureChange} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-gray-900">{displayName}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">@{user?.username} · {user?.email}</p>
                </div>
              </div>
            </div>

            {/* Personal */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Personal</SectionTitle>
              <div className="space-y-3">
                <Field label="Headline">
                  <input type="text" value={headline} onChange={e => setHeadline(e.target.value)}
                    placeholder="e.g. PhD at MIT | ML researcher | 5 yrs in Germany"
                    className={inputCls} maxLength={160} />
                </Field>
                <Field label="Bio">
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)}
                    placeholder="A short introduction about yourself…"
                    className={`${inputCls} resize-none`} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nationality">
                    <input type="text" value={nationality} onChange={e => setNationality(e.target.value)}
                      placeholder="e.g. Egyptian" className={inputCls} />
                  </Field>
                  <Field label="City / Location">
                    <input type="text" value={city} onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Berlin, Germany" className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Contact & Links */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Contact &amp; Links</SectionTitle>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+43 699 000 0000" className={inputCls} />
                  </Field>
                  <Field label="LinkedIn">
                    <input type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/…" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GitHub">
                    <input type="url" value={github} onChange={e => setGithub(e.target.value)}
                      placeholder="https://github.com/…" className={inputCls} />
                  </Field>
                  <Field label="Website / Portfolio">
                    <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                      placeholder="https://yoursite.com" className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Messaging Privacy */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Messaging Privacy</SectionTitle>
              <p className="text-[12px] text-gray-400 -mt-1 mb-3">Control who can send you messages.</p>
              <div className="space-y-2">
                {[
                  { value: 'open', icon: <Unlock size={14} />, label: 'Anyone can message me', desc: 'Other users can send you messages directly without needing approval.' },
                  { value: 'request_required', icon: <Lock size={14} />, label: 'Contact request required', desc: 'Others must send a contact request first. You approve before they can message you.' },
                ].map(opt => (
                  <label key={opt.value} className={[
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    user?.message_permission === opt.value
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300',
                  ].join(' ')}>
                    <input
                      type="radio" name="message_permission" value={opt.value}
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

            {/* Academic Background */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Academic Background</SectionTitle>
              <p className="text-[12px] text-gray-400 -mt-1 mb-3">Your own degrees and qualifications.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Degree">
                    <input type="text" value={ownDegree} onChange={e => setOwnDegree(e.target.value)}
                      placeholder="e.g. MSc, PhD, BSc, MBA" className={inputCls} />
                  </Field>
                  <Field label="Field of Study">
                    <input type="text" value={ownField} onChange={e => setOwnField(e.target.value)}
                      placeholder="e.g. Computer Science" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="University / Institution">
                    <input type="text" value={ownUniversity} onChange={e => setOwnUniversity(e.target.value)}
                      placeholder="e.g. TU Berlin" className={inputCls} />
                  </Field>
                  <Field label="Graduation Year">
                    <input type="text" maxLength={4} value={ownYear} onChange={e => setOwnYear(e.target.value)}
                      placeholder="e.g. 2020" className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Domain & Matching */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Domain &amp; Matching</SectionTitle>
              <div className="space-y-3">
                <Field label="Field / Domain">
                  <select value={domain} onChange={e => setDomain(e.target.value)}
                    className={inputCls}>
                    <option value="">Select a domain…</option>
                    <option value="stem">STEM</option>
                    <option value="business">Business &amp; Economics</option>
                    <option value="humanities">Humanities</option>
                    <option value="medicine">Medicine &amp; Health Sciences</option>
                    <option value="law">Law</option>
                    <option value="arts">Arts &amp; Design</option>
                    <option value="social_sciences">Social Sciences</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Preferred Student Level">
                  <select value={preferredLevel} onChange={e => setPreferredLevel(e.target.value)}
                    className={inputCls}>
                    <option value="">Select a level…</option>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="masters">Master's</option>
                    <option value="phd">PhD</option>
                    <option value="any">Any level</option>
                  </select>
                </Field>
                <Field label="Timezone">
                  <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
                    placeholder="e.g. Europe/Berlin, UTC+2" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Professional Background */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Professional Background</SectionTitle>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Current Role">
                    <input type="text" value={currentRole} onChange={e => setCurrentRole(e.target.value)}
                      placeholder="e.g. Software Engineer" className={inputCls} />
                  </Field>
                  <Field label="Company / Organisation">
                    <input type="text" value={currentCompany} onChange={e => setCurrentCompany(e.target.value)}
                      placeholder="e.g. Google" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Years of Experience">
                    <input type="text" value={yearsExp} onChange={e => setYearsExp(e.target.value)}
                      placeholder="e.g. 5" className={inputCls} />
                  </Field>
                  <Field label="Languages Spoken">
                    <input type="text" value={languages} onChange={e => setLanguages(e.target.value)}
                      placeholder="e.g. English, Arabic, German" className={inputCls} />
                  </Field>
                </div>
                <Field label="Education">
                  <input type="text" value={education} onChange={e => setEducation(e.target.value)}
                    placeholder="e.g. MSc Computer Science, TU Berlin" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Expertise & Focus */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Subject Areas &amp; Focus</SectionTitle>
              <div className="space-y-3">
                <Field label="Subject Areas">
                  <input type="text" value={expertise} onChange={e => setExpertise(e.target.value)}
                    placeholder="e.g. Machine Learning, Python, NLP (comma-separated)"
                    className={inputCls} />
                </Field>
                <Field label="Mentoring Areas">
                  <input type="text" value={mentoringAreas} onChange={e => setMentoringAreas(e.target.value)}
                    placeholder="e.g. SOP writing, Visa process, University selection"
                    className={inputCls} />
                </Field>
                <Field label="Countries I Know Well">
                  <input type="text" value={countriesExp} onChange={e => setCountriesExp(e.target.value)}
                    placeholder="e.g. Germany, Austria, Netherlands"
                    className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Mentoring Approach */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Mentoring Approach</SectionTitle>
              <div className="space-y-3">
                <Field label="My Mentoring Style">
                  <textarea rows={3} value={mentoringStyle} onChange={e => setMentoringStyle(e.target.value)}
                    placeholder="How do you typically work with mentees? E.g. structured sessions, availability, communication style…"
                    className={`${inputCls} resize-none`} />
                </Field>
                <Field label="What I Offer">
                  <textarea rows={3} value={whatIOffer} onChange={e => setWhatIOffer(e.target.value)}
                    placeholder="What specific help can mentees expect from you? E.g. SOP reviews, mock interviews, university shortlisting…"
                    className={`${inputCls} resize-none`} />
                </Field>
              </div>
            </div>

          </div>
        </div>
      </form>

      {/* ── Below form: sessions, availability, students, viewers ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 mt-4">

        <div className="space-y-4">
          <SessionsCard role="mentor" />

          {students.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">
                Assigned Students ({students.length})
              </p>
              <div className="space-y-2">
                {students.map(sp => (
                  <Link key={sp.id} to={`/mentor/students/${sp.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Avatar name={`${sp.user.first_name} ${sp.user.last_name}`} src={sp.profile_picture} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800">{sp.user.first_name} {sp.user.last_name}</p>
                      <p className="text-[11px] text-gray-400">@{sp.user.username}</p>
                    </div>
                    <span className="text-[11px] text-primary-600 shrink-0">View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <Calendar size={13} className="text-primary-500" />
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400">My Availability</p>
            </div>
            <AvailabilityManager />
          </div>

          {viewers && (viewers as ProfileViewEntry[]).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <Eye size={13} className="text-primary-500" />
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400">Who Viewed You</p>
                <span className="text-[11px] text-gray-400">({(viewers as ProfileViewEntry[]).length})</span>
              </div>
              <div className="space-y-2">
                {(viewers as ProfileViewEntry[]).slice(0, 8).map(v => (
                  <div key={v.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-[11px] font-bold flex items-center justify-center uppercase shrink-0">
                      {(v.first_name || v.username)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-gray-800 truncate">
                        {v.first_name && v.last_name ? `${v.first_name} ${v.last_name}` : v.username}
                      </p>
                      <p className="text-[11px] text-gray-400 capitalize">{v.role}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {new Date(v.viewed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
