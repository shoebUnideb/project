import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PenSquare, Search, Plus, Hash, Users, MessageSquare, Info,
  MoreHorizontal, ChevronDown, BellOff, Bell, Pin, FileText,
  Download, Check, UserCircle, Phone, Video, X, Edit2, Trash2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../api/apiClient';
import { workspacesApi } from '../../api/workspaces';
import apiClient from '../../api/apiClient';
import Avatar from '../../components/ui/Avatar';
import { relativeTime } from '../../utils/time';
import RichTextEditor from '../../components/workspace/RichTextEditor';
import type {
  WorkspaceChatChannel, WorkspaceChatMessage,
  WorkspaceDMConversation, WorkspaceDMMessage, WorkspacePoll, User,
} from '../../types';
import { STARRED_KEY, MUTED_KEY, channelIcon, senderName, dateLabel, isImageUrl } from './chat/chatUtils';
import { DateSeparator } from './chat/ChatPrimitives';
import { MessageBubble, DMMessageBubble } from './chat/MessageBubbles';
import { PollCard, CreatePollModal } from './chat/PollComponents';
import { CreateChannelModal, EditChannelModal, ConfirmDialog } from './chat/ChannelModals';
import { NewDMModal } from './chat/NewDMModal';
import { SearchMessagesModal } from './chat/SearchMessagesModal';
import { ForwardMessageModal } from './chat/ForwardMessageModal';

export default function WorkspaceChatPage() {
  const { workspace, isOwner } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Channels & messages
  const [channels, setChannels] = useState<WorkspaceChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);

  // DMs
  const [dmConversations, setDmConversations] = useState<WorkspaceDMConversation[]>([]);
  const [activeDMUserId, setActiveDMUserId] = useState<number | null>(null);
  const [activeDMUser, setActiveDMUser] = useState<User | null>(null);
  const [dmMessages, setDmMessages] = useState<WorkspaceDMMessage[]>([]);

  // Input
  const [replyTo, setReplyTo] = useState<WorkspaceChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Typing
  const [typingUsers, setTypingUsers] = useState<{ id: number; name: string }[]>([]);
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastTypingSent = useRef<number>(0);

  // Right panel
  const [rightTab, setRightTab] = useState<'details' | 'files' | 'polls' | 'settings'>('details');
  const [rightOpen, setRightOpen] = useState(false);
  const [polls, setPolls] = useState<WorkspacePoll[]>([]);
  const [channelSettingName, setChannelSettingName] = useState('');
  const [channelSettingDesc, setChannelSettingDesc] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Modals
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [forwardPayload, setForwardPayload] = useState<{ body: string } | null>(null);
  const [editingChannel, setEditingChannel] = useState<WorkspaceChatChannel | null>(null);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<WorkspaceChatChannel | null>(null);

  // Starred messages (localStorage) — loaded from correct key by workspace.id effect below
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set());

  // Sidebar
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Search
  const [msgSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // More menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Muted keys (localStorage)
  const [mutedKeys, setMutedKeys] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(MUTED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageIds = useRef<Set<number>>(new Set());
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);

  if (!workspace || !user) return null;

  // ── starred helpers ──────────────────────────────────────────
  const starKey = STARRED_KEY(workspace.id);
  const toggleStar = (key: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(starKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const currentMuteKey = activeDMUserId
    ? `dm-${workspace.id}-${activeDMUserId}`
    : activeChannelId
    ? `ch-${workspace.id}-${activeChannelId}`
    : null;
  const isMuted = currentMuteKey ? mutedKeys.has(currentMuteKey) : false;

  // ── computed ────────────────────────────────────────────
  const activeChannel = channels.find(c => c.id === activeChannelId) ?? null;
  const pinnedMessages = messages.filter(m => m.is_pinned);
  const fileMessages = (activeDMUserId ? dmMessages : messages).filter(m => m.attachment_url) as WorkspaceChatMessage[];
  const imageMessages = fileMessages.filter(m => m.attachment_url && isImageUrl(m.attachment_url!));

  // ── WebSocket ────────────────────────────────────────────
  const connectWS = useCallback((channelId: number) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    clearTimeout(reconnectTimer.current);
    const ws = new WebSocket(`/ws/workspaces/${workspace.id}/channels/${channelId}/?token=${tokens.getAccess()}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'message') {
          const msg: WorkspaceChatMessage = data.data;
          if (!messageIds.current.has(msg.id)) {
            messageIds.current.add(msg.id);
            setMessages(prev => [...prev, msg]);
          }
        } else if (data.type === 'reaction') {
          const { message_id, reactions } = data.data;
          setMessages(prev => prev.map(m => m.id === message_id ? { ...m, reactions } : m));
        } else if (data.type === 'typing') {
          const { user_id, user_name } = data.data;
          if (user_id === user.id) return;
          setTypingUsers(prev => {
            const without = prev.filter(u => u.id !== user_id);
            return [...without, { id: user_id, name: user_name }];
          });
          clearTimeout(typingTimers.current[user_id]);
          typingTimers.current[user_id] = setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.id !== user_id));
          }, 3000);
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        reconnectTimer.current = setTimeout(() => connectWS(channelId), 3000);
      }
    };
  }, [workspace.id, user.id]);

  const connectDMWS = useCallback((otherUserId: number) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    clearTimeout(reconnectTimer.current);
    const ws = new WebSocket(`/ws/workspaces/${workspace.id}/dms/${otherUserId}/?token=${tokens.getAccess()}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'message') {
          const msg: WorkspaceDMMessage = data.data;
          setDmMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          setDmConversations(prev => prev.map(c =>
            c.user.id === otherUserId || c.user.id === user.id
              ? { ...c, last_message: msg.body, last_at: msg.created_at }
              : c,
          ));
        } else if (data.type === 'dm_edit') {
          const updated: WorkspaceDMMessage = data.data;
          setDmMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        } else if (data.type === 'dm_delete') {
          const { id: deletedId } = data.data;
          setDmMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        reconnectTimer.current = setTimeout(() => connectDMWS(otherUserId), 3000);
      }
    };
  }, [workspace.id, user.id]);

  // ── initial data load ────────────────────────────────────
  useEffect(() => {
    workspacesApi.getChannels(workspace.id).then(chs => {
      setChannels(chs);
      if (chs.length > 0) setActiveChannelId(chs[0].id);
    }).catch(() => {});
    workspacesApi.getDMConversations(workspace.id).then(setDmConversations).catch(() => {});
    workspacesApi.getPolls(workspace.id).then(setPolls).catch(() => {});
    try {
      const raw = localStorage.getItem(STARRED_KEY(workspace.id));
      if (raw) setStarredIds(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [workspace.id]);

  // ── load messages when channel changes ────────────────────
  useEffect(() => {
    if (!activeChannelId) return;
    messageIds.current = new Set();
    setMessages([]);
    setReplyTo(null);
    setActiveDMUserId(null);
    setActiveDMUser(null);
    connectWS(activeChannelId);
    workspacesApi.getChannelMessages(workspace.id, activeChannelId).then(msgs => {
      msgs.forEach(m => messageIds.current.add(m.id));
      setMessages(msgs);
    }).catch(() => {});
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      clearTimeout(reconnectTimer.current);
    };
  }, [activeChannelId, workspace.id, connectWS]);

  // ── load DM messages when DM changes ─────────────────────
  useEffect(() => {
    if (!activeDMUserId) return;
    setActiveChannelId(null);
    setDmMessages([]);
    connectDMWS(activeDMUserId);
    workspacesApi.getDMMessages(workspace.id, activeDMUserId).then(setDmMessages).catch(() => {});
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      clearTimeout(reconnectTimer.current);
    };
  }, [activeDMUserId, workspace.id, connectDMWS]);

  // ── scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, dmMessages]);

  // ── sync channel settings form ────────────────────────────
  useEffect(() => {
    if (activeChannel) {
      setChannelSettingName(activeChannel.name);
      setChannelSettingDesc(activeChannel.description);
    }
  }, [activeChannel]);

  // ── send message ──────────────────────────────────────────
  const handleSendRich = async (html: string, messageType: 'message' | 'announcement', file?: File | null) => {
    if (sending) return;
    if (!html.trim() && !file) return;

    if (activeDMUserId) {
      setSending(true);
      try {
        await apiClient.initCsrf();
        const fd = new FormData();
        if (html.trim()) fd.append('body', html);
        if (file) fd.append('attachment', file);
        const msg = await workspacesApi.sendDMMessage(workspace.id, activeDMUserId, fd);
        setDmMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      } catch { setSendError('Failed to send.'); } finally { setSending(false); }
      return;
    }

    if (!activeChannelId) return;

    if (file) {
      setSending(true);
      try {
        await apiClient.initCsrf();
        const fd = new FormData();
        if (html.trim()) fd.append('body', html);
        fd.append('attachment', file);
        fd.append('message_type', messageType);
        if (replyTo) fd.append('reply_to_id', String(replyTo.id));
        const msg = await workspacesApi.sendChannelMessage(workspace.id, activeChannelId, fd);
        if (!messageIds.current.has(msg.id)) {
          messageIds.current.add(msg.id);
          setMessages(prev => [...prev, msg]);
        }
        setReplyTo(null);
      } catch { setSendError('Failed to send.'); } finally { setSending(false); }
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', body: html, message_type: messageType, reply_to_id: replyTo?.id ?? null }));
      setReplyTo(null);
    } else {
      setSending(true);
      try {
        await apiClient.initCsrf();
        const fd = new FormData();
        fd.append('body', html);
        fd.append('message_type', messageType);
        if (replyTo) fd.append('reply_to_id', String(replyTo.id));
        const msg = await workspacesApi.sendChannelMessage(workspace.id, activeChannelId, fd);
        if (!messageIds.current.has(msg.id)) {
          messageIds.current.add(msg.id);
          setMessages(prev => [...prev, msg]);
        }
        setReplyTo(null);
      } catch { setSendError('Failed to send.'); } finally { setSending(false); }
    }
  };

  // ── reactions ─────────────────────────────────────────────
  const handleReact = async (msgId: number, emoji: string) => {
    if (!activeChannelId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'react', mid: msgId, emoji }));
    } else {
      try {
        await apiClient.initCsrf();
        const result = await workspacesApi.reactToMessage(workspace.id, activeChannelId, msgId, emoji);
        setMessages(prev => prev.map(m => m.id === result.message_id ? { ...m, reactions: result.reactions } : m));
      } catch { /* ignore */ }
    }
  };

  // ── pin ───────────────────────────────────────────────────
  const handlePin = async (msg: WorkspaceChatMessage) => {
    if (!activeChannelId) return;
    try {
      await apiClient.initCsrf();
      const updated = await workspacesApi.pinMessage(workspace.id, activeChannelId, msg.id, !msg.is_pinned);
      setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));
    } catch { /* ignore */ }
  };

  // ── delete / unsend channel message ──────────────────────
  const handleDeleteMessage = async (msg: WorkspaceChatMessage) => {
    if (!activeChannelId || !confirm('Delete this message?')) return;
    try {
      await apiClient.initCsrf();
      await workspacesApi.deleteChannelMessage(workspace.id, activeChannelId, msg.id);
      messageIds.current.delete(msg.id);
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    } catch { /* ignore */ }
  };

  // ── edit channel message ──────────────────────────────────
  const handleEditChannelMessage = async (msg: WorkspaceChatMessage, newBody: string) => {
    if (!activeChannelId) return;
    try {
      await apiClient.initCsrf();
      const updated = await workspacesApi.editChannelMessage(workspace.id, activeChannelId, msg.id, newBody);
      setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));
    } catch { /* ignore */ }
  };

  // ── edit DM message ───────────────────────────────────────
  const handleEditDMMessage = async (dm: WorkspaceDMMessage, newBody: string) => {
    if (!activeDMUserId) return;
    try {
      await apiClient.initCsrf();
      const updated = await workspacesApi.editDMMessage(workspace.id, activeDMUserId, dm.id, newBody);
      setDmMessages(prev => prev.map(m => m.id === dm.id ? updated : m));
    } catch { /* ignore */ }
  };

  // ── unsend DM message ─────────────────────────────────────
  const handleUnsendDMMessage = async (dm: WorkspaceDMMessage) => {
    if (!activeDMUserId || !confirm('Unsend this message?')) return;
    try {
      await apiClient.initCsrf();
      await workspacesApi.deleteDMMessage(workspace.id, activeDMUserId, dm.id);
      setDmMessages(prev => prev.filter(m => m.id !== dm.id));
    } catch { /* ignore */ }
  };

  // ── forward ───────────────────────────────────────────────
  const handleForward = async (target: { type: 'channel'; id: number } | { type: 'dm'; userId: number }, body: string) => {
    if (!body.trim()) return;
    try {
      await apiClient.initCsrf();
      const fd = new FormData();
      if (target.type === 'channel') {
        fd.append('body', `↩ Forwarded: ${body}`);
        await workspacesApi.sendChannelMessage(workspace.id, target.id, fd);
      } else {
        fd.append('body', `↩ Forwarded: ${body}`);
        await workspacesApi.sendDMMessage(workspace.id, target.userId, fd);
      }
    } catch { /* ignore */ }
  };

  // ── poll actions ──────────────────────────────────────────
  const handleVote = async (pollId: number, optionId: number) => {
    try {
      await apiClient.initCsrf();
      const updated = await workspacesApi.votePoll(workspace.id, pollId, optionId);
      setPolls(prev => prev.map(p => p.id === pollId ? updated : p));
    } catch { /* ignore */ }
  };

  const handleClosePoll = async (pollId: number) => {
    try {
      await apiClient.initCsrf();
      const updated = await workspacesApi.closePoll(workspace.id, pollId);
      setPolls(prev => prev.map(p => p.id === pollId ? updated : p));
    } catch { /* ignore */ }
  };

  const handleDeletePoll = async (pollId: number) => {
    if (!confirm('Delete this poll?')) return;
    try {
      await apiClient.initCsrf();
      await workspacesApi.deletePoll(workspace.id, pollId);
      setPolls(prev => prev.filter(p => p.id !== pollId));
    } catch { /* ignore */ }
  };

  // ── channel settings ──────────────────────────────────────
  const saveChannelSettings = async () => {
    if (!activeChannelId) return;
    setSavingSettings(true);
    try {
      await apiClient.initCsrf();
      const updated = await workspacesApi.updateChannel(workspace.id, activeChannelId, {
        name: channelSettingName.trim() || activeChannel?.name,
        description: channelSettingDesc,
      });
      setChannels(prev => prev.map(c => c.id === activeChannelId ? updated : c));
    } catch { /* ignore */ } finally { setSavingSettings(false); }
  };

  const handleDeleteChannel = async (ch: WorkspaceChatChannel) => {
    try {
      await apiClient.initCsrf();
      await workspacesApi.deleteChannel(workspace.id, ch.id);
      setChannels(prev => prev.filter(c => c.id !== ch.id));
      if (activeChannelId === ch.id) setActiveChannelId(null);
    } catch { /* ignore */ } finally { setConfirmDeleteChannel(null); }
  };

  // ── DM / mute / mark read ────────────────────────────────
  const selectDM = (u: User) => {
    setActiveDMUser(u);
    setActiveDMUserId(u.id);
    setActiveChannelId(null);
  };

  const toggleMute = () => {
    if (!currentMuteKey) return;
    setMutedKeys(prev => {
      const next = new Set(prev);
      if (next.has(currentMuteKey)) next.delete(currentMuteKey);
      else next.add(currentMuteKey);
      try { localStorage.setItem(MUTED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    setShowMoreMenu(false);
  };

  const markAllRead = () => {
    if (!activeDMUserId) return;
    setDmConversations(prev => prev.map(c => c.user.id === activeDMUserId ? { ...c, unread: 0 } : c));
    setShowMoreMenu(false);
  };

  const archiveChannel = async () => {
    if (!activeChannelId || !isOwner) return;
    if (!confirm(`Archive #${activeChannel?.name}? Members won't be able to post new messages.`)) return;
    try {
      await apiClient.initCsrf();
      await workspacesApi.updateChannel(workspace.id, activeChannelId, { is_archived: true });
      setChannels(prev => prev.filter(c => c.id !== activeChannelId));
      const remaining = channels.filter(c => c.id !== activeChannelId && !c.is_archived);
      setActiveChannelId(remaining[0]?.id ?? null);
    } catch { /* ignore */ }
    setShowMoreMenu(false);
  };

  // ── message grouping with date separators ─────────────────
  const currentMessages = activeDMUserId ? dmMessages : messages;
  const msgGroups: (WorkspaceChatMessage | WorkspaceDMMessage | { type: 'sep'; label: string })[] = [];
  let lastDate = '';
  for (const msg of currentMessages) {
    const d = dateLabel(msg.created_at);
    if (d !== lastDate) { msgGroups.push({ type: 'sep', label: d }); lastDate = d; }
    msgGroups.push(msg as WorkspaceChatMessage);
  }

  const displayMsgGroups = msgSearch.trim()
    ? msgGroups.filter(item => {
        if ('label' in item) return false;
        const m = item as WorkspaceChatMessage | WorkspaceDMMessage;
        return (m.body ?? '').toLowerCase().includes(msgSearch.toLowerCase());
      })
    : msgGroups;

  const filteredChannels = channels.filter(c =>
    !c.is_archived && c.name.toLowerCase().includes(sidebarSearch.toLowerCase()),
  );
  const filteredDMs = dmConversations.filter(c =>
    senderName(c.user).toLowerCase().includes(sidebarSearch.toLowerCase()),
  );

  const headerTitle = activeDMUserId && activeDMUser
    ? senderName(activeDMUser)
    : activeChannel ? `#${activeChannel.name}` : 'Chat';
  const headerDesc = activeDMUserId ? 'Direct message' : activeChannel?.description ?? '';

  return (
    <div className="-m-6 h-[calc(100vh-40px)] flex overflow-hidden bg-white rounded-none border-0 shadow-none">

      {/* ── Left sidebar ──────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/60">
        <div className="flex items-center justify-between px-3 h-[48px] border-b border-gray-100">
          <h2 className="text-[13px] font-bold text-gray-700">Chat</h2>
          <button onClick={() => setShowNewDM(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  title="New direct message">
            <PenSquare size={14} />
          </button>
        </div>

        <div className="px-2.5 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)}
                   placeholder="Search in chats…"
                   className="flex-1 bg-transparent text-[12.5px] focus:outline-none text-gray-700 placeholder-gray-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Channels */}
          <div className="px-1.5 pt-2.5 pb-1">
            <div className="flex items-center justify-between px-1.5 mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Channels</span>
              {isOwner && (
                <button onClick={() => setShowCreateChannel(true)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400">
                  <Plus size={12} />
                </button>
              )}
            </div>
            {filteredChannels.map(ch => (
              <div key={ch.id} className="group relative mb-0.5">
                <button
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-[12.5px] transition-colors ${
                    activeChannelId === ch.id
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-500 hover:bg-white hover:text-gray-700'
                  }`}
                >
                  <span className="shrink-0 opacity-70">{channelIcon(ch.channel_type, 13)}</span>
                  <span className="truncate flex-1 text-left">{ch.name}</span>
                </button>
                {isOwner && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button onClick={e => { e.stopPropagation(); setEditingChannel(ch); }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                            title="Edit channel">
                      <Edit2 size={10} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteChannel(ch); }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                            title="Delete channel">
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* DMs */}
          <div className="px-1.5 pt-2.5 pb-2">
            <div className="flex items-center justify-between px-1.5 mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Direct Messages</span>
              <button onClick={() => setShowNewDM(true)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400">
                <Plus size={12} />
              </button>
            </div>
            {filteredDMs.slice(0, 6).map(conv => {
              const name = senderName(conv.user);
              return (
                <button key={conv.user.id} onClick={() => selectDM(conv.user)}
                        className={`w-full flex items-center gap-2 px-1.5 py-1 rounded-lg transition-colors mb-0.5 ${
                          activeDMUserId === conv.user.id ? 'bg-primary-50' : 'hover:bg-white'
                        }`}>
                  <div className="relative shrink-0">
                    <Avatar src={conv.user.profile_picture ?? undefined} name={name} size="sm" />
                    {conv.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-600 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-[12.5px] truncate ${activeDMUserId === conv.user.id ? 'text-primary-700 font-semibold' : 'text-gray-700 font-medium'}`}>{name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{conv.last_message}</p>
                  </div>
                </button>
              );
            })}
            {filteredDMs.length === 0 && (
              <p className="text-[12px] text-gray-400 px-2 py-2">No direct messages yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-[48px] bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {!activeDMUserId && activeChannel && (
              <span className="text-gray-400">{channelIcon(activeChannel.channel_type, 16)}</span>
            )}
            {activeDMUserId && activeDMUser && (
              <Avatar src={activeDMUser.profile_picture ?? undefined} name={senderName(activeDMUser)} size="sm" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-bold text-gray-800 truncate">{headerTitle}</p>
                {isMuted && (
                  <span className="flex items-center gap-0.5 text-[10.5px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                    <BellOff size={10} /> Muted
                  </span>
                )}
              </div>
              {headerDesc && <p className="text-[11.5px] text-gray-400 truncate">{headerDesc}</p>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {!activeDMUserId && (
              <span className="text-[12px] text-gray-400 flex items-center gap-1 mr-1">
                <Users size={12} /> {workspace.member_count + 1}
              </span>
            )}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 cursor-not-allowed" title="Call (coming soon)">
              <Phone size={15} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 cursor-not-allowed" title="Video (coming soon)">
              <Video size={15} />
            </button>
            <button onClick={() => setRightOpen(o => !o)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${rightOpen ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
                    title={rightOpen ? 'Close panel' : 'Open panel'}>
              <Info size={15} />
            </button>
            <div className="relative">
              <button ref={moreMenuBtnRef} onClick={() => setShowMoreMenu(o => !o)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showMoreMenu ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      title="More options">
                <MoreHorizontal size={15} />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-[9997]" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-[9998] bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[210px]">
                    <button onClick={() => { setSearchOpen(true); setShowMoreMenu(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 font-medium text-left">
                      <Search size={13} className="opacity-60 shrink-0" /> Search in conversation
                    </button>
                    {!activeDMUserId && pinnedMessages.length > 0 && (
                      <button onClick={() => { setRightOpen(true); setRightTab('details'); setShowMoreMenu(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 font-medium text-left">
                        <Pin size={13} className="opacity-60 shrink-0" /> View pinned ({pinnedMessages.length})
                      </button>
                    )}
                    {activeDMUserId && activeDMUser && (
                      <button onClick={() => { navigate(`/profiles/${activeDMUser.id}`); setShowMoreMenu(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 font-medium text-left">
                        <UserCircle size={13} className="opacity-60 shrink-0" /> View profile
                      </button>
                    )}
                    {activeDMUserId && (
                      <button onClick={markAllRead}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 font-medium text-left">
                        <Check size={13} className="opacity-60 shrink-0" /> Mark all as read
                      </button>
                    )}
                    <button onClick={toggleMute}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 font-medium text-left">
                      {isMuted ? <Bell size={13} className="opacity-60 shrink-0" /> : <BellOff size={13} className="opacity-60 shrink-0" />}
                      {isMuted ? 'Unmute notifications' : 'Mute notifications'}
                    </button>
                    {!activeDMUserId && activeChannelId && isOwner && activeChannel?.channel_type === 'custom' && (
                      <>
                        <hr className="border-gray-100 my-1" />
                        <button onClick={archiveChannel}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-amber-600 hover:bg-amber-50 font-medium text-left">
                          <ChevronDown size={13} className="opacity-70 shrink-0" /> Archive channel
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-2 py-1 bg-white">
          {displayMsgGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                {activeDMUserId ? <MessageSquare size={20} className="text-gray-400" /> : <Hash size={20} className="text-gray-400" />}
              </div>
              <p className="text-[13.5px] font-semibold text-gray-600">
                {activeDMUserId ? 'Start a conversation' : `Welcome to #${activeChannel?.name ?? 'channel'}`}
              </p>
              <p className="text-[12.5px] text-gray-400 mt-1">
                {activeDMUserId ? 'Send a message to get started.' : (activeChannel?.description || 'This is the beginning of this channel.')}
              </p>
            </div>
          )}
          {displayMsgGroups.map((item, i) => {
            if ('label' in item) return <DateSeparator key={`sep-${i}`} label={item.label} />;
            if (activeDMUserId) {
              const dm = item as WorkspaceDMMessage;
              const starId = `dm-${dm.id}`;
              return (
                <DMMessageBubble key={dm.id} dm={dm} currentUserId={user.id} isStarred={starredIds.has(starId)}
                  onEdit={newBody => handleEditDMMessage(dm, newBody)}
                  onUnsend={() => handleUnsendDMMessage(dm)}
                  onForward={() => setForwardPayload({ body: dm.body })}
                  onStar={() => toggleStar(starId)} />
              );
            }
            const msg = item as WorkspaceChatMessage;
            const starId = `ch-${msg.id}`;
            return (
              <MessageBubble key={msg.id} msg={msg} currentUserId={user.id} isOwner={isOwner}
                isStarred={starredIds.has(starId)}
                onReact={emoji => handleReact(msg.id, emoji)}
                onPin={() => handlePin(msg)}
                onDelete={() => handleDeleteMessage(msg)}
                onReply={() => setReplyTo(msg)}
                onEdit={newBody => handleEditChannelMessage(msg, newBody)}
                onForward={() => setForwardPayload({ body: msg.body })}
                onStar={() => toggleStar(starId)} />
            );
          })}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                       style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-[12px] text-gray-400">
                {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <RichTextEditor
          onSend={handleSendRich}
          disabled={sending}
          showAnnouncementTab={!activeDMUserId}
          replyTo={replyTo ?? undefined}
          onCancelReply={() => setReplyTo(null)}
          sendError={sendError}
          onClearError={() => setSendError('')}
          onTyping={() => {
            const now = Date.now();
            if (now - lastTypingSent.current > 2000 && activeChannelId && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'typing' }));
              lastTypingSent.current = now;
            }
          }}
        />
      </div>

      {/* ── Right panel ───────────────────────────────────── */}
      {rightOpen && (
        <div className="w-64 shrink-0 border-l border-gray-100 flex flex-col bg-gray-50/40">
          <div className="flex items-center border-b border-gray-100 px-1 shrink-0 h-[48px]">
            {(['details', 'files', 'polls', ...(isOwner ? ['settings' as const] : [])] as const).map(t => (
              <button key={t} onClick={() => setRightTab(t)}
                      className={`flex-1 h-full text-[11px] font-medium capitalize transition-colors border-b-2 -mb-px ${
                        rightTab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}>
                {t}
              </button>
            ))}
            <button onClick={() => setRightOpen(false)}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 ml-0.5">
              <X size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {rightTab === 'details' && (
              <>
                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">About this chat</h4>
                  {activeChannel ? (
                    <div className="space-y-2">
                      <p className="text-[12.5px] text-gray-600 leading-relaxed">{activeChannel.description || 'No description set.'}</p>
                      <div className="space-y-1.5 text-[12px] text-gray-500">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Created by</span>
                          <span className="font-medium text-gray-700">{workspace.mentor_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Type</span>
                          <span className="font-medium text-gray-700 capitalize">
                            {activeChannel.channel_type === 'general' ? 'Public workspace' : activeChannel.channel_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : activeDMUserId && activeDMUser ? (
                    <p className="text-[12.5px] text-gray-500">Private conversation with <strong>{senderName(activeDMUser)}</strong></p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Members ({workspace.member_count + 1})</h4>
                    <Link to={`/w/${workspace.slug}/members`} className="text-[11px] text-primary-600 hover:text-primary-700">View all</Link>
                  </div>
                  <div className="flex items-center gap-1">
                    {workspace.mentor_picture ? (
                      <img src={workspace.mentor_picture} alt={workspace.mentor_name}
                           className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <Avatar name={workspace.mentor_name} size="sm" />
                    )}
                    <span className="text-[12px] text-gray-500 ml-2">+{workspace.member_count} members</span>
                  </div>
                </div>

                {pinnedMessages.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pinned ({pinnedMessages.length})</h4>
                    <div className="space-y-2">
                      {pinnedMessages.slice(0, 3).map(m => (
                        <div key={m.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                          <Pin size={11} className="text-primary-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-medium text-gray-700">{senderName(m.sender)}</p>
                            <p className="text-[11px] text-gray-500 truncate">{m.body || '(attachment)'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {imageMessages.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Recent media</h4>
                    <div className="grid grid-cols-3 gap-1">
                      {imageMessages.slice(0, 6).map(m => (
                        <a key={m.id} href={m.attachment_url!} target="_blank" rel="noreferrer"
                           className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img src={m.attachment_url!} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {rightTab === 'files' && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Files</h4>
                {fileMessages.length === 0 ? (
                  <p className="text-[12.5px] text-gray-400 text-center py-6">
                    No files shared {activeDMUserId ? 'in this conversation' : 'in this channel'} yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fileMessages.map(m => (
                      <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                          <FileText size={12} className="text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-700 truncate">
                            {m.attachment_name || m.attachment_url?.split('/').pop() || 'File'}
                          </p>
                          <p className="text-[10.5px] text-gray-400">{relativeTime(m.created_at)} · {senderName(m.sender)}</p>
                        </div>
                        <a href={m.attachment_url!} target="_blank" rel="noreferrer"
                           className="text-gray-400 hover:text-gray-600 shrink-0">
                          <Download size={13} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rightTab === 'polls' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Polls</h4>
                  {isOwner && (
                    <button onClick={() => setShowCreatePoll(true)}
                            className="flex items-center gap-1 text-[11.5px] text-primary-600 hover:text-primary-700 font-medium">
                      <Plus size={12} /> New poll
                    </button>
                  )}
                </div>
                {polls.length === 0 ? (
                  <p className="text-[12.5px] text-gray-400 text-center py-6">No polls yet.</p>
                ) : (
                  <div className="space-y-3">
                    {polls.map(p => (
                      <PollCard key={p.id} poll={p} workspaceId={workspace.id} currentUserId={user.id}
                                isOwner={isOwner} onVote={handleVote} onClose={handleClosePoll} onDelete={handleDeletePoll} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {rightTab === 'settings' && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Channel Settings</h4>
                {!activeChannel ? (
                  <p className="text-[12.5px] text-gray-400">No channel selected.</p>
                ) : !isOwner ? (
                  <p className="text-[12.5px] text-gray-400">Only the workspace owner can change settings.</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Channel name</label>
                      <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500">
                        <Hash size={12} className="text-gray-400 shrink-0" />
                        <input value={channelSettingName} onChange={e => setChannelSettingName(e.target.value)}
                               className="flex-1 text-[13px] focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Description</label>
                      <textarea value={channelSettingDesc} onChange={e => setChannelSettingDesc(e.target.value)}
                                rows={3} className="mt-1 w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <button onClick={saveChannelSettings} disabled={savingSettings}
                            className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white text-[12.5px] font-semibold rounded-lg disabled:opacity-50 transition-colors">
                      {savingSettings ? 'Saving…' : 'Save changes'}
                    </button>
                    <hr className="border-gray-100" />
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Danger zone</p>
                      {activeChannel.channel_type === 'custom' && (
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this channel and all its messages?')) return;
                            try {
                              await apiClient.initCsrf();
                              await workspacesApi.deleteChannel(workspace.id, activeChannelId!);
                              setChannels(prev => prev.filter(c => c.id !== activeChannelId));
                              setActiveChannelId(channels.filter(c => c.id !== activeChannelId)[0]?.id ?? null);
                            } catch { /* ignore */ }
                          }}
                          className="w-full py-1.5 border border-red-200 text-red-600 text-[12.5px] font-semibold rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Delete channel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {showCreateChannel && (
        <CreateChannelModal workspaceId={workspace.id} onClose={() => setShowCreateChannel(false)}
          onCreated={ch => { setChannels(prev => [...prev, ch]); setActiveChannelId(ch.id); setShowCreateChannel(false); }} />
      )}
      {showCreatePoll && (
        <CreatePollModal workspaceId={workspace.id} onClose={() => setShowCreatePoll(false)}
          onCreated={poll => { setPolls(prev => [poll, ...prev]); setShowCreatePoll(false); }} />
      )}
      {showNewDM && user && (
        <NewDMModal workspace={workspace} currentUser={user} onSelect={selectDM} onClose={() => setShowNewDM(false)} />
      )}
      {forwardPayload && (
        <ForwardMessageModal body={forwardPayload.body} channels={channels} dmConversations={dmConversations}
          currentUser={user} onClose={() => setForwardPayload(null)}
          onForward={target => { handleForward(target, forwardPayload.body); setForwardPayload(null); }} />
      )}
      {editingChannel && (
        <EditChannelModal channel={editingChannel} workspaceId={workspace.id}
          onClose={() => setEditingChannel(null)}
          onSaved={updated => { setChannels(prev => prev.map(c => c.id === updated.id ? updated : c)); setEditingChannel(null); }} />
      )}
      {confirmDeleteChannel && (
        <ConfirmDialog title="Delete channel"
          message={`Are you sure you want to delete #${confirmDeleteChannel.name}? All messages in this channel will be permanently lost.`}
          confirmLabel="Delete" danger
          onConfirm={() => handleDeleteChannel(confirmDeleteChannel)}
          onCancel={() => setConfirmDeleteChannel(null)} />
      )}
      {searchOpen && (
        <SearchMessagesModal messages={messages} dmMessages={dmMessages} isDM={!!activeDMUserId}
          onClose={() => setSearchOpen(false)} />
      )}
    </div>
  );
}
