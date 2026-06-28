import { ExternalLink, Phone, Video, MoreHorizontal, X, FileText, Ban, UserCheck } from 'lucide-react';
import Avatar from '../../../components/ui/Avatar';
import { relativeTime } from '../../../utils/time';
import type { Conversation, Message } from '../../../types';

type ChatTarget = {
  id: number; username: string;
  first_name: string; last_name: string;
  role: string; profile_picture?: string | null;
};

interface ConversationDetailsPanelProps {
  chatTarget: ChatTarget;
  selectedUserId: number;
  selectedName: string;
  selectedConv: Conversation | null;
  isBlocked: boolean;
  detailsMoreRef: React.RefObject<HTMLDivElement>;
  showDetailsMore: boolean;
  setShowDetailsMore: React.Dispatch<React.SetStateAction<boolean>>;
  sharedFiles: Message[];
  visibleFiles: Message[];
  showAllFiles: boolean;
  setShowAllFiles: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onBlock: () => void;
  onNavigate: (path: string) => void;
}

export function ConversationDetailsPanel({
  chatTarget, selectedUserId, selectedName, selectedConv, isBlocked,
  detailsMoreRef, showDetailsMore, setShowDetailsMore,
  sharedFiles, visibleFiles, showAllFiles, setShowAllFiles,
  onClose, onBlock, onNavigate,
}: ConversationDetailsPanelProps) {
  return (
    <div className="shrink-0 flex flex-col bg-gray-50/40 border-l border-gray-100 overflow-y-auto" style={{ width: 272 }}>
      <div className="flex items-center justify-between px-4 h-[48px] shrink-0 border-b border-gray-100">
        <p className="text-[13.5px] font-bold text-gray-900">Conversation details</p>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col items-center pt-5 pb-4 px-4 border-b border-gray-100">
        <div className="relative mb-3">
          <Avatar name={selectedName} src={chatTarget.profile_picture ?? undefined} size="3xl" />
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
        </div>
        <p className="text-[15px] font-bold text-gray-900">{selectedName}</p>
        <p className="text-[12px] text-gray-500 capitalize mt-0.5">
          {chatTarget.role === 'superadmin' ? 'Admin' : chatTarget.role}
        </p>
        <div className="grid grid-cols-4 gap-2 w-full mt-4">
          <button onClick={() => onNavigate(`/profiles/${selectedUserId}`)}
            className="flex flex-col items-center gap-1.5 py-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <ExternalLink size={16} className="text-gray-600" />
            <span className="text-[10.5px] font-medium text-gray-600">Profile</span>
          </button>
          <button disabled title="Coming soon" className="flex flex-col items-center gap-1.5 py-2.5 bg-gray-50 rounded-xl opacity-40 cursor-not-allowed">
            <Phone size={16} className="text-gray-600" />
            <span className="text-[10.5px] font-medium text-gray-600">Call</span>
          </button>
          <button disabled title="Coming soon" className="flex flex-col items-center gap-1.5 py-2.5 bg-gray-50 rounded-xl opacity-40 cursor-not-allowed">
            <Video size={16} className="text-gray-600" />
            <span className="text-[10.5px] font-medium text-gray-600">Video</span>
          </button>
          <div className="relative" ref={detailsMoreRef}>
            <button onClick={() => setShowDetailsMore(v => !v)}
              className="w-full flex flex-col items-center gap-1.5 py-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <MoreHorizontal size={16} className="text-gray-600" />
              <span className="text-[10.5px] font-medium text-gray-600">More</span>
            </button>
            {showDetailsMore && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl z-20 py-1">
                <button onClick={() => { onNavigate(`/profiles/${selectedUserId}`); setShowDetailsMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors">
                  <ExternalLink size={13} /> View profile
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button onClick={onBlock}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${isBlocked ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}>
                  {isBlocked ? <><UserCheck size={13} /> Unblock user</> : <><Ban size={13} /> Block user</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-gray-100 space-y-4">
        <div>
          <p className="text-[12px] font-bold text-gray-900 mb-1">About</p>
          <p className="text-[12.5px] text-gray-600 leading-snug">
            {chatTarget.role === 'superadmin'
              ? 'Platform administrator'
              : chatTarget.role === 'mentor'
              ? 'Mentor at Abroad Mentor'
              : 'Student at Abroad Mentor'}
          </p>
        </div>
        {selectedConv?.user.email && (
          <div>
            <p className="text-[12px] font-bold text-gray-900 mb-1">Email</p>
            <a href={`mailto:${selectedConv.user.email}`} className="text-[12.5px] text-primary-600 hover:underline break-all">
              {selectedConv.user.email}
            </a>
          </div>
        )}
        <div>
          <p className="text-[12px] font-bold text-gray-900 mb-1">Local time</p>
          <p className="text-[12.5px] text-gray-600">
            {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {' · '}
            {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {sharedFiles.length > 0 && (
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-bold text-gray-900">
              Shared files <span className="text-[11px] font-normal text-gray-400">({sharedFiles.length})</span>
            </p>
            {sharedFiles.length > 4 && (
              <button onClick={() => setShowAllFiles(v => !v)} className="text-[11.5px] font-medium text-primary-600 hover:underline">
                {showAllFiles ? 'Show less' : 'View all'}
              </button>
            )}
          </div>
          <div className="space-y-2.5">
            {visibleFiles.map(m => (
              <a key={m.id} href={m.attachment} download target="_blank" rel="noreferrer"
                className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl p-1.5 -mx-1.5 transition-colors group">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-primary-600 transition-colors">
                    {m.attachment!.split('/').pop()}
                  </p>
                  <p className="text-[11px] text-gray-400">{relativeTime(m.timestamp)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
