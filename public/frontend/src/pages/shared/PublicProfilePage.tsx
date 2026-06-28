import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Linkedin, Github, Globe,
  GraduationCap, Target, Languages, Wrench, Heart, AlertCircle,
  Briefcase, BookOpen, Star, User,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import { profileViewsApi } from '../../api/profileViews';
import type { StudentProfile, MentorProfile } from '../../types';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import PageHeader from '../../components/ui/PageHeader';

const DOMAIN_LABELS: Record<string, string> = {
  stem: 'STEM',
  business: 'Business & Economics',
  humanities: 'Humanities',
  medicine: 'Medicine & Health Sciences',
  law: 'Law',
  arts: 'Arts & Design',
  social_sciences: 'Social Sciences',
  other: 'Other',
};

const LEVEL_LABELS: Record<string, string> = {
  undergraduate: 'Undergraduate',
  masters: "Master's",
  phd: 'PhD',
  any: 'Any level',
};

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && <span className="text-primary-400">{icon}</span>}
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{children}</h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-[13.5px] text-gray-800">{value}</p>
    </div>
  );
}

function TagList({ value }: { value?: string | null }) {
  if (!value) return null;
  const items = value.split(',').map(s => s.trim()).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(t => (
        <span key={t} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-[11.5px] font-medium rounded-lg">{t}</span>
      ))}
    </div>
  );
}

function isStudentProfile(p: StudentProfile | MentorProfile): p is StudentProfile {
  return 'university' in p || 'mentorship_goals' in p;
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const uid = Number(userId);

  const { data: profile, loading, error } = useApi(() => {
    profileViewsApi.record(uid).catch(() => {});
    return profilesApi.getPublicProfile(uid);
  }, [uid]);

  if (loading) return <p className="text-gray-400 text-center py-20">Loading…</p>;
  if (error || !profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-[14px] mb-3">Profile not available.</p>
        <p className="text-gray-400 text-[12px]">You need to be connected to view this profile.</p>
      </div>
    );
  }

  const isStudent = isStudentProfile(profile);
  const sp = isStudent ? (profile as StudentProfile) : null;
  const mp = isStudent ? null : (profile as MentorProfile);
  const displayName = `${profile.user.first_name} ${profile.user.last_name}`.trim() || profile.user.username;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <PageHeader
        title={displayName}
        subtitle={profile.user.role === 'student' ? 'Student profile' : 'Mentor profile'}
      />

      {/* Identity card */}
      <Card className="mb-5" padding="lg">
        <div className="flex items-start gap-5">
          <Avatar name={displayName} src={profile.profile_picture} size="2xl" />
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-gray-900">{displayName}</h2>
            {sp?.headline && <p className="text-[13px] text-primary-600 font-medium mt-0.5">{sp.headline}</p>}
            {sp?.pronouns && <p className="text-[11.5px] text-gray-400 mt-0.5">{sp.pronouns}</p>}
            {mp?.headline && <p className="text-[13px] text-primary-600 font-medium mt-0.5">{mp.headline}</p>}
            {profile.bio && (
              <p className="text-[13px] text-gray-600 leading-relaxed mt-3">{profile.bio}</p>
            )}

            {/* Contact & links */}
            <div className="flex flex-wrap gap-3 mt-3 text-[12px]">
              <a href={`mailto:${profile.user.email}`} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800">
                <Mail size={12} />{profile.user.email}
              </a>
              {profile.phone && (
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Phone size={12} />{profile.phone}
                </span>
              )}
              {(sp?.city || mp?.city) && (
                <span className="flex items-center gap-1.5 text-gray-500">
                  <MapPin size={12} />{sp?.city ?? mp?.city}
                </span>
              )}
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Linkedin size={12} />LinkedIn
                </a>
              )}
              {(sp?.github_url || mp?.github_url) && (
                <a href={sp?.github_url ?? mp?.github_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Github size={12} />GitHub
                </a>
              )}
              {sp?.portfolio_url && (
                <a href={sp.portfolio_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Globe size={12} />Portfolio
                </a>
              )}
              {mp?.website_url && (
                <a href={mp.website_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Globe size={12} />Website
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Student-specific sections */}
      {sp && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* Academic */}
            {(sp.university || sp.field_of_study || sp.graduation_year || sp.career_stage) && (
              <Card padding="lg">
                <SectionTitle icon={<GraduationCap size={14} />}>Academic &amp; Professional</SectionTitle>
                <div className="space-y-3">
                  {sp.career_stage && <InfoRow label="Career Stage" value={sp.career_stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />}
                  <InfoRow label="University" value={sp.university} />
                  <InfoRow label="Field of Study" value={sp.field_of_study} />
                  <InfoRow label="Graduation Year" value={sp.graduation_year} />
                </div>
              </Card>
            )}

            {/* Skills & Interests */}
            {(sp.skills || sp.interests || sp.hobbies) && (
              <Card padding="lg">
                <SectionTitle icon={<Target size={14} />}>Skills &amp; Interests</SectionTitle>
                <div className="space-y-3">
                  {sp.skills && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Wrench size={11} /> Skills
                      </p>
                      <TagList value={sp.skills} />
                    </div>
                  )}
                  {sp.interests && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Interests</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{sp.interests}</p>
                    </div>
                  )}
                  {sp.hobbies && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Hobbies</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{sp.hobbies}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Mentee intro */}
          {(sp.mentorship_goals || sp.background_experience || sp.mentor_expectations) && (
            <Card className="mb-5" padding="lg">
              <SectionTitle icon={<Heart size={14} />}>Mentee Introduction</SectionTitle>
              <div className="space-y-5">
                {sp.mentorship_goals && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What they hope to achieve</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{sp.mentorship_goals}</p>
                  </div>
                )}
                {sp.background_experience && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Background &amp; experience</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{sp.background_experience}</p>
                  </div>
                )}
                {sp.mentor_expectations && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What they look for in a mentor</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{sp.mentor_expectations}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Mentor-specific sections */}
      {mp && (
        <>
          {/* Academic Background */}
          {(mp.own_degree || mp.own_university || mp.own_field_of_study) && (
            <Card className="mb-5" padding="lg">
              <SectionTitle icon={<GraduationCap size={14} />}>Academic Background</SectionTitle>
              <div className="space-y-1">
                {mp.own_degree && (
                  <p className="text-[13.5px] font-semibold text-gray-800">
                    {mp.own_degree}{mp.own_field_of_study ? ` in ${mp.own_field_of_study}` : ''}
                  </p>
                )}
                {mp.own_university && (
                  <p className="text-[13px] text-gray-600">{mp.own_university}{mp.own_graduation_year ? ` · ${mp.own_graduation_year}` : ''}</p>
                )}
              </div>
            </Card>
          )}

          {(mp.current_role || mp.current_company || mp.years_experience || mp.education || mp.nationality) && (
            <Card className="mb-5" padding="lg">
              <SectionTitle icon={<Briefcase size={14} />}>Professional Background</SectionTitle>
              <div className="space-y-3">
                {(mp.current_role || mp.current_company) && (
                  <InfoRow
                    label="Role"
                    value={[mp.current_role, mp.current_company].filter(Boolean).join(' @ ')}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Experience" value={mp.years_experience ? `${mp.years_experience} years` : undefined} />
                  <InfoRow label="Nationality" value={mp.nationality} />
                </div>
                <InfoRow label="Education" value={mp.education} />
                {mp.languages && (
                  <div>
                    <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Languages size={11} /> Languages
                    </p>
                    <TagList value={mp.languages} />
                  </div>
                )}
              </div>
            </Card>
          )}

          {(mp.domain || mp.preferred_student_level || mp.timezone) && (
            <Card className="mb-5" padding="lg">
              <SectionTitle icon={<Wrench size={14} />}>Domain &amp; Availability</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {mp.domain && (
                  <span className="px-3 py-1 bg-primary-50 text-primary-700 text-[12px] font-semibold rounded-full border border-primary-200">
                    {DOMAIN_LABELS[mp.domain] ?? mp.domain}
                  </span>
                )}
                {mp.preferred_student_level && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-[12px] font-semibold rounded-full border border-gray-200">
                    {LEVEL_LABELS[mp.preferred_student_level] ?? mp.preferred_student_level}
                  </span>
                )}
                {mp.timezone && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[12px] rounded-full border border-gray-200">
                    🕐 {mp.timezone}
                  </span>
                )}
              </div>
            </Card>
          )}

          {(mp.expertise || mp.mentoring_areas || mp.countries_expertise) && (
            <Card className="mb-5" padding="lg">
              <SectionTitle icon={<Wrench size={14} />}>Subject Areas &amp; Focus</SectionTitle>
              <div className="space-y-3">
                {mp.expertise && (
                  <div>
                    <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Subject Areas</p>
                    <TagList value={mp.expertise} />
                  </div>
                )}
                {mp.mentoring_areas && (
                  <div>
                    <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What I Help With</p>
                    <TagList value={mp.mentoring_areas} />
                  </div>
                )}
                {mp.countries_expertise && (
                  <div>
                    <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Countries They Know</p>
                    <TagList value={mp.countries_expertise} />
                  </div>
                )}
              </div>
            </Card>
          )}

          {(mp.mentoring_style || mp.what_i_offer) && (
            <Card className="mb-5" padding="lg">
              <SectionTitle icon={<Heart size={14} />}>Mentoring Approach</SectionTitle>
              <div className="space-y-5">
                {mp.mentoring_style && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Mentoring style</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{mp.mentoring_style}</p>
                  </div>
                )}
                {mp.what_i_offer && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What I offer</p>
                    <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{mp.what_i_offer}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
