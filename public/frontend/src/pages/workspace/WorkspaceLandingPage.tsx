import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, MapPin, Calendar, Globe, Target, Zap, Lock, EyeOff, Check, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import Avatar from '../../components/ui/Avatar';

// Maps workspace accent_color (Tailwind name) to a hex value usable in inline styles
const ACCENT_HEX: Record<string, string> = {
  blue:    '#7a2e8a',  // primary-500
  indigo:  '#4f46e5',
  purple:  '#9333ea',
  teal:    '#0d9488',
  green:   '#16a34a',
  emerald: '#059669',
  orange:  '#ea580c',
  red:     '#dc2626',
  pink:    '#db2777',
  amber:   '#d97706',
  cyan:    '#0891b2',
  slate:   '#475569',
  violet:  '#7c3aed',
  rose:    '#e11d48',
};

export default function WorkspaceLandingPage() {
  const { workspace, refetch } = useWorkspace();
  const navigate = useNavigate();
  const [joining, setJoining]       = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting]   = useState(false);
  const [declining, setDeclining]   = useState(false);

  if (!workspace) return null;

  const accentBg = ACCENT_HEX[workspace.accent_color] ?? ACCENT_HEX.blue;

  const handleJoin = async () => {
    setJoining(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.join(workspace.id);
      refetch();
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.cancelJoin(workspace.id);
      refetch();
    } finally {
      setCancelling(false);
    }
  };

  const handleAcceptInvite = async () => {
    setAccepting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.acceptInvite(workspace.id);
      await refetch();
      navigate(`/w/${workspace.slug}`);
    } catch {
      // acceptance failed — stay on page
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineInvite = async () => {
    setDeclining(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.declineInvite(workspace.id);
      navigate('/workspaces');
    } catch {
      // decline failed — stay on page
    } finally {
      setDeclining(false);
    }
  };

  const handleAcceptMentorInvite = async () => {
    setAccepting(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.acceptMentorInvite(workspace.id);
      await refetch();
      navigate(`/w/${workspace.slug}`);
    } catch {
      // failed — stay
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineMentorInvite = async () => {
    setDeclining(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.declineMentorInvite(workspace.id);
      navigate('/workspaces');
    } catch {
      // failed — stay
    } finally {
      setDeclining(false);
    }
  };

  const status = workspace.my_status;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Back button — top left */}
      <div>
        <button
          onClick={() => navigate('/workspaces')}
          className="flex items-center gap-2 text-[13px] font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 transition-colors"
        >
          ← Back to all workspaces
        </button>
      </div>

      {/* ── Two-column grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 flex-1">

        {/* Left — hero + stats + tags */}
        <div className="flex flex-col gap-5">

          {/* Hero card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
            {/* Colored banner strip */}
            <div className="h-28 shrink-0" style={{ backgroundColor: accentBg }} />
            {/* Content — logo straddles the banner/body boundary */}
            <div className="px-6 pb-6 flex-1">
              <div className="flex items-end gap-4 -mt-10 mb-4">
                <div className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-4 border-white">
                  {workspace.logo_url ? (
                    <img src={workspace.logo_url} alt="logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold" style={{ backgroundColor: accentBg }}>
                      {workspace.icon_emoji || workspace.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <h1 className="text-gray-900 text-[26px] font-bold leading-tight mb-1">{workspace.name}</h1>
              {workspace.goal && (
                <p className="text-gray-500 text-[13px] flex items-center gap-1.5 mb-2">
                  <Target size={12} className="shrink-0" />{workspace.goal}
                </p>
              )}
              {workspace.description && (
                <p className="text-gray-700 text-[14px] leading-relaxed">{workspace.description}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-white rounded-full px-3 py-1.5 border border-gray-200">
              <Users size={12} className="text-gray-400" />
              {workspace.member_count}{workspace.max_members ? `/${workspace.max_members}` : ''} members
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-white rounded-full px-3 py-1.5 border border-gray-200">
              <BookOpen size={12} className="text-gray-400" />
              {workspace.resource_count} resources
            </div>
            {workspace.target_country && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-white rounded-full px-3 py-1.5 border border-gray-200">
                <Target size={12} className="text-gray-400" />{workspace.target_country}
              </div>
            )}
            {workspace.target_deadline && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-white rounded-full px-3 py-1.5 border border-gray-200">
                <Calendar size={12} className="text-gray-400" />
                {new Date(workspace.target_deadline).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
              </div>
            )}
            {workspace.language && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-white rounded-full px-3 py-1.5 border border-gray-200">
                <Globe size={12} className="text-gray-400" />{workspace.language}
              </div>
            )}
            {workspace.auto_accept && (
              <div className="flex items-center gap-1.5 text-[12px] text-green-600 bg-green-50 rounded-full px-3 py-1.5 border border-green-200">
                <Zap size={12} />Auto-join
              </div>
            )}
            {workspace.privacy !== 'public' && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-600 bg-white rounded-full px-3 py-1.5 border border-gray-200">
                {workspace.privacy === 'secret' ? <EyeOff size={12} className="text-gray-400" /> : <Lock size={12} className="text-gray-400" />}
                {workspace.privacy === 'secret' ? 'Secret' : 'Private'}
              </div>
            )}
          </div>

          {/* Tags */}
          {workspace.tags_list.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {workspace.tags_list.map(t => (
                <span key={t} className="px-3 py-1 bg-white border border-gray-200 text-gray-600 text-[12px] font-medium rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right — mentor + CTA */}
        <div className="flex flex-col gap-5">

          {/* Mentor card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
            <Avatar name={workspace.mentor_name} src={workspace.mentor_picture} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Mentor</p>
              <p className="text-[16px] font-bold text-gray-900 truncate">{workspace.mentor_name}</p>
              {workspace.mentor_expertise && (
                <p className="text-[12.5px] text-gray-500 truncate">{workspace.mentor_expertise}</p>
              )}
            </div>
          </div>

          {/* CTA card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex-1 flex flex-col justify-between">
            {status === 'invited' ? (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">You've been invited!</p>
                  <p className="text-[13px] text-gray-500">{workspace.mentor_name} has personally invited you to join this private workspace.</p>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={handleAcceptInvite}
                    disabled={accepting}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white text-[13.5px] font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Check size={15} /> {accepting ? 'Accepting…' : 'Accept invitation'}
                  </button>
                  <button
                    onClick={handleDeclineInvite}
                    disabled={declining}
                    className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X size={14} /> {declining ? 'Declining…' : 'Decline'}
                  </button>
                </div>
              </>
            ) : status === 'mentor_invited' ? (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">Mentor invitation</p>
                  <p className="text-[13px] text-gray-500">{workspace.mentor_name} has invited you to be a mentor in this workspace. You'll have full write access to tasks, resources, and chat.</p>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={handleAcceptMentorInvite}
                    disabled={accepting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-[13.5px] font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Check size={15} /> {accepting ? 'Accepting…' : 'Accept as Mentor'}
                  </button>
                  <button
                    onClick={handleDeclineMentorInvite}
                    disabled={declining}
                    className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X size={14} /> {declining ? 'Declining…' : 'Decline'}
                  </button>
                </div>
              </>
            ) : status === 'pending' ? (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">Request sent</p>
                  <p className="text-[13px] text-gray-500">Your request to join is pending approval from the mentor.</p>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <button disabled className="w-full py-3 bg-amber-50 border border-amber-200 text-amber-600 text-[13.5px] font-semibold rounded-xl cursor-default">
                    Request pending…
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel request'}
                  </button>
                </div>
              </>
            ) : status === 'rejected' ? (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">Request not approved</p>
                  <p className="text-[13px] text-gray-500 mb-1">Your previous request to join this workspace was not approved.</p>
                  <p className="text-[12.5px] text-gray-400">You can send a new request and the mentor will review it.</p>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <div className="w-full py-2 bg-red-50 border border-red-100 text-red-400 text-[12.5px] font-medium rounded-xl text-center">
                    Previous request declined
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    style={{ backgroundColor: accentBg }}
                    className="w-full py-3 text-white text-[13.5px] font-semibold rounded-xl transition-opacity disabled:opacity-60 hover:opacity-90"
                  >
                    {joining ? 'Sending…' : 'Request to join again'}
                  </button>
                </div>
              </>
            ) : workspace.privacy !== 'public' ? (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">Private workspace</p>
                  <p className="text-[13px] text-gray-500">This workspace is private. Contact the mentor to request access.</p>
                </div>
                <button disabled className="mt-5 w-full py-3 bg-gray-50 border border-gray-200 text-gray-400 text-[13.5px] font-semibold rounded-xl cursor-default flex items-center justify-center gap-2">
                  <Lock size={14} /> Invite only
                </button>
              </>
            ) : workspace.is_full ? (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">Workspace is full</p>
                  <p className="text-[13px] text-gray-500">This workspace has reached its member limit.</p>
                </div>
                <button disabled className="mt-5 w-full py-3 bg-gray-50 border border-gray-200 text-gray-400 text-[13.5px] font-semibold rounded-xl cursor-default">
                  Full
                </button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1">
                    {workspace.auto_accept ? 'Join instantly' : 'Request to join'}
                  </p>
                  <p className="text-[13px] text-gray-500">
                    {workspace.auto_accept
                      ? "You'll get immediate access to this workspace."
                      : "Send a request to the mentor. You'll be notified once approved."}
                  </p>
                </div>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  style={{ backgroundColor: accentBg }}
                  className="mt-5 w-full py-3 text-white text-[13.5px] font-semibold rounded-xl transition-opacity disabled:opacity-60 hover:opacity-90"
                >
                  {joining ? 'Sending…' : workspace.auto_accept ? 'Join workspace' : 'Request to join'}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
