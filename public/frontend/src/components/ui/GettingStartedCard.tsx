import { useState } from 'react';
import { CheckCircle, Circle, X, Rocket, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StudentProfile } from '../../types';

interface Props {
  profile: StudentProfile | null;
  hasMentor: boolean;
}

const DISMISS_KEY = 'onboarding_dismissed';
const RING_R      = 22;
const RING_CIRC   = 2 * Math.PI * RING_R;

export default function GettingStartedCard({ profile, hasMentor }: Props) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  const tasks: { label: string; done: boolean; link?: string }[] = [
    { label: 'Complete your profile (bio + LinkedIn)', done: !!(profile?.bio?.trim() && profile?.linkedin_url?.trim()), link: '/student/profile' },
    { label: 'Add a profile picture',                  done: !!profile?.profile_picture,                                  link: '/student/profile' },
    { label: 'Add your interests & goals',                done: !!(profile?.interests?.trim() && profile?.mentorship_goals?.trim()), link: '/student/profile' },
    { label: 'Get assigned a mentor',                  done: hasMentor },
  ];

  const doneCount  = tasks.filter(t => t.done).length;
  const pct        = Math.round((doneCount / tasks.length) * 100);
  const allDone    = doneCount === tasks.length;
  const dashOffset = RING_CIRC * (1 - pct / 100);

  if (dismissed || allDone) return null;

  return (
    <div className="h-full bg-white border border-[#e0e0e0] rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <Rocket size={14} className="text-primary-600" />
          <h3 className="text-[13.5px] font-bold text-gray-900">Getting started</h3>
          <span className="text-[11px] font-semibold text-white bg-primary-500 rounded-full px-2 py-0.5 leading-none">
            {doneCount} of {tasks.length} completed
          </span>
        </div>
        <button
          onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
          className="text-gray-300 hover:text-gray-500 transition-colors"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body: ring + 2-column checklist */}
      <div className="flex items-start gap-5">
        {/* Progress ring */}
        <div className="shrink-0 relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={RING_R} fill="none" stroke="#e5e7eb" strokeWidth="5.5" />
            <circle
              cx="32" cy="32" r={RING_R} fill="none"
              stroke="rgb(var(--p-600))" strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          </svg>
          <span className="absolute text-[12px] font-bold text-primary-700">{pct}%</span>
        </div>

        {/* 2-column checklist */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {tasks.map(task => (
            <div key={task.label} className="flex items-start gap-2">
              {task.done
                ? <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                : <Circle     size={14} className="text-gray-300 shrink-0 mt-0.5" />}
              {task.link && !task.done ? (
                <Link to={task.link} className="text-[12.5px] text-primary-600 hover:underline leading-snug">
                  {task.label}
                </Link>
              ) : (
                <span className={`text-[12.5px] leading-snug ${task.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {task.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <Link to="/student/profile" className="flex items-center gap-1 text-[12px] font-medium text-primary-600 hover:underline">
          View all steps <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
