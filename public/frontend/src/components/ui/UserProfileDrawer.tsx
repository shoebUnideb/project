import { X, Linkedin, GraduationCap, MessageSquare, Star, UserX, UserMinus, ShieldOff, ExternalLink, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MarketplaceUser } from '../../types';
import Avatar from './Avatar';

interface Props {
  user: MarketplaceUser;
  hasConversation: boolean;
  onClose: () => void;
  onMessage: (id: number) => void;
  onBlock?: (id: number) => void;
  onUnblock?: (id: number) => void;
  onUnfriend?: (crId: number) => void;
  acceptedCrId?: number;
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-md">
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

export default function UserProfileDrawer({
  user, hasConversation, onClose, onMessage,
  onBlock, onUnblock, onUnfriend, acceptedCrId,
}: Props) {
  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;
  const isMentor = user.role === 'mentor';
  const status   = user.messaging_status;
  const navigate = useNavigate();

  const primaryButton = () => {
    if (status === 'blocked') return (
      <button onClick={() => onUnblock?.(user.id)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-700 hover:bg-gray-800 text-white text-[13px] font-semibold rounded-xl transition-colors">
        <ShieldOff size={14} /> Unblock
      </button>
    );
    return (
      <button onClick={() => onMessage(user.id)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-xl transition-colors">
        <MessageSquare size={14} />
        {hasConversation ? 'Continue conversation' : 'Send a message'}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className="pointer-events-auto w-[80vw] max-w-[860px] bg-white rounded-2xl shadow-2xl border border-[#e0e0e0] flex flex-col overflow-hidden"
          style={{ maxHeight: '80vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header bar ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#e0e0e0] shrink-0">
            <p className="text-[14px] font-bold text-gray-900">Profile</p>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>

          {/* ── Two-column body ──────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* ── Left column: identity + actions ──────────────────── */}
            <div className="w-[260px] shrink-0 flex flex-col border-r border-[#e0e0e0] overflow-y-auto">

              {/* Avatar + name block */}
              <div className="flex flex-col items-center px-6 pt-7 pb-5 border-b border-[#f0f0f0]">
                <div className="w-[110px] h-[110px] rounded-2xl overflow-hidden bg-gray-100 mb-3 shadow-sm">
                  {user.profile_picture
                    ? <img src={user.profile_picture} alt={fullName} className="w-full h-full object-cover" />
                    : <Avatar name={fullName} size="xl" className="w-full h-full" />}
                </div>

                <h2 className="text-[16px] font-bold text-gray-900 text-center leading-snug">{fullName}</h2>

                {user.headline && (
                  <p className="text-[12px] text-gray-500 text-center mt-1 leading-snug">{user.headline}</p>
                )}

                {/* Badges */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
                  <span className={`text-[10.5px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                    isMentor ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isMentor ? 'Mentor' : 'Mentee'}
                  </span>
                  {user.is_assigned && (
                    <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <Star size={8} fill="currentColor" />
                      {isMentor ? 'Your Mentor' : 'Your Mentee'}
                    </span>
                  )}
                  {status === 'blocked' && (
                    <span className="text-[10.5px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Blocked
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-5 py-4 space-y-1.5 mt-auto">
                {primaryButton()}
                <button
                  onClick={() => { onClose(); navigate(`/profiles/${user.id}`); }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-[12.5px] font-semibold text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink size={13} /> View full profile
                </button>
                <div className="flex items-center justify-center gap-4 pt-1">
                  {acceptedCrId != null && (
                    <button onClick={() => onUnfriend?.(acceptedCrId)}
                      className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
                      <UserMinus size={13} /> Unfriend
                    </button>
                  )}
                  {status !== 'blocked' && (
                    <button onClick={() => onBlock?.(user.id)}
                      className="flex items-center gap-1.5 text-[12px] text-red-400 hover:text-red-600 transition-colors">
                      <UserX size={13} /> Block
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column: details ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

              {status === 'blocked' ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <ShieldOff size={28} className="text-gray-200 mb-3" />
                  <p className="text-[14px] font-semibold text-gray-500">This user is blocked</p>
                  <p className="text-[12.5px] text-gray-400 mt-1">Unblock them to see their profile details.</p>
                </div>
              ) : (
                <>
                  {/* Bio */}
                  {user.bio && (
                    <div>
                      <SectionLabel>About</SectionLabel>
                      <p className="text-[13px] text-gray-600 leading-relaxed">{user.bio}</p>
                    </div>
                  )}

                  {/* Details */}
                  <div>
                    <SectionLabel>Details</SectionLabel>
                    <div className="space-y-2.5">
                      {isMentor ? (
                        user.expertise && (
                          <div className="flex items-start gap-2.5 text-[13px] text-gray-700">
                            <Award size={13} className="mt-0.5 shrink-0 text-gray-400" />
                            <span className="leading-snug">{user.expertise}</span>
                          </div>
                        )
                      ) : (
                        (user.field_of_study || user.university) && (
                          <div className="flex items-start gap-2.5 text-[13px] text-gray-700">
                            <GraduationCap size={13} className="mt-0.5 shrink-0 text-gray-400" />
                            <span className="leading-snug">{[user.field_of_study, user.university].filter(Boolean).join(' · ')}</span>
                          </div>
                        )
                      )}
                      {user.linkedin_url && (
                        <a href={user.linkedin_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2.5 text-[13px] text-primary-600 hover:underline">
                          <Linkedin size={13} className="shrink-0 text-gray-400" /> LinkedIn Profile
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Tags / Skills */}
                  {(user.tags.length > 0 || user.skills.length > 0) && (
                    <div className="space-y-4">
                      {user.tags.length > 0 && (
                        <div>
                          <SectionLabel>{isMentor ? 'Expertise' : 'Field'}</SectionLabel>
                          <div className="flex flex-wrap gap-1.5">
                            {user.tags.map(t => <Tag key={t} label={t} />)}
                          </div>
                        </div>
                      )}
                      {!isMentor && user.skills.length > 0 && (
                        <div>
                          <SectionLabel>Skills</SectionLabel>
                          <div className="flex flex-wrap gap-1.5">
                            {user.skills.map(s => <Tag key={s} label={s} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
