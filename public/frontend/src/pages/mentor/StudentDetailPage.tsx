import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Linkedin, Github, Globe, Phone, Mail,
  MapPin, GraduationCap, Target, Languages, Wrench,
  Heart, AlertCircle,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import Avatar from '../../components/ui/Avatar';

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

function Tag({ text }: { text: string }) {
  return (
    <span className="px-2.5 py-1 bg-primary-50 text-primary-700 text-[11.5px] font-medium rounded-lg">{text.trim()}</span>
  );
}

function TagList({ value }: { value?: string | null }) {
  if (!value) return null;
  const items = value.split(',').map(s => s.trim()).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(t => <Tag key={t} text={t} />)}
    </div>
  );
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { data: profile, loading } = useApi(
    () => profilesApi.getMentorStudentDetail(Number(studentId)),
    [studentId]
  );

  if (loading) return <p className="text-gray-400 text-center py-20">Loading…</p>;
  if (!profile) return <div className="text-gray-400 text-center py-20">Student not found.</div>;

  const studentName = `${profile.user.first_name} ${profile.user.last_name}`.trim() || profile.user.username;

  return (
    <div className="max-w-3xl">
      <Link to="/mentor/dashboard"
        className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-800 mb-5">
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      <PageHeader
        title={studentName}
        subtitle="Student profile"
      />

      {/* Identity card */}
      <Card className="mb-5" padding="lg">
        <div className="flex items-start gap-5">
          <Avatar name={studentName} src={profile.profile_picture} size="xl" />
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-gray-900">{studentName}</h2>
            {profile.headline && (
              <p className="text-[13px] text-primary-600 font-medium mt-0.5">{profile.headline}</p>
            )}
            {profile.pronouns && (
              <p className="text-[11.5px] text-gray-400 mt-0.5">{profile.pronouns}</p>
            )}
            {profile.bio && (
              <p className="text-[13px] text-gray-600 leading-relaxed mt-3">{profile.bio}</p>
            )}
            {/* Contact links */}
            <div className="flex flex-wrap gap-3 mt-3 text-[12px]">
              <a href={`mailto:${profile.user.email}`} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800">
                <Mail size={12} />{profile.user.email}
              </a>
              {profile.phone && (
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Phone size={12} />{profile.phone}
                </span>
              )}
              {profile.city && (
                <span className="flex items-center gap-1.5 text-gray-500">
                  <MapPin size={12} />{profile.city}
                </span>
              )}
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Linkedin size={12} />LinkedIn
                </a>
              )}
              {profile.github_url && (
                <a href={profile.github_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Github size={12} />GitHub
                </a>
              )}
              {profile.portfolio_url && (
                <a href={profile.portfolio_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary-600 hover:underline">
                  <Globe size={12} />Portfolio
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Academic / Professional */}
        <Card padding="lg">
          <SectionTitle icon={<GraduationCap size={14} />}>Academic &amp; Professional</SectionTitle>
          <div className="space-y-3">
            <InfoRow label="Career Stage" value={profile.career_stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
            <InfoRow label="University" value={profile.university} />
            <InfoRow label="Field of Study" value={profile.field_of_study} />
            <InfoRow label="Graduation Year" value={profile.graduation_year} />
            {profile.date_of_birth && (
              <InfoRow label="Date of Birth" value={new Date(profile.date_of_birth).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })} />
            )}
          </div>
        </Card>

        {/* Skills & Interests */}
        <Card padding="lg">
          <SectionTitle icon={<Target size={14} />}>Skills &amp; Interests</SectionTitle>
          <div className="space-y-4">
            {profile.skills && (
              <div>
                <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Wrench size={11} /> Skills
                </p>
                <TagList value={profile.skills} />
              </div>
            )}
            {profile.interests && (
              <div>
                <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Interests</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{profile.interests}</p>
              </div>
            )}
            {profile.hobbies && (
              <div>
                <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Hobbies</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{profile.hobbies}</p>
              </div>
            )}
            {!profile.skills && !profile.interests && !profile.hobbies && (
              <p className="text-[13px] text-gray-400">Not filled in yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Mentee introduction */}
      {(profile.mentorship_goals || profile.background_experience || profile.mentor_expectations) && (
        <Card className="mb-5" padding="lg">
          <SectionTitle icon={<Heart size={14} />}>Mentee Introduction</SectionTitle>
          <div className="space-y-5">
            {profile.mentorship_goals && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What they hope to achieve</p>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{profile.mentorship_goals}</p>
              </div>
            )}
            {profile.background_experience && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Background &amp; experience</p>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{profile.background_experience}</p>
              </div>
            )}
            {profile.mentor_expectations && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What they look for in a mentor</p>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{profile.mentor_expectations}</p>
              </div>
            )}
          </div>
        </Card>
      )}

    </div>
  );
}
