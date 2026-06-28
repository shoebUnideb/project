import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Video, Star, FileText, Lightbulb,
  Users, LayoutGrid, Activity, Bell, ClipboardList, X,
  BookOpen, CheckCircle, UserCircle, Globe, Target, Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApiList, useApi } from '../../hooks/useApi';
import { profilesApi } from '../../api/profiles';
import { ratingsApi } from '../../api/ratings';
import apiClient from '../../api/apiClient';
import { studentCompleteness } from '../../utils/appUtils';
import { relativeTime } from '../../utils/time';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import GettingStartedCard from '../../components/ui/GettingStartedCard';
import ProfileCompletionBanner from '../../components/ui/ProfileCompletionBanner';
import RateMentorModal from '../../components/ui/RateMentorModal';
import BookSessionModal from '../../components/sessions/BookSessionModal';
import SessionsCard from '../../components/sessions/SessionsCard';
import CalendarCard from '../../components/ui/CalendarCard';
import type { SubmissionStatus } from '../../types';

interface NotifItem {
  id: number; type: string; title: string; body: string;
  link: string; is_read: boolean; created_at: string;
}

interface TaskSubmissionItem {
  id: number;
  task_id: number;
  task_title: string;
  workspace_name: string;
  workspace_slug: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  due_date: string | null;
}

type ResourceKey = 'guide' | 'profile' | 'community';

const RESOURCES: { key: ResourceKey; icon: React.ReactNode; label: string; desc: string }[] = [
  { key: 'guide',     icon: <FileText size={14} className="text-primary-500" />,  label: 'Guide',        desc: 'Step-by-step guide for your journey' },
  { key: 'profile',   icon: <Lightbulb size={14} className="text-violet-500" />,  label: 'Profile tips', desc: 'Improve your profile for better opportunities' },
  { key: 'community', icon: <Users size={14} className="text-emerald-500" />,      label: 'Community',    desc: 'Connect with other students and mentors' },
];

const RESOURCE_CONTENT: Record<ResourceKey, { title: string; color: string; sections: { icon: React.ReactNode; heading: string; body: string }[] }> = {
  guide: {
    title: 'Platform Guide',
    color: 'text-primary-600',
    sections: [
      {
        icon: <BookOpen size={16} className="text-primary-500 shrink-0 mt-0.5" />,
        heading: 'Getting started',
        body: 'Once your account is approved, you\'ll be matched with a mentor who will guide you through your study-abroad journey. Head to your Dashboard to see your current tasks, upcoming sessions, and progress at a glance.',
      },
      {
        icon: <Layers size={16} className="text-primary-500 shrink-0 mt-0.5" />,
        heading: 'Workspaces',
        body: 'Your mentor creates Workspaces — focused areas for each programme or project you\'re working on. Inside a workspace you\'ll find tasks to complete, shared resources (files, links, notes), a chat channel, and a community feed.',
      },
      {
        icon: <ClipboardList size={16} className="text-primary-500 shrink-0 mt-0.5" />,
        heading: 'Tasks & submissions',
        body: 'Tasks are the core of your journey. Each task has a description, optional due date, and deliverables checklist. Submit your work directly in the platform — your mentor reviews it and either marks it complete or requests a revision with feedback.',
      },
      {
        icon: <Video size={16} className="text-primary-500 shrink-0 mt-0.5" />,
        heading: 'Sessions',
        body: 'Book 1-on-1 video sessions with your mentor through the Sessions tab. Your mentor sets their availability; you pick a slot that works for you. Session reminders appear on your Calendar.',
      },
      {
        icon: <MessageSquare size={16} className="text-primary-500 shrink-0 mt-0.5" />,
        heading: 'Messaging',
        body: 'Use the Messages section for direct, private conversations with your mentor. Workspace channels are for group discussion with all members. Keep important questions in messages so your mentor can respond at their own pace.',
      },
      {
        icon: <CheckCircle size={16} className="text-primary-500 shrink-0 mt-0.5" />,
        heading: 'Tips for success',
        body: 'Complete your profile fully — mentors and other students can see it. Submit tasks before deadlines, respond to revision requests promptly, and attend your scheduled sessions. The more active you are, the faster you\'ll progress.',
      },
    ],
  },
  profile: {
    title: 'Profile Tips',
    color: 'text-violet-600',
    sections: [
      {
        icon: <UserCircle size={16} className="text-violet-500 shrink-0 mt-0.5" />,
        heading: 'Profile picture & headline',
        body: 'Upload a clear photo and write a short headline that captures who you are and what you\'re working towards (e.g. "Computer Science student | Passionate about product design"). Profiles with photos get far more engagement from mentors and peers.',
      },
      {
        icon: <Target size={16} className="text-violet-500 shrink-0 mt-0.5" />,
        heading: 'Goals & interests',
        body: 'Be specific about what you want to achieve — whether that\'s building a skill, landing an internship, launching a project, or changing careers. Clear goals help your mentor focus their guidance on what matters most to you.',
      },
      {
        icon: <Layers size={16} className="text-violet-500 shrink-0 mt-0.5" />,
        heading: 'Skills & experience',
        body: 'List your current skills and any relevant experience — academic, professional, or personal projects. This gives your mentor a baseline to work from and helps identify the most valuable areas to develop together.',
      },
      {
        icon: <FileText size={16} className="text-violet-500 shrink-0 mt-0.5" />,
        heading: 'Bio & motivations',
        body: 'Write a genuine bio: who you are, what drives you, and why you joined the platform. An honest, specific bio helps your mentor connect with you as an individual and tailor their approach to your personality and working style.',
      },
      {
        icon: <Star size={16} className="text-violet-500 shrink-0 mt-0.5" />,
        heading: 'Links & portfolio',
        body: 'Add links to any work you\'d like to share — a portfolio site, GitHub, LinkedIn, or personal project. Sharing evidence of your work builds credibility and gives your mentor concrete things to give feedback on.',
      },
      {
        icon: <CheckCircle size={16} className="text-violet-500 shrink-0 mt-0.5" />,
        heading: 'Keep it current',
        body: 'Update your profile as you grow — new skills learned, projects completed, milestones hit. An up-to-date profile reflects your progress and keeps your mentor informed without needing a separate conversation.',
      },
    ],
  },
  community: {
    title: 'Community',
    color: 'text-emerald-600',
    sections: [
      {
        icon: <Users size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
        heading: 'The Feed',
        body: 'The Feed is a shared space for everyone on the platform — mentors and mentees. Posts, announcements, tips, and updates appear here. Engage by reacting, commenting, and sharing your own reflections or wins.',
      },
      {
        icon: <Globe size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
        heading: 'Workspace channels',
        body: 'Every workspace has a group chat channel where your mentor posts updates and facilitates discussion. Participating in these channels helps you learn from others in the group and builds a sense of shared progress.',
      },
      {
        icon: <MessageSquare size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
        heading: 'Direct messages',
        body: 'Use direct messages for private, focused conversations with your mentor or fellow mentees. DMs are ideal for follow-up questions after a session, sharing a draft, or anything you\'d rather discuss one-on-one.',
      },
      {
        icon: <Target size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
        heading: 'Directory',
        body: 'Browse the Directory to find other mentees and mentors on the platform. You can view public profiles and send contact requests — a great way to connect with people who share your interests or are on a similar path.',
      },
      {
        icon: <Bell size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
        heading: 'Notifications',
        body: 'Notifications keep you in the loop — task reviews, new messages, workspace posts, and session reminders all appear in the bell menu. Stay on top of them so your momentum with your mentor stays strong.',
      },
      {
        icon: <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
        heading: 'Being a good community member',
        body: 'The more you put in, the more you get back. Share what you\'re learning, celebrate others\' progress, and ask questions openly. A supportive community makes the mentorship experience richer for everyone.',
      },
    ],
  },
};

function ResourceModal({ resourceKey, onClose }: { resourceKey: ResourceKey; onClose: () => void }) {
  const content = RESOURCE_CONTENT[resourceKey];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className={`text-[16px] font-bold ${content.color}`}>{content.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {content.sections.map((s, i) => (
            <div key={i} className="flex gap-3">
              {s.icon}
              <div>
                <p className="text-[13px] font-semibold text-gray-900 mb-0.5">{s.heading}</p>
                <p className="text-[12.5px] text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  in_progress:    { label: 'In progress',   bg: 'bg-primary-100',    text: 'text-primary-700'    },
  submitted:      { label: 'Submitted',      bg: 'bg-amber-100',   text: 'text-amber-700'   },
  resubmitted:    { label: 'Resubmitted',    bg: 'bg-amber-100',   text: 'text-amber-700'   },
  needs_revision: { label: 'Needs revision', bg: 'bg-red-100',     text: 'text-red-700'     },
  completed:      { label: 'Completed',      bg: 'bg-emerald-100', text: 'text-emerald-700' },
  not_started:    { label: 'Not started',    bg: 'bg-gray-100',    text: 'text-gray-600'    },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: myMentor }        = useApi(profilesApi.getMyMentor);
  const { data: myProfile }       = useApi(profilesApi.getStudentProfile);
  const { data: mentorRatings, refetch: refetchRatings } = useApi(
    () => myMentor ? ratingsApi.getSummary(myMentor.id) : Promise.resolve(null),
    [myMentor?.id]
  );
  const { data: notifsData } = useApi<{ results: NotifItem[]; unread: number }>(
    () => apiClient.get('/api/notifications/')
  );
  const { data: myTasks } = useApiList<TaskSubmissionItem>(
    () => apiClient.get<TaskSubmissionItem[]>('/api/my-task-submissions/')
  );

  const [showBooking, setShowBooking] = useState(false);
  const [showRating, setShowRating]   = useState(false);
  const [resourceModal, setResourceModal] = useState<ResourceKey | null>(null);

  const completeness   = myProfile ? studentCompleteness(myProfile) : 0;
  const recentActivity = notifsData?.results?.slice(0, 5) ?? [];
  const firstName      = user?.first_name ?? user?.username ?? 'there';

  const stats = [
    { label: 'In progress',    value: myTasks.filter(t => t.status === 'in_progress').length,    sub: 'Working on it'   },
    { label: 'Submitted',      value: myTasks.filter(t => t.status === 'submitted' || t.status === 'resubmitted').length, sub: 'Awaiting review' },
    { label: 'Needs revision', value: myTasks.filter(t => t.status === 'needs_revision').length, sub: 'Action needed'   },
    { label: 'Completed',      value: myTasks.filter(t => t.status === 'completed').length,      sub: 'Great work!'     },
  ];

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">
            {getGreeting()}, {firstName}!
          </h1>
        </div>
        <Link
          to="/workspaces"
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg transition-colors"
        >
          <LayoutGrid size={14} /> Browse Workspaces
        </Link>
      </div>

      {/* ── Profile completion banner ────────────────────────────── */}
      {myProfile && <ProfileCompletionBanner completeness={completeness} profilePath="/student/profile" />}

      {/* ── Getting started ──────────────────────────────────────── */}
      <div className="mb-5">
        <GettingStartedCard profile={myProfile ?? null} hasMentor={!!myMentor} />
      </div>

      {/* ── My Mentor ────────────────────────────────────────────── */}
      {myMentor && (
        <Card padding="md" className="mb-5 flex items-center gap-4">
          <Avatar name={myMentor.user.first_name || myMentor.user.username} src={myMentor.profile_picture} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Your Mentor</p>
            <p className="text-[15px] font-bold text-gray-900 truncate">
              {myMentor.user.first_name} {myMentor.user.last_name}
            </p>
            {myMentor.expertise && <p className="text-[12.5px] text-gray-500 truncate">{myMentor.expertise}</p>}
            {mentorRatings?.average != null && (
              <div className="flex items-center gap-1 mt-1">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} size={11}
                    className={n <= Math.round(mentorRatings.average!) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                ))}
                <span className="text-[11px] text-gray-400 ml-1">{mentorRatings.average} ({mentorRatings.count})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowRating(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-amber-600 text-[12.5px] font-semibold rounded-lg transition-colors">
              <Star size={13} /> Rate
            </button>
            <button onClick={() => setShowBooking(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[12.5px] font-semibold rounded-lg transition-colors">
              <Video size={13} /> Book session
            </button>
            <button onClick={() => navigate(`/messages/${myMentor.user.id}`)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors">
              <MessageSquare size={13} /> Message
            </button>
          </div>
        </Card>
      )}

      {/* ── Stats + Resources + Recent activity | Calendar ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-6">

        {/* Left: stats + resources + recent activity */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className="bg-white border border-[#e0e0e0] rounded-lg px-4 py-2.5 flex items-center gap-3">
                <p className="text-[22px] font-bold text-gray-900 leading-none">{s.value}</p>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-gray-700 leading-tight truncate">{s.label}</p>
                  <p className="text-[10.5px] text-gray-400 leading-tight">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Resources */}
          <Card padding="md">
            <p className="text-[12.5px] font-bold text-gray-900 mb-3">Resources</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {RESOURCES.map(r => (
                <button key={r.key} onClick={() => setResourceModal(r.key)} className="flex items-start gap-2.5 group text-left">
                  <span className="shrink-0 mt-0.5">{r.icon}</span>
                  <div>
                    <p className="text-[12px] font-semibold text-primary-600 group-hover:underline leading-snug">{r.label}</p>
                    <p className="text-[11px] text-gray-400 leading-snug">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Recent activity — vertical list */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-gray-500" />
                <p className="text-[13px] font-bold text-gray-900">Recent activity</p>
              </div>
            </div>
            {recentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bell size={18} className="text-gray-200 mx-auto mb-2" />
                <p className="text-[12px] text-gray-400">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentActivity.map(item => {
                  const cleanBody = item.body ? stripHtml(item.body) : '';
                  return (
                    <button
                      key={item.id}
                      onClick={() => item.link && navigate(item.link)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 leading-snug line-clamp-1">{item.title}</p>
                        {cleanBody && (
                          <p className="text-[11.5px] text-gray-500 line-clamp-1 mt-0.5">{cleanBody}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime(item.created_at)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: calendar only */}
        <div className="lg:col-span-2">
          <CalendarCard />
        </div>
      </div>


      {/* ── My Tasks ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <ClipboardList size={15} className="text-gray-500" />
            <h2 className="text-[15px] font-bold text-gray-900">My Tasks</h2>
          </div>
          <Link to="/workspaces" className="text-[12px] font-medium text-primary-600 hover:underline">
            Browse workspaces →
          </Link>
        </div>

        {myTasks.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
            <ClipboardList size={22} className="text-gray-300 mx-auto mb-2" />
            <p className="text-[13.5px] font-semibold text-gray-600">No active tasks</p>
            <p className="text-[12px] text-gray-400 mt-1">Join a workspace to start receiving tasks.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#e0e0e0] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_160px_130px_110px] items-center px-4 py-2 border-b border-[#e0e0e0] bg-gray-50 rounded-t-lg">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Task</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Workspace</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Due</span>
            </div>
            {myTasks.map((t, idx) => {
              const sm = STATUS_META[t.status] ?? STATUS_META.not_started;
              return (
                <Link
                  key={t.id}
                  to={`/w/${t.workspace_slug}/tasks/${t.task_id}`}
                  className={`grid grid-cols-[minmax(0,1fr)_160px_130px_110px] items-center px-4 py-2.5 hover:bg-gray-50 transition-colors ${idx !== myTasks.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}
                >
                  <p className="text-[13px] font-semibold text-gray-900 truncate pr-3">{t.task_title}</p>
                  <p className="text-[12px] text-gray-500 truncate pr-3">{t.workspace_name}</p>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${sm.bg} ${sm.text}`}>
                      {sm.label}
                    </span>
                  </div>
                  <span className="text-[11.5px] text-gray-400">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upcoming sessions ────────────────────────────────────── */}
      <SessionsCard role="student" />

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showBooking && myMentor && (
        <BookSessionModal
          mentorId={myMentor.id}
          mentorName={`${myMentor.user.first_name} ${myMentor.user.last_name}`.trim() || myMentor.user.username}
          onClose={() => setShowBooking(false)}
          onBooked={() => setShowBooking(false)}
        />
      )}
      {showRating && myMentor && (
        <RateMentorModal
          mentorId={myMentor.id}
          mentorName={`${myMentor.user.first_name} ${myMentor.user.last_name}`.trim() || myMentor.user.username}
          existingRating={mentorRatings?.my_rating?.rating}
          existingReview={mentorRatings?.my_rating?.review}
          onClose={() => setShowRating(false)}
          onRated={() => { setShowRating(false); refetchRatings(); }}
        />
      )}
      {resourceModal && (
        <ResourceModal resourceKey={resourceModal} onClose={() => setResourceModal(null)} />
      )}
    </>
  );
}
