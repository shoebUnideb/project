import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, ArrowRight,
  Compass, ClipboardList, Users, MessageSquare, BarChart2, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';

const ROLE_HOME: Record<Role, string> = {
  superadmin: '/admin/dashboard',
  mentor:     '/mentor/dashboard',
  student:    '/feed',
};

const QUICK_LOGINS: { label: string; username: string; role: Role }[] = [
  { label: 'Superadmin', username: 'admin',    role: 'superadmin' },
  { label: 'Mentor',     username: 'mentor1',  role: 'mentor'     },
  { label: 'Student',    username: 'student1', role: 'student'    },
];

const FEATURES = [
  { icon: <Compass size={16} />,       title: 'Expert Mentors',    desc: 'Matched to your field and goals' },
  { icon: <ClipboardList size={16} />, title: 'Structured Plans',  desc: 'Tasks, milestones & deadlines' },
  { icon: <Users size={16} />,         title: 'Workspaces',        desc: 'Dedicated space per programme' },
  { icon: <MessageSquare size={16} />, title: 'Direct Chat',       desc: 'Real-time with your mentor' },
  { icon: <BarChart2 size={16} />,     title: 'Track Progress',    desc: 'Grades, points & certificates' },
  { icon: <CheckCircle size={16} />,   title: 'Onboarding Flow',   desc: 'Step-by-step intake support' },
];

const STATS = [
  { value: '500+', label: 'Mentees guided' },
  { value: '50+',  label: 'Expert mentors' },
  { value: '20+',  label: 'Programmes'     },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      navigate(ROLE_HOME[result.role as Role]);
    } else {
      setError(result.error ?? 'Login failed.');
    }
  };

  if (user) {
    navigate(ROLE_HOME[user.role], { replace: true });
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0px) rotate(-2deg)} 50%{transform:translateY(-12px) rotate(2deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0px) rotate(4deg)} 50%{transform:translateY(-8px) rotate(-3deg)} }
        @keyframes floatC { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-16px)} }
        .float-a { animation: floatA 6s ease-in-out infinite; }
        .float-b { animation: floatB 5s ease-in-out infinite; }
        .float-c { animation: floatC 7s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-white flex overflow-hidden">

        {/* ── LEFT: Marketing panel ─────────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50 to-primary-50">

          {/* Background blobs */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary-200/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-violet-200/25 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-100/20 blur-3xl pointer-events-none" />

          {/* Floating decorative cards */}
          <div className="float-a absolute top-12 right-16 bg-white/70 backdrop-blur-md border border-white rounded-2xl px-3.5 py-2.5 shadow-md pointer-events-none">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">New connection</p>
            <p className="text-[13px] font-semibold text-gray-800">Mentor assigned to your workspace</p>
          </div>
          <div className="float-b absolute bottom-36 right-12 bg-white/70 backdrop-blur-md border border-white rounded-2xl px-3.5 py-2.5 shadow-md pointer-events-none" style={{animationDelay:'1.5s'}}>
            <p className="text-[11px] font-bold text-primary-500 uppercase tracking-widest mb-0.5">Milestone reached</p>
            <p className="text-[13px] font-semibold text-gray-800">Application submitted — 100%</p>
          </div>
          <div className="float-c absolute top-52 right-52 bg-white/60 backdrop-blur-md border border-white rounded-2xl px-3 py-2 shadow-sm pointer-events-none" style={{animationDelay:'3s'}}>
            <p className="text-[12px] font-semibold text-gray-700">3 new tasks due this week</p>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">

            {/* Logo */}
            <div className="mb-10">
              <img src="/gile.png" alt="GILE Foundation" className="h-10 w-auto" />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-primary-100 border border-primary-200 text-primary-700 text-[11.5px] font-bold mb-5 tracking-wide">
              End-to-end mentorship platform
            </div>

            {/* Hero headline */}
            <h1 className="text-[38px] xl:text-[46px] font-black text-gray-900 leading-[1.1] mb-4">
              Structured guidance.<br />
              <span className="text-primary-600">Measurable growth.</span>
            </h1>
            <p className="text-[14.5px] text-gray-500 leading-relaxed max-w-md mb-8">
              Connect with expert mentors, manage your goals, track every milestone,
              and turn ambition into achievement — all in one place.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-8">
              {FEATURES.map(f => (
                <div key={f.title}
                  className="bg-white/65 backdrop-blur-md border border-white/80 rounded-2xl p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 mb-2">
                    {f.icon}
                  </div>
                  <p className="text-[12.5px] font-bold text-gray-900 leading-tight">{f.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Bottom row: stats + testimonial */}
            <div className="flex items-end justify-between mt-auto">

              {/* Stats */}
              <div className="flex items-center gap-7">
                {STATS.map((s, i) => (
                  <div key={s.label} className={i > 0 ? 'pl-7 border-l border-gray-200' : ''}>
                    <p className="text-[26px] font-black text-primary-600 leading-none">{s.value}</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Testimonial */}
              <div className="bg-white/75 backdrop-blur-md border border-white/90 rounded-2xl p-4 max-w-[230px] shadow-md">
                <div className="flex gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[12px] text-gray-700 italic leading-snug mb-3">
                  "Having a dedicated workspace and a mentor tracking my progress made all the difference."
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-violet-400 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    S
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-800">Sarah K.</p>
                    <p className="text-[10px] text-gray-400">Mentee, 2025</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── RIGHT: Sign-in form ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col">

          {/* Mobile top bar */}
          <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
            <img src="/gile.png" alt="GILE Foundation" className="h-7 w-auto" />
            <Link to="/signup" className="text-[13px] text-primary-600 font-semibold">
              Create account
            </Link>
          </div>

          {/* Form centered */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="w-full max-w-[360px]">

              <div className="mb-8">
                <h2 className="text-[26px] font-black text-gray-900 mb-1">Sign in</h2>
                <p className="text-[13.5px] text-gray-400">
                  New here?{' '}
                  <Link to="/signup" className="text-primary-600 font-bold hover:underline">
                    Create a free account
                  </Link>
                </p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5 uppercase tracking-widest" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. student1"
                    className="w-full px-4 py-3 text-[14px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white focus:border-transparent placeholder-gray-300 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1.5 uppercase tracking-widest" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-11 text-[14px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white focus:border-transparent placeholder-gray-300 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 text-white text-[14px] font-bold rounded-xl shadow-md shadow-primary-200/60 transition-all flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>Sign in <ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-300 mb-3">
                  Dev quick-login
                </p>
                <div className="flex gap-2 flex-wrap">
                  {QUICK_LOGINS.map(q => (
                    <button
                      key={q.role}
                      onClick={() => { setUsername(q.username); setPassword('any'); }}
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <p className="text-center text-[11px] text-gray-300 pb-6">
            © 2026 GILE Foundation · All rights reserved
          </p>
        </div>

      </div>
    </>
  );
}
