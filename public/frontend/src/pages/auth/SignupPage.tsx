import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, ArrowRight,
  Target, TrendingUp, Users, MessageSquare, CheckCircle, Award,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  { icon: <Target size={15} />,      title: 'Set your goals',      desc: 'Define what you want to achieve' },
  { icon: <Users size={15} />,       title: 'Get matched',         desc: 'Paired with the right mentor' },
  { icon: <CheckCircle size={15} />, title: 'Follow a plan',       desc: 'Tasks, milestones & deadlines' },
  { icon: <MessageSquare size={15}/>, title: 'Stay connected',     desc: 'Chat directly with your mentor' },
  { icon: <TrendingUp size={15} />,  title: 'Track progress',      desc: 'See your growth in real time' },
  { icon: <Award size={15} />,       title: 'Earn recognition',    desc: 'Certificates on completion' },
];

export default function SignupPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: '', last_name: '',
    username: '', email: '',
    password: '', password2: '',
  });
  const [showPw, setShowPw]   = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/workspaces', { replace: true });
    return null;
  }

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const flattenError = (v: string | string[]): string =>
    Array.isArray(v) ? v[0] : v;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.ok) {
      navigate('/workspaces', { replace: true });
    } else {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.errors ?? {})) {
        flat[k] = flattenError(v);
      }
      setErrors(flat);
    }
  };

  const inputCls = (field?: string) =>
    `w-full px-4 py-2.5 text-[13.5px] bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:bg-white focus:border-transparent placeholder-gray-300 transition-all ${
      field && errors[field] ? 'border-red-300 focus:ring-red-400' : 'border-gray-200'
    }`;

  return (
    <>
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0px) rotate(-2deg)} 50%{transform:translateY(-12px) rotate(2deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0px) rotate(4deg)} 50%{transform:translateY(-8px) rotate(-3deg)} }
        @keyframes floatC { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-14px)} }
        .float-a { animation: floatA 6s ease-in-out infinite; }
        .float-b { animation: floatB 5s ease-in-out infinite; }
        .float-c { animation: floatC 7s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-white flex overflow-hidden">

        {/* ── LEFT: Marketing panel ───────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50 to-primary-50">

          {/* Background blobs */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary-200/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-violet-200/25 blur-3xl pointer-events-none" />

          {/* Floating notification cards */}
          <div className="float-a absolute top-12 right-14 bg-white/70 backdrop-blur-md border border-white rounded-2xl px-3.5 py-2.5 shadow-md pointer-events-none">
            <p className="text-[11px] font-bold text-primary-500 uppercase tracking-widest mb-0.5">Welcome</p>
            <p className="text-[13px] font-semibold text-gray-800">Your workspace is ready</p>
          </div>
          <div className="float-b absolute bottom-40 right-10 bg-white/70 backdrop-blur-md border border-white rounded-2xl px-3.5 py-2.5 shadow-md pointer-events-none" style={{animationDelay:'2s'}}>
            <p className="text-[11px] font-bold text-green-500 uppercase tracking-widest mb-0.5">Connected</p>
            <p className="text-[13px] font-semibold text-gray-800">Mentor assigned to your plan</p>
          </div>
          <div className="float-c absolute top-56 right-52 bg-white/60 backdrop-blur-md border border-white rounded-2xl px-3 py-2 shadow-sm pointer-events-none" style={{animationDelay:'1s'}}>
            <p className="text-[12px] font-semibold text-gray-700">First task unlocked</p>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">

            {/* Logo */}
            <div className="mb-10">
              <img src="/gile.png" alt="GILE Foundation" className="h-10 w-auto" />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-primary-100 border border-primary-200 text-primary-700 text-[11.5px] font-bold mb-5 tracking-wide">
              Join thousands of growing mentees
            </div>

            {/* Hero headline */}
            <h1 className="text-[38px] xl:text-[46px] font-black text-gray-900 leading-[1.1] mb-4">
              Your mentorship<br />
              <span className="text-primary-600">journey starts here.</span>
            </h1>
            <p className="text-[14.5px] text-gray-500 leading-relaxed max-w-md mb-8">
              Create your account and get matched with a mentor who will guide you
              through every goal, task, and milestone — structured from day one.
            </p>

            {/* Steps grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-8">
              {STEPS.map(s => (
                <div key={s.title}
                  className="bg-white/65 backdrop-blur-md border border-white/80 rounded-2xl p-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 mb-2">
                    {s.icon}
                  </div>
                  <p className="text-[12.5px] font-bold text-gray-900 leading-tight">{s.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Bottom: process timeline */}
            <div className="mt-auto">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">How it works</p>
              <div className="flex items-center gap-0">
                {['Sign up', 'Get matched', 'Start working', 'Achieve goals'].map((step, i, arr) => (
                  <div key={step} className="flex items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-[12px] font-semibold text-gray-700 whitespace-nowrap">{step}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-8 h-px bg-gray-300 mx-2 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT: Sign-up form ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col">

          {/* Mobile top bar */}
          <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
            <img src="/gile.png" alt="GILE Foundation" className="h-7 w-auto" />
            <Link to="/login" className="text-[13px] text-primary-600 font-semibold">
              Sign in
            </Link>
          </div>

          {/* Form */}
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <div className="w-full max-w-[380px]">

              <div className="mb-6">
                <h2 className="text-[26px] font-black text-gray-900 mb-1">Create account</h2>
                <p className="text-[13.5px] text-gray-400">
                  Already have one?{' '}
                  <Link to="/login" className="text-primary-600 font-bold hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>

              {errors.non_field_errors && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                  {errors.non_field_errors}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">

                {/* Name row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-widest">
                      First name
                    </label>
                    <input type="text" autoComplete="given-name"
                      value={form.first_name} onChange={set('first_name')}
                      placeholder="Jane" className={inputCls()} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-widest">
                      Last name
                    </label>
                    <input type="text" autoComplete="family-name"
                      value={form.last_name} onChange={set('last_name')}
                      placeholder="Doe" className={inputCls()} />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-widest">
                    Username <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <input type="text" autoComplete="username" required
                    value={form.username} onChange={set('username')}
                    placeholder="e.g. jane_doe"
                    className={inputCls('username')} />
                  {errors.username && <p className="mt-1 text-[12px] text-red-500">{errors.username}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-widest">
                    Email <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <input type="email" autoComplete="email" required
                    value={form.email} onChange={set('email')}
                    placeholder="jane@example.com"
                    className={inputCls('email')} />
                  {errors.email && <p className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-widest">
                    Password <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} autoComplete="new-password" required
                      value={form.password} onChange={set('password')}
                      placeholder="••••••••"
                      className={inputCls('password') + ' pr-11'} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-[12px] text-red-500">{errors.password}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-widest">
                    Confirm password <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <div className="relative">
                    <input type={showPw2 ? 'text' : 'password'} autoComplete="new-password" required
                      value={form.password2} onChange={set('password2')}
                      placeholder="••••••••"
                      className={inputCls('password2') + ' pr-11'} />
                    <button type="button" onClick={() => setShowPw2(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPw2 ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password2 && <p className="mt-1 text-[12px] text-red-500">{errors.password2}</p>}
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
                      Creating account…
                    </>
                  ) : (
                    <>Create account <ArrowRight size={15} /></>
                  )}
                </button>

              </form>
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
