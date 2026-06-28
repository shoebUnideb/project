import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, Users, BarChart2, FileText, MessageSquare, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const FEATURES = [
  { icon: <Shield size={16} />,       title: 'Org Management',   desc: 'Members, roles & departments'   },
  { icon: <Users size={16} />,        title: 'People Directory', desc: 'Org-wide member profiles'        },
  { icon: <BarChart2 size={16} />,    title: 'Analytics',        desc: 'Engagement & contribution data'  },
  { icon: <FileText size={16} />,     title: 'Documents',        desc: 'Member docs & templates'         },
  { icon: <MessageSquare size={16} />,title: 'Org Chat',         desc: 'Channels, DMs & polls'           },
  { icon: <BookOpen size={16} />,     title: 'Training',         desc: 'Learning paths & events'         },
];

export default function LoginPage() {
  const { login } = useAuth();
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
    if (!result.ok) {
      setError(result.error ?? 'Login failed.');
      return;
    }
    navigate('/org/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left — login form */}
      <div className="flex flex-col justify-center w-full max-w-md px-10 py-16 flex-shrink-0">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sidebar-bg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">GILE Internal Portal</span>
          </div>
          <p className="text-sm text-gray-500 mt-4">Sign in with your GILE account to access org tools.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username or email</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-active"
              placeholder="your.username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-sidebar-active"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sidebar-bg text-white rounded-lg py-2.5 text-sm font-medium hover:bg-sidebar-active transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Internal portal — restricted access only.
        </p>
      </div>

      {/* Right — feature panel */}
      <div className="hidden lg:flex flex-col justify-center flex-1 bg-sidebar-bg px-16 py-16">
        <h2 className="text-white text-2xl font-bold mb-2">GILE Internal Portal</h2>
        <p className="text-sidebar-muted text-sm mb-10">
          Org-wide tools for members with internal access.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white/5 rounded-xl p-4">
              <div className="text-sidebar-text mb-2">{f.icon}</div>
              <p className="text-white text-sm font-semibold">{f.title}</p>
              <p className="text-sidebar-muted text-xs mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
