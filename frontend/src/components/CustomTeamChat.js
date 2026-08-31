import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';

// ── Constants ────────────────────────────────────────────────────────────────
const CHANNELS = [
  { id: 'general',    name: 'General',     emoji: '💬', desc: 'General team discussion' },
  { id: 'random',     name: 'Random',      emoji: '🎲', desc: 'Off-topic conversations' },
  { id: 'technical',  name: 'Technical',   emoji: '💻', desc: 'Technical topics & debugging' },
  { id: 'workorders', name: 'Work Orders', emoji: '🔧', desc: 'Work order coordination' },
  { id: 'alerts',     name: 'Alerts',      emoji: '🔔', desc: 'System alert discussions' },
];

const QUICK_REACTIONS = ['👍','❤️','😂','🔥','✅','⚠️'];

const USER_COLORS = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#ff5722','#607d8b'
];

const SLASH_COMMANDS = [
  { cmd: '/wo create',   hint: '<assetId> <description>',  desc: 'Create a work order' },
  { cmd: '/wo list',     hint: '[status]',                 desc: 'List recent work orders' },
  { cmd: '/wo status',   hint: '<wonum> <STATUS>',         desc: 'Update work order status' },
  { cmd: '/alert list',  hint: '',                         desc: 'Show active alerts' },
  { cmd: '/alert ack',   hint: '<alertId>',                desc: 'Acknowledge an alert' },
  { cmd: '/energy',      hint: '',                         desc: 'Live energy snapshot' },
  { cmd: '/assets',      hint: '',                         desc: 'Critical asset health' },
  { cmd: '/help',        hint: '',                         desc: 'Show all commands' },
];

function getUserColor(id) {
  let h = 0;
  String(id).split('').forEach(c => { h = c.charCodeAt(0) + ((h << 5) - h); });
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}
function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}
function formatTime(ts) {
  const d = new Date(ts), now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday '+d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  return d.toLocaleDateString([], { month:'short', day:'numeric' })+' '+d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function formatDateLabel(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' });
}
function isDifferentDay(a, b) {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}
function groupable(prev, curr) {
  if (!prev || prev.isSystem || curr.isSystem) return false;
  if (prev.userId !== curr.userId) return false;
  if (isDifferentDay(prev.timestamp, curr.timestamp)) return false;
  return (curr.timestamp - prev.timestamp) < 5 * 60 * 1000;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = {
  Send:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Edit:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Pin:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>,
  Reply:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>,
  Close:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Hash:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  Search:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Members: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Cmd:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Smile:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  Log:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, userId, size = 36, online }) {
  const color = getUserColor(userId || name || '');
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:'50%',
        background:`linear-gradient(135deg,${color},${color}99)`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#fff', fontSize:size*0.38, fontWeight:700, userSelect:'none',
        boxShadow:'0 1px 4px rgba(0,0,0,0.35)',
      }}>
        {getInitials(name)}
      </div>
      {online !== undefined && (
        <div style={{
          position:'absolute', bottom:0, right:0,
          width:size*0.3, height:size*0.3, borderRadius:'50%',
          background:online ? '#23a55a' : '#80848e',
          border:'2px solid #121822',
        }} />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TeamChat({ userRole, currentUser }) {
  const { socket, isConnected } = useSocketContext();
  const authHeader = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

  // State
  const [messages,       setMessages]       = useState([]);
  const [onlineUsers,    setOnlineUsers]     = useState([]);
  const [pinnedMessages, setPinnedMessages]  = useState([]);
  const [typingUsers,    setTypingUsers]     = useState([]);
  const [channel,        setChannel]         = useState('general');
  const [input,          setInput]           = useState('');
  const [replyTo,        setReplyTo]         = useState(null);
  const [editingId,      setEditingId]       = useState(null);
  const [editContent,    setEditContent]     = useState('');
  const [loading,        setLoading]         = useState(false);
  const [hasMore,        setHasMore]         = useState(false);
  const [showPinned,     setShowPinned]      = useState(false);
  const [showMembers,    setShowMembers]     = useState(false);
  const [showCmdLog,     setShowCmdLog]      = useState(false);
  const [cmdLog,         setCmdLog]          = useState([]);
  const [unread,         setUnread]          = useState({});
  const [notification,   setNotification]    = useState(null);
  const [channelStats,   setChannelStats]    = useState({});
  const [cmdSuggest,     setCmdSuggest]      = useState([]);
  const [cmdSuggestIdx,  setCmdSuggestIdx]   = useState(0);
  const [emojiPicker,    setEmojiPicker]     = useState(null); // messageId

  const endRef      = useRef(null);
  const inputRef    = useRef(null);
  const typingTimer = useRef({});
  const channelRef  = useRef(channel);
  const loadingRef  = useRef(false);
  channelRef.current = channel;

  // ── Load history from DB ───────────────────────────────────────────────────
  const loadHistory = useCallback(async (ch, beforeId = null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url = `/api/chat/history/${ch}?limit=80${beforeId ? `&before=${beforeId}` : ''}`;
      const res = await fetch(url, { headers: authHeader() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (beforeId) {
        setMessages(prev => [...data, ...prev]);
        setHasMore(data.length === 80);
      } else {
        setMessages(data);
        setHasMore(data.length === 80);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
      }
    } catch(e) { console.error('[Chat]', e); }
    finally { setLoading(false); loadingRef.current = false; }
  }, []);

  const loadPinned = useCallback(async (ch) => {
    try {
      const res = await fetch(`/api/chat/pinned/${ch}`, { headers: authHeader() });
      if (res.ok) setPinnedMessages(await res.json());
    } catch {}
  }, []);

  const loadOnlineUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/online', { headers: authHeader() });
      if (res.ok) setOnlineUsers(await res.json());
    } catch {}
  }, []);

  const loadChannelStats = useCallback(async (ch) => {
    try {
      const res = await fetch(`/api/chat/stats/${ch}`, { headers: authHeader() });
      if (res.ok) setChannelStats(await res.json());
    } catch {}
  }, []);

  const loadCmdLog = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/commands?limit=50', { headers: authHeader() });
      if (res.ok) setCmdLog(await res.json());
    } catch {}
  }, []);

  // ── Channel switch ──────────────────────────────────────────────────────────
  useEffect(() => {
    setMessages([]);
    setPinnedMessages([]);
    setReplyTo(null);
    setEditingId(null);
    setShowPinned(false);
    setCmdSuggest([]);
    loadHistory(channel);
    loadPinned(channel);
    loadChannelStats(channel);
    setUnread(prev => ({ ...prev, [channel]: 0 }));
  }, [channel, loadHistory, loadPinned, loadChannelStats]);

  useEffect(() => { loadOnlineUsers(); }, [loadOnlineUsers]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handlers = {
      'chat:message': (msg) => {
        if (msg.channel === channelRef.current) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        } else {
          setUnread(prev => ({ ...prev, [msg.channel]: (prev[msg.channel]||0)+1 }));
          if (msg.userId !== currentUser?.id && !msg.isSystem) {
            setNotification({ username: msg.username, content: msg.content, channel: msg.channel });
            setTimeout(() => setNotification(null), 4000);
          }
        }
      },
      'chat:typing': (d) => {
        if (d.channel !== channelRef.current || d.userId === currentUser?.id) return;
        setTypingUsers(prev => {
          const f = prev.filter(u => u.userId !== d.userId);
          return [...f, { userId: d.userId, username: d.username }];
        });
        clearTimeout(typingTimer.current[d.userId]);
        typingTimer.current[d.userId] = setTimeout(() =>
          setTypingUsers(prev => prev.filter(u => u.userId !== d.userId)), 3500);
      },
      'chat:user:online':  (u) => setOnlineUsers(prev => [...prev.filter(x => x.id !== u.id), u]),
      'chat:user:offline': ({ id }) => setOnlineUsers(prev => prev.map(u => u.id === id ? { ...u, is_online: false } : u)),
      'chat:message:delete': ({ messageId }) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
      },
      'chat:message:edit': ({ messageId, content }) =>
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, edited: true } : m)),
      'chat:message:pin': ({ messageId, pinned }) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned } : m));
        loadPinned(channelRef.current);
      },
      'chat:reaction:add': ({ messageId, emoji, userId, username }) => {
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions = m.reactions || [];
          const idx = reactions.findIndex(r => r.emoji === emoji);
          if (idx >= 0) {
            const updated = [...reactions];
            updated[idx] = { ...updated[idx], count: updated[idx].count + 1, users: [...(updated[idx].users||[]), username] };
            return { ...m, reactions: updated };
          }
          return { ...m, reactions: [...reactions, { emoji, count: 1, users: [username] }] };
        }));
      },
      'chat:reaction:remove': ({ messageId, userId, emoji }) => {
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions = (m.reactions||[]).map(r => r.emoji !== emoji ? r : { ...r, count: r.count - 1 })
                                              .filter(r => r.count > 0);
          return { ...m, reactions };
        }));
      },
      'workorder:created': (wo) => {
        if (channelRef.current === 'workorders') {
          const sysMsg = {
            id: 'sys-wo-'+Date.now(), channel: 'workorders', isSystem: true,
            content: `🔧 **Work Order ${wo.wonum}** — ${wo.description||''} [${wo.status}] by ${wo.createdBy||'System'}`,
            userId: 'system', username: '⚙ System', timestamp: Date.now(),
          };
          setMessages(prev => [...prev, sysMsg]);
        }
      },
    };
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
  }, [socket, currentUser?.id, loadPinned]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !socket || !isConnected) return;
    socket.emit('chat:message', { channel, content: text, replyTo });
    setInput('');
    setReplyTo(null);
    setCmdSuggest([]);
    inputRef.current?.focus();
  }, [input, socket, isConnected, channel, replyTo]);

  // ── Input change with slash autocomplete ───────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    // Slash command autocomplete
    if (val.startsWith('/')) {
      const matches = SLASH_COMMANDS.filter(c =>
        c.cmd.startsWith(val.toLowerCase()) ||
        (val.split(' ').length <= c.cmd.split(' ').length && c.cmd.startsWith(val.toLowerCase().split(' ')[0]))
      );
      setCmdSuggest(matches);
      setCmdSuggestIdx(0);
    } else {
      setCmdSuggest([]);
    }

    // Typing indicator
    if (socket && isConnected && !val.startsWith('/')) {
      socket.emit('chat:typing', { channel, userId: currentUser?.id, username: currentUser?.name });
    }
  };

  const handleKeyDown = (e) => {
    if (cmdSuggest.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdSuggestIdx(i => Math.min(i+1, cmdSuggest.length-1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdSuggestIdx(i => Math.max(i-1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && cmdSuggest.length > 0)) {
        e.preventDefault();
        const chosen = cmdSuggest[cmdSuggestIdx];
        setInput(chosen.cmd + (chosen.hint ? ' ' : ''));
        setCmdSuggest([]);
        inputRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') { setCmdSuggest([]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Message actions ────────────────────────────────────────────────────────
  const deleteMessage = (id) => {
    if (!socket) return;
    socket.emit('chat:message:delete', { messageId: id, channel });
  };
  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
    setTimeout(() => document.getElementById('edit-'+msg.id)?.focus(), 50);
  };
  const submitEdit = (id) => {
    if (!editContent.trim() || !socket) return;
    socket.emit('chat:message:edit', { messageId: id, content: editContent.trim() });
    setEditingId(null);
  };
  const togglePin = (id) => socket?.emit('chat:message:pin', { messageId: id, channel });
  const toggleReaction = (messageId, emoji) => {
    if (!socket) return;
    socket.emit('chat:reaction', { messageId, emoji });
    setEmojiPicker(null);
  };

  // ── Message content renderer (bold, code) ─────────────────────────────────
  function renderContent(text) {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
    return parts.map((p, i) => {
      if (p === '\n') return <br key={i}/>;
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2,-2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`'))   return <code key={i} style={S.inlineCode}>{p.slice(1,-1)}</code>;
      return p;
    });
  }

  // ── Render one message ─────────────────────────────────────────────────────
  const renderMessage = (msg, idx, all) => {
    const prev    = all[idx-1];
    const grouped = groupable(prev, msg);
    const isOwn   = String(msg.userId) === String(currentUser?.id);
    const isBot   = msg.userId === 'bot' || msg.userId === 'system' || msg.username === '⚙ System';
    const canEdit   = isOwn && !isBot;
    const canDelete = isOwn || userRole === 'it_admin';
    const canPin    = ['it_admin','maintenance_engineer'].includes(userRole);

    if (msg.isSystem) {
      return (
        <div key={msg.id} style={S.sysMsg}>
          <div style={S.sysLine}/>
          <span style={S.sysTxt}>{renderContent(msg.content)}</span>
          <div style={S.sysLine}/>
        </div>
      );
    }

    const showDivider = !prev || isDifferentDay(msg.timestamp, prev.timestamp);

    return (
      <React.Fragment key={msg.id}>
        {showDivider && (
          <div style={S.dateDivider}>
            <div style={S.dateLine}/>
            <span style={S.dateLabel}>{formatDateLabel(msg.timestamp)}</span>
            <div style={S.dateLine}/>
          </div>
        )}
        <div
          style={{ ...S.msgRow, paddingTop: grouped ? 2 : 12 }}
          className="msg-row"
          onMouseLeave={() => setEmojiPicker(null)}
        >
          {/* Avatar or time spacer */}
          <div style={S.avatarCol}>
            {!grouped
              ? <Avatar name={msg.username} userId={String(msg.userId)} size={36}/>
              : <span style={S.groupedTs}>{new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            }
          </div>

          <div style={S.msgContent}>
            {!grouped && (
              <div style={S.msgHeader}>
                <span style={{ ...S.msgName, color: isBot ? '#faa61a' : getUserColor(String(msg.userId)) }}>
                  {msg.username}
                </span>
                <span style={S.msgTs}>{formatTime(msg.timestamp)}</span>
                {msg.pinned && <span style={S.pinBadge}>📌</span>}
                {msg.edited && <span style={S.editedBadge}>(edited)</span>}
              </div>
            )}

            {/* Reply reference */}
            {msg.replyTo && (
              <div style={S.replyRef}>
                <div style={{ ...S.replyBar, background: getUserColor(String(msg.replyTo.userId||'')) }}/>
                <span style={S.replyUser}>@{msg.replyTo.username}</span>
                <span style={S.replyText}>{msg.replyTo.content?.slice(0,80)}</span>
              </div>
            )}

            {/* Body */}
            {editingId === msg.id ? (
              <div style={S.editBox}>
                <textarea
                  id={'edit-'+msg.id}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); }
                    if (e.key === 'Escape') { setEditingId(null); }
                  }}
                  rows={2}
                  style={S.editInput}
                />
                <div style={S.editHint}>
                  <span>Enter to save · Esc to cancel</span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setEditingId(null)} style={S.editCancelBtn}>Cancel</button>
                    <button onClick={() => submitEdit(msg.id)} style={S.editSaveBtn}>Save</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={S.msgBody}>{renderContent(msg.content)}</div>
            )}

            {/* Reactions */}
            {(msg.reactions||[]).length > 0 && (
              <div style={S.reactions}>
                {msg.reactions.map(r => (
                  <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)} style={S.reactionBtn} title={r.users?.join(', ')}>
                    {r.emoji} {r.count}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hover actions */}
          {editingId !== msg.id && (
            <div className="msg-actions" style={S.msgActions}>
              {/* Quick reactions */}
              {QUICK_REACTIONS.map(e => (
                <button key={e} onClick={() => toggleReaction(msg.id, e)} style={{ ...S.actionBtn, fontSize:13 }} title={`React ${e}`}>
                  {e}
                </button>
              ))}
              <div style={S.actionDivider}/>
              <button onClick={() => setReplyTo({ id: msg.id, userId: msg.userId, username: msg.username, content: msg.content })} style={S.actionBtn} title="Reply">
                <I.Reply/>
              </button>
              {canPin && <button onClick={() => togglePin(msg.id)} style={{ ...S.actionBtn, color: msg.pinned ? '#faa61a' : undefined }} title={msg.pinned ? 'Unpin' : 'Pin'}><I.Pin/></button>}
              {canEdit && <button onClick={() => startEdit(msg)} style={S.actionBtn} title="Edit"><I.Edit/></button>}
              {canDelete && <button onClick={() => { if (window.confirm('Delete?')) deleteMessage(msg.id); }} style={{ ...S.actionBtn, color:'#E6484B' }} title="Delete"><I.Trash/></button>}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };

  const channelInfo = CHANNELS.find(c => c.id === channel);

  return (
    <div style={S.root}>
      <style>{`
        .msg-row { transition: background 0.08s; }
        .msg-row:hover { background: rgba(4,4,5,0.07) !important; }
        .msg-row:hover .msg-actions { opacity:1 !important; }
        .msg-row:hover .grouped-ts { color:#8493A6 !important; }
        .chan-item:hover { background:rgba(255,255,255,0.09) !important; }
        @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        scrollbar-width: thin;
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-thumb { background:#1e1f22; border-radius:3px; }
      `}</style>

      {/* Toast */}
      {notification && (
        <div style={S.toast}>
          <Avatar name={notification.username} userId={notification.username} size={28}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={S.toastTitle}><strong>{notification.username}</strong> <span style={{ color:'#8493A6', fontSize:11 }}>#{notification.channel}</span></div>
            <div style={S.toastBody}>{notification.content?.slice(0,70)}</div>
          </div>
          <button onClick={() => setNotification(null)} style={S.toastClose}><I.Close/></button>
        </div>
      )}

      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={{ color:'#fff', fontWeight:800, fontSize:15, letterSpacing:'-0.3px' }}>Smart Dashboard</div>
          <div style={{ color:'#8493A6', fontSize:11, marginTop:2 }}>Team Workspace</div>
        </div>

        <div style={S.sidebarSection}>
          <div style={S.sectionLabel}>Channels</div>
          {CHANNELS.map(ch => {
            const active = channel === ch.id;
            const badge  = unread[ch.id] || 0;
            return (
              <div key={ch.id} className="chan-item" onClick={() => setChannel(ch.id)} style={{
                ...S.chanItem,
                background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
                color: active ? '#fff' : badge > 0 ? '#e0e0e0' : '#8e9297',
                fontWeight: badge > 0 || active ? 600 : 400,
              }}>
                <span style={{ color:'#8493A6', flexShrink:0 }}><I.Hash/></span>
                <span style={{ flex:1 }}>{ch.name}</span>
                {badge > 0 && !active && <span style={S.badge}>{badge > 99 ? '99+' : badge}</span>}
                {active && <span style={S.activeBar}/>}
              </div>
            );
          })}
        </div>

        <div style={{ ...S.sidebarSection, flex:1, overflowY:'auto' }}>
          <div style={S.sectionLabel}>Online — {onlineUsers.filter(u => u.is_online).length}</div>
          {onlineUsers.filter(u => u.is_online).slice(0, 10).map(u => (
            <div key={u.id} style={S.memberItem}>
              <Avatar name={u.name} userId={String(u.id)} size={28} online={true}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'#c4c9d4', fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</div>
                <div style={{ color:'#8493A6', fontSize:11 }}>{u.role?.replace(/_/g,' ')}</div>
              </div>
            </div>
          ))}
        </div>

        {currentUser && (
          <div style={S.selfArea}>
            <Avatar name={currentUser.name} userId={String(currentUser.id)} size={32} online={isConnected}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#e0e0e0', fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{currentUser.name}</div>
              <div style={{ fontSize:11, color: isConnected ? '#23a55a' : '#E6484B' }}>{isConnected ? '● Online' : '● Offline'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main chat */}
      <div style={S.main}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ color:'#8493A6' }}><I.Hash/></span>
            <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>{channelInfo?.name}</span>
            {channelInfo?.desc && <>
              <div style={{ width:1, height:18, background:'rgba(255,255,255,0.15)', margin:'0 6px' }}/>
              <span style={{ color:'#8493A6', fontSize:13 }}>{channelInfo.desc}</span>
            </>}
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            {/* Channel stats pill */}
            {channelStats.total > 0 && (
              <span style={S.statsPill}>{channelStats.today} today · {channelStats.total} total · {channelStats.commands} cmds</span>
            )}
            <button onClick={() => setShowPinned(v => !v)} style={{ ...S.headerBtn, color: showPinned ? '#fff' : '#8493A6' }} title="Pinned">
              <I.Pin/>
              {pinnedMessages.length > 0 && <span style={S.headerBadge}>{pinnedMessages.length}</span>}
            </button>
            <button onClick={() => setShowMembers(v => !v)} style={{ ...S.headerBtn, color: showMembers ? '#fff' : '#8493A6' }} title="Members">
              <I.Members/>
            </button>
            {userRole === 'it_admin' && (
              <button onClick={() => { setShowCmdLog(v => !v); if (!showCmdLog) loadCmdLog(); }} style={{ ...S.headerBtn, color: showCmdLog ? '#faa61a' : '#8493A6' }} title="Command log">
                <I.Log/>
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Messages area */}
          <div style={S.messagesArea}>
            {/* Pinned panel */}
            {showPinned && pinnedMessages.length > 0 && (
              <div style={S.pinnedPanel}>
                <div style={S.pinnedHeader}>📌 {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's':''}</div>
                {pinnedMessages.map(pm => (
                  <div key={pm.id} style={S.pinnedItem}>
                    <Avatar name={pm.username} userId={String(pm.userId)} size={22}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ color:'#fff', fontWeight:600, fontSize:12, marginRight:6 }}>{pm.username}</span>
                      <span style={{ color:'#8493A6', fontSize:13 }}>{pm.content?.slice(0,100)}</span>
                    </div>
                    <span style={{ color:'#8493A6', fontSize:11 }}>{formatTime(pm.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <button onClick={() => messages.length && loadHistory(channel, messages[0].id)} disabled={loading} style={S.loadMoreBtn}>
                  {loading ? 'Loading…' : '↑ Load earlier messages'}
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && messages.length === 0 && (
              <div style={{ padding:'40px 20px' }}>
                <div style={{ fontSize:56, marginBottom:12 }}>{channelInfo?.emoji}</div>
                <div style={{ color:'#fff', fontSize:24, fontWeight:800, marginBottom:6 }}>Welcome to #{channelInfo?.name}!</div>
                <div style={{ color:'#8493A6', fontSize:14 }}>{channelInfo?.desc} — Be the first to send a message. Try <code style={S.inlineCode}>/help</code> for commands.</div>
              </div>
            )}

            {loading && messages.length === 0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'#8493A6' }}>
                <div style={S.spinner}/>
                <span>Loading messages from database…</span>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => renderMessage(msg, i, messages))}

            {/* Typing */}
            {typingUsers.length > 0 && (
              <div style={S.typingRow}>
                <div style={S.typingDots}>
                  {[0,1,2].map(i => <span key={i} style={{ ...S.dot, animationDelay:`${i*0.15}s` }}/>)}
                </div>
                <span style={{ color:'#8493A6', fontSize:13 }}>
                  <strong style={{ color:'#E8EEF4' }}>{typingUsers.map(u => u.username).join(', ')}</strong>
                  {typingUsers.length === 1 ? ' is' : ' are'} typing…
                </span>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Members sidebar */}
          {showMembers && (
            <div style={S.memberSidebar}>
              <div style={S.sectionLabel}>Members</div>
              <div style={S.sectionLabel}>Online — {onlineUsers.filter(u=>u.is_online).length}</div>
              {onlineUsers.filter(u=>u.is_online).map(u => (
                <div key={u.id} style={S.memberSidebarItem}>
                  <Avatar name={u.name} userId={String(u.id)} size={32} online={true}/>
                  <div>
                    <div style={{ color:getUserColor(String(u.id)), fontSize:13, fontWeight:600 }}>{u.name}</div>
                    <div style={{ color:'#8493A6', fontSize:11 }}>{u.role?.replace(/_/g,' ')}</div>
                  </div>
                </div>
              ))}
              {onlineUsers.filter(u=>!u.is_online).length > 0 && <>
                <div style={{ ...S.sectionLabel, marginTop:12 }}>Offline — {onlineUsers.filter(u=>!u.is_online).length}</div>
                {onlineUsers.filter(u=>!u.is_online).slice(0,5).map(u => (
                  <div key={u.id} style={{ ...S.memberSidebarItem, opacity:0.5 }}>
                    <Avatar name={u.name} userId={String(u.id)} size={32} online={false}/>
                    <div>
                      <div style={{ color:'#8493A6', fontSize:13, fontWeight:600 }}>{u.name}</div>
                      <div style={{ color:'#52545c', fontSize:11 }}>{u.role?.replace(/_/g,' ')}</div>
                    </div>
                  </div>
                ))}
              </>}
            </div>
          )}

          {/* Command log (admin only) */}
          {showCmdLog && userRole === 'it_admin' && (
            <div style={S.cmdLogPanel}>
              <div style={S.sectionLabel}>Command Log</div>
              {cmdLog.length === 0 && <div style={{ color:'#8493A6', fontSize:12, padding:'8px 0' }}>No commands logged yet.</div>}
              {cmdLog.map(entry => (
                <div key={entry.id} style={S.cmdLogItem}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ color:'#E8EEF4', fontSize:12, fontWeight:600 }}>{entry.username}</span>
                    <span style={{ color:'#8493A6', fontSize:10 }}>#{entry.channel} · {entry.created_at?.slice(5,16)}</span>
                  </div>
                  <div style={{ color:'#faa61a', fontSize:12, fontFamily:'monospace', marginBottom:3 }}>{entry.command}</div>
                  <div style={{ color:'#8493A6', fontSize:11 }}>{entry.result?.slice(0,120)}{entry.result?.length > 120 ? '…':''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reply banner */}
        {replyTo && (
          <div style={S.replyBanner}>
            <I.Reply/>
            <span style={{ color:'#8493A6', marginLeft:6 }}>Replying to </span>
            <strong style={{ color: getUserColor(String(replyTo.userId)), marginLeft:3 }}>@{replyTo.username}</strong>
            <span style={{ color:'#8493A6', fontStyle:'italic', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginLeft:8 }}>
              "{replyTo.content?.slice(0,60)}"
            </span>
            <button onClick={() => setReplyTo(null)} style={{ ...S.toastClose, marginLeft:8 }}><I.Close/></button>
          </div>
        )}

        {/* Slash command suggestions */}
        {cmdSuggest.length > 0 && (
          <div style={S.cmdSuggest}>
            {cmdSuggest.map((c, i) => (
              <div
                key={c.cmd}
                style={{ ...S.cmdSuggestItem, background: i === cmdSuggestIdx ? 'rgba(88,101,242,0.2)' : 'transparent' }}
                onMouseDown={e => { e.preventDefault(); setInput(c.cmd+(c.hint?' ':'')); setCmdSuggest([]); inputRef.current?.focus(); }}
              >
                <span style={{ color:'#5865f2', fontFamily:'monospace', fontSize:13, fontWeight:700 }}>{c.cmd}</span>
                {c.hint && <span style={{ color:'#8493A6', fontSize:12, marginLeft:6 }}>{c.hint}</span>}
                <span style={{ color:'#8493A6', fontSize:12, marginLeft:'auto' }}>{c.desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div style={S.inputArea}>
          <div style={S.inputBox}>
            <span style={{ color:'#8493A6', padding:'0 4px 0 4px', flexShrink:0 }}><I.Cmd/></span>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? `Message #${channelInfo?.name} — use /help for commands` : 'Reconnecting…'}
              disabled={!isConnected}
              rows={1}
              style={S.textarea}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 180)+'px';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              style={{
                ...S.sendBtn,
                background: input.trim() && isConnected ? '#5865f2' : 'transparent',
                color: input.trim() && isConnected ? '#fff' : '#5B6B7D',
              }}
            >
              <I.Send/>
            </button>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4, padding:'0 2px', color:'#5B6B7D' }}>
            <span>Enter ↵ to send · Shift+Enter for new line · Tab to autocomplete commands</span>
            {!isConnected && <span style={{ color:'#E6484B' }}>⚠ Disconnected</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: {
    display:'flex', height:'calc(100vh - 116px)', minHeight:500,
    background:'#313338', borderRadius:12, overflow:'hidden',
    fontFamily:"'gg sans','Noto Sans','Helvetica Neue',Helvetica,Arial,sans-serif",
    boxShadow:'0 4px 32px rgba(0,0,0,0.4)',
  },
  sidebar: { width:240, minWidth:240, background:'#121822', display:'flex', flexDirection:'column', overflow:'hidden' },
  sidebarHeader: { padding:'16px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 },
  sidebarSection: { padding:'12px 8px 4px' },
  sectionLabel: { color:'#8493A6', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', padding:'0 8px 6px' },
  chanItem: {
    display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
    borderRadius:6, cursor:'pointer', fontSize:15, transition:'background 0.1s',
    position:'relative', userSelect:'none',
  },
  badge: { background:'#E6484B', color:'#fff', fontSize:10, fontWeight:700, borderRadius:10, padding:'1px 5px', minWidth:16, textAlign:'center' },
  activeBar: { position:'absolute', left:-8, width:3, height:16, background:'#fff', borderRadius:2 },
  memberItem: { display:'flex', alignItems:'center', gap:8, padding:'4px 8px', borderRadius:6 },
  selfArea: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'#232428', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#313338' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', height:48, borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0, boxShadow:'0 1px 0 rgba(4,4,5,0.2)' },
  headerBtn: { background:'none', border:'none', cursor:'pointer', padding:'5px 7px', borderRadius:5, display:'flex', alignItems:'center', position:'relative', transition:'background 0.1s' },
  headerBadge: { position:'absolute', top:2, right:2, background:'#E6484B', color:'#fff', fontSize:9, fontWeight:700, borderRadius:8, padding:'0 3px', minWidth:12, textAlign:'center' },
  statsPill: { color:'#8493A6', fontSize:11, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', padding:'3px 9px', borderRadius:12, marginRight:4 },
  messagesArea: { flex:1, overflowY:'auto', padding:'8px 0', scrollbarWidth:'thin' },
  dateDivider: { display:'flex', alignItems:'center', gap:8, padding:'12px 16px 4px' },
  dateLine: { flex:1, height:1, background:'rgba(255,255,255,0.07)' },
  dateLabel: { color:'#8493A6', fontSize:12, fontWeight:600, whiteSpace:'nowrap' },
  sysMsg: { display:'flex', alignItems:'center', gap:8, padding:'6px 16px', fontSize:13 },
  sysLine: { flex:1, height:1, background:'rgba(255,255,255,0.06)' },
  sysTxt: { color:'#8493A6', whiteSpace:'nowrap', flexShrink:0 },
  msgRow: { display:'flex', gap:12, padding:'0 16px', position:'relative', borderRadius:3 },
  avatarCol: { width:40, flexShrink:0, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:2 },
  groupedTs: { fontSize:10, color:'transparent', lineHeight:'20px', paddingTop:4, width:40, textAlign:'center', transition:'color 0.1s', className:'grouped-ts' },
  msgContent: { flex:1, minWidth:0 },
  msgHeader: { display:'flex', alignItems:'baseline', gap:8, marginBottom:2 },
  msgName: { fontSize:15, fontWeight:600, cursor:'pointer' },
  msgTs: { fontSize:11, color:'#8493A6' },
  pinBadge: { fontSize:12, color:'#faa61a' },
  editedBadge: { fontSize:10, color:'#8493A6' },
  msgBody: { color:'#E8EEF4', fontSize:15, lineHeight:1.45, wordBreak:'break-word', whiteSpace:'pre-wrap' },
  inlineCode: { background:'rgba(255,255,255,0.07)', color:'#c9d1d9', fontFamily:'monospace', fontSize:13, padding:'1px 5px', borderRadius:4 },
  replyRef: { display:'flex', alignItems:'center', gap:6, marginBottom:4, fontSize:13, color:'#8493A6', maxWidth:'100%', overflow:'hidden' },
  replyBar: { width:3, minHeight:20, borderRadius:2, flexShrink:0, alignSelf:'stretch' },
  replyUser: { color:'#c4c9d4', fontWeight:600, flexShrink:0 },
  replyText: { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 },
  reactions: { display:'flex', flexWrap:'wrap', gap:4, marginTop:4 },
  reactionBtn: { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'2px 7px', cursor:'pointer', fontSize:13, color:'#E8EEF4', transition:'background 0.1s' },
  msgActions: { position:'absolute', right:16, top:-10, display:'flex', background:'#121822', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.45)', zIndex:10, opacity:0, transition:'opacity 0.1s' },
  actionBtn: { background:'none', border:'none', cursor:'pointer', color:'#8493A6', padding:'6px 7px', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.1s' },
  actionDivider: { width:1, background:'rgba(255,255,255,0.08)', margin:'4px 0' },
  editBox: { marginTop:2 },
  editInput: { width:'100%', padding:'8px 10px', background:'#383a40', border:'1px solid #5865f2', borderRadius:6, color:'#E8EEF4', fontSize:15, fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' },
  editHint: { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4, fontSize:11, color:'#8493A6' },
  editCancelBtn: { background:'none', border:'none', color:'#8493A6', cursor:'pointer', fontSize:12, fontFamily:'inherit' },
  editSaveBtn: { background:'#5865f2', border:'none', color:'#fff', padding:'3px 10px', borderRadius:4, cursor:'pointer', fontSize:12, fontFamily:'inherit' },
  typingRow: { display:'flex', alignItems:'center', gap:6, padding:'0 16px 8px', minHeight:28 },
  typingDots: { display:'flex', gap:3, alignItems:'center' },
  dot: { width:6, height:6, borderRadius:'50%', background:'#8493A6', display:'inline-block', animation:'bounce 1.2s infinite ease-in-out' },
  pinnedPanel: { margin:'0 16px 10px', background:'#121822', borderRadius:8, border:'1px solid rgba(255,255,255,0.09)', overflow:'hidden', animation:'slideUp 0.15s ease' },
  pinnedHeader: { padding:'8px 12px', color:'#faa61a', fontSize:12, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.07)' },
  pinnedItem: { display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  memberSidebar: { width:220, minWidth:220, background:'#121822', borderLeft:'1px solid rgba(255,255,255,0.06)', overflowY:'auto', padding:'14px 8px', flexShrink:0 },
  memberSidebarItem: { display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6 },
  cmdLogPanel: { width:300, minWidth:300, background:'#1e1f22', borderLeft:'1px solid rgba(255,255,255,0.06)', overflowY:'auto', padding:'14px 10px', flexShrink:0 },
  cmdLogItem: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:'8px 10px', marginBottom:8 },
  loadMoreBtn: { background:'none', border:'1px solid rgba(255,255,255,0.09)', color:'#8493A6', borderRadius:6, padding:'5px 14px', cursor:'pointer', fontSize:12, fontFamily:'inherit' },
  replyBanner: { display:'flex', alignItems:'center', padding:'6px 16px', background:'#121822', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:13, color:'#8493A6', flexShrink:0 },
  cmdSuggest: { background:'#1e1f22', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, margin:'0 16px', marginBottom:4, overflow:'hidden', animation:'slideUp 0.1s ease', flexShrink:0 },
  cmdSuggestItem: { display:'flex', alignItems:'center', gap:8, padding:'7px 12px', cursor:'pointer', transition:'background 0.1s' },
  inputArea: { padding:'0 16px 14px', background:'#313338', flexShrink:0 },
  inputBox: { display:'flex', alignItems:'flex-end', background:'#383a40', borderRadius:9, padding:'4px 8px 4px 10px', border:'1px solid rgba(255,255,255,0.06)' },
  textarea: { flex:1, background:'none', border:'none', outline:'none', color:'#E8EEF4', fontSize:15, fontFamily:'inherit', resize:'none', padding:'8px 0', lineHeight:1.4, maxHeight:180, overflowY:'auto' },
  sendBtn: { border:'none', borderRadius:6, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s', flexShrink:0, marginBottom:2 },
  toast: { position:'fixed', top:76, right:16, zIndex:9999, background:'#121822', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, width:320, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', animation:'fadeIn 0.2s ease' },
  toastTitle: { fontSize:13, color:'#fff', display:'flex', alignItems:'center', gap:6 },
  toastBody: { color:'#8493A6', fontSize:12, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  toastClose: { background:'none', border:'none', cursor:'pointer', color:'#8493A6', display:'flex', alignItems:'center', flexShrink:0 },
  spinner: { width:24, height:24, border:'3px solid rgba(255,255,255,0.1)', borderTop:'3px solid #5865f2', borderRadius:'50%', animation:'spin 0.7s linear infinite' },
};
