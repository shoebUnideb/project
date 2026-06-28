import { ShieldCheck, Users, BookOpen, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: <Users size={20} />, title: 'Role-based Access', desc: 'Separate workflows for students, mentors and administrators.' },
  { icon: <BookOpen size={20} />, title: 'Application Tracking', desc: 'Submit applications with structured steps, documents and comments.' },
  { icon: <ShieldCheck size={20} />, title: 'Progress Visibility', desc: 'Real-time progress bars and status badges at every stage.' },
  { icon: <MessageSquare size={20} />, title: 'Direct Messaging', desc: 'Mentors and administrators communicate via built-in chat.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary-600" size={20} />
          <span className="font-semibold text-[14px] text-gray-800">Mentor Platform</span>
        </div>
        <Link
          to="/login"
          className="text-[13px] font-medium text-primary-600 hover:text-primary-700"
        >
          Sign in →
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">About Mentor Platform</h1>
        <p className="text-[15px] text-gray-600 leading-relaxed mb-12">
          Mentor Platform is a structured, workflow-oriented system designed for academic and professional
          mentoring programs. It connects students with mentors, tracks progress through defined steps,
          and gives administrators full visibility over the program.
        </p>

        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="w-9 h-9 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="text-[14px] font-semibold text-gray-800 mb-1">{f.title}</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center text-[12px] text-gray-400 py-6">
        © 2026 Mentor Platform — Phase 1
      </footer>
    </div>
  );
}
