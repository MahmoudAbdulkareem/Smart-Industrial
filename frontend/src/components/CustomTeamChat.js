import React, { useState, useEffect, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';
import { useApi } from '../hooks/useApi';

// Icon components
const Icon = {
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Hash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="9" x2="20" y2="9"/>
      <line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/>
      <line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  Close: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Pin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="17" x2="12" y2="22"/>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
    </svg>
  ),
  Reply: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="17 10 22 10 22 15"/>
      <path d="M9 15a4 4 0 0 1 4-4h9"/>
      <path d="M14 22a8 8 0 0 1-8-8 8 8 0 0 1 8-8"/>
    </svg>
  ),
  Emoji: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
  WorkOrder: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
};

// User colors for avatars
const USER_COLORS = [
  '#E74C3C', '#F39C12', '#2ECC71', '#3498DB', '#9B59B6',
  '#1ABC9C', '#E67E22', '#2980B9', '#8E44AD', '#27AE60'
];

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getUserColor = (userId) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

// Channel types
const CHANNELS = [
  { id: 'general', name: 'General', icon: '#' },
  { id: 'random', name: 'Random', icon: '🎲' },
  { id: 'technical', name: 'Technical', icon: '💻' },
  { id: 'workorders', name: 'Work Orders', icon: '🔧' },
  { id: 'alerts', name: 'Alerts', icon: '🔔' }
];

export default function CustomTeamChat({ userRole, currentUser }) {
  const { socket, isConnected } = useSocketContext();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentChannel, setCurrentChannel] = useState('general');
  const [showCommandHelp, setShowCommandHelp] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch chat history
  const { data: historyData, loading: historyLoading } = useApi(`/chat/history/${currentChannel}`, 10000);

  // Load chat history
  useEffect(() => {
    if (historyData && Array.isArray(historyData)) {
      setChatHistory(historyData);
      setMessages(historyData);
    }
  }, [historyData]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handlers = {
      'chat:message': (data) => {
        if (data.channel === currentChannel || data.channel === 'all') {
          const newMsg = {
            ...data,
            id: data.id || Date.now(),
            timestamp: data.timestamp || Date.now()
          };
          setMessages(prev => [...prev, newMsg]);
          // Also add to history
          setChatHistory(prev => [...prev, newMsg]);
        }
      },
      'chat:typing': (data) => {
        if (data.channel === currentChannel) {
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u.userId !== data.userId);
            return [...filtered, { userId: data.userId, username: data.username, timestamp: Date.now() }];
          });
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
          }, 3000);
        }
      },
      'chat:user:online': (data) => {
        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.id !== data.id);
          return [...filtered, data];
        });
      },
      'chat:user:offline': (data) => {
        setOnlineUsers(prev => prev.filter(u => u.id !== data.id));
      },
      'chat:message:delete': (data) => {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
        setChatHistory(prev => prev.filter(m => m.id !== data.messageId));
      },
      'chat:message:edit': (data) => {
        setMessages(prev => prev.map(m => 
          m.id === data.messageId ? { ...m, content: data.content, edited: true } : m
        ));
        setChatHistory(prev => prev.map(m => 
          m.id === data.messageId ? { ...m, content: data.content, edited: true } : m
        ));
      },
      'chat:message:pin': (data) => {
        setPinnedMessages(prev => {
          const exists = prev.find(m => m.id === data.messageId);
          if (exists) {
            return prev.filter(m => m.id !== data.messageId);
          }
          const msg = messages.find(m => m.id === data.messageId);
          return msg ? [msg, ...prev] : prev;
        });
      },
      // Work order events
      'workorder:created': (wo) => {
        if (!wo) return;
        // Send system message about new work order
        const sysMsg = {
          id: Date.now(),
          channel: 'workorders',
          content: `🔧 New Work Order Created: **${wo.wonum}** - ${wo.asset_name || wo.asset_id}\n${wo.description || ''}`,
          userId: 'system',
          username: 'System',
          timestamp: Date.now(),
          type: 'system',
          isSystem: true,
          workOrder: wo
        };
        if (currentChannel === 'workorders') {
          setMessages(prev => [...prev, sysMsg]);
        }
        setChatHistory(prev => [...prev, sysMsg]);
      },
      'workorder:updated': ({ id, status, wonum }) => {
        const statusLabels = {
          WAPPR: 'Waiting Approval',
          APPR: 'Approved',
          INPRG: 'In Progress',
          WMATL: 'Waiting Material',
          COMP: 'Complete',
          CAN: 'Cancelled'
        };
        const sysMsg = {
          id: Date.now(),
          channel: 'workorders',
          content: `📋 Work Order **${wonum || id}** status updated to: **${statusLabels[status] || status}**`,
          userId: 'system',
          username: 'System',
          timestamp: Date.now(),
          type: 'system',
          isSystem: true
        };
        if (currentChannel === 'workorders') {
          setMessages(prev => [...prev, sysMsg]);
        }
        setChatHistory(prev => [...prev, sysMsg]);
      }
    };

    // Register handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, currentChannel, messages]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clean up typing timeout
  useEffect(() => {
    return () => clearTimeout(typingTimeoutRef.current);
  }, []);

  // Slash commands with work order integration
  const COMMANDS = {
    '/help': {
      description: 'Show all available commands',
      handler: () => ({ type: 'system', message: getHelpText() })
    },
    '/who': {
      description: 'List online users',
      handler: (args, user, onlineUsers) => {
        const list = onlineUsers.length > 0 
          ? onlineUsers.map(u => `@${u.username || u.name || 'User'}`).join(', ')
          : 'No users online';
        return { type: 'system', message: `👥 Online users: ${list}` };
      }
    },
    '/me': {
      description: 'Show your profile info',
      handler: (args, user) => ({
        type: 'system',
        message: `👤 You are ${user?.name || user?.username || 'Unknown'} (${user?.email || 'no email'})`
      })
    },
    '/clear': {
      description: 'Clear chat messages',
      handler: () => ({ type: 'system', message: '🧹 Chat cleared', action: 'clear' })
    },
    '/roll': {
      description: 'Roll a dice (e.g., /roll 20)',
      handler: (args) => {
        const max = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * max) + 1;
        return { type: 'system', message: `🎲 Rolled ${result} (1-${max})` };
      }
    },
    '/ping': {
      description: 'Check latency',
      handler: () => ({ type: 'system', message: '🏓 Pong!' })
    },
    '/time': {
      description: 'Show current time',
      handler: () => ({ type: 'system', message: `🕐 ${new Date().toLocaleString()}` })
    },
    '/echo': {
      description: 'Echo a message (e.g., /echo Hello World)',
      handler: (args) => ({ type: 'system', message: `🔊 ${args.join(' ') || '...'}` })
    },
    // Work order commands
    '/wo': {
      description: 'Get work order status (e.g., /wo WO-001)',
      handler: async (args) => {
        if (!args.length) return { type: 'system', message: '❌ Please provide a work order number: /wo WO-001' };
        try {
          const res = await fetch(`/api/workorders/${args[0]}`, {
            headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
          });
          if (!res.ok) throw new Error('Work order not found');
          const wo = await res.json();
          const statusLabels = {
            WAPPR: 'Waiting Approval',
            APPR: 'Approved',
            INPRG: 'In Progress',
            WMATL: 'Waiting Material',
            COMP: 'Complete',
            CAN: 'Cancelled'
          };
          return { 
            type: 'system', 
            message: `🔧 Work Order **${wo.wonum}**\n📋 Status: ${statusLabels[wo.status] || wo.status}\n🏷️ Asset: ${wo.asset_name || wo.asset_id}\n📝 ${wo.description || 'No description'}` 
          };
        } catch (err) {
          return { type: 'system', message: `❌ Error: ${err.message}` };
        }
      }
    },
    '/wo-create': {
      description: 'Create a work order (e.g., /wo-create "Description" asset-id)',
      handler: async (args, user) => {
        if (args.length < 2) {
          return { type: 'system', message: '❌ Usage: /wo-create "Description" asset-id' };
        }
        // Join args back to get description (with quotes)
        const fullText = args.join(' ');
        const match = fullText.match(/"([^"]*)"\s*(.*)/);
        if (!match) {
          return { type: 'system', message: '❌ Please use quotes for description: /wo-create "Description" asset-id' };
        }
        const description = match[1];
        const assetId = match[2] || 'unknown';
        
        try {
          const res = await fetch('/api/workorders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({
              title: description.slice(0, 50),
              description,
              assetId,
              priority: 'medium',
              createdBy: user?.id || 'system'
            })
          });
          if (!res.ok) throw new Error('Failed to create work order');
          const wo = await res.json();
          return { 
            type: 'system', 
            message: `✅ Work Order **${wo.wonum || wo.work_order_id}** created successfully!\n📋 ${description}\n🏷️ Asset: ${assetId}` 
          };
        } catch (err) {
          return { type: 'system', message: `❌ Error: ${err.message}` };
        }
      }
    },
    '/wo-status': {
      description: 'Update work order status (e.g., /wo-status WO-001 INPRG)',
      handler: async (args) => {
        if (args.length < 2) {
          return { type: 'system', message: '❌ Usage: /wo-status WO-001 STATUS' };
        }
        const [wonum, status] = args;
        const validStatuses = ['WAPPR', 'APPR', 'INPRG', 'WMATL', 'COMP', 'CAN'];
        if (!validStatuses.includes(status)) {
          return { type: 'system', message: `❌ Invalid status. Valid: ${validStatuses.join(', ')}` };
        }
        try {
          const res = await fetch(`/api/workorders/${wonum}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({ status })
          });
          if (!res.ok) throw new Error('Failed to update status');
          const statusLabels = {
            WAPPR: 'Waiting Approval',
            APPR: 'Approved',
            INPRG: 'In Progress',
            WMATL: 'Waiting Material',
            COMP: 'Complete',
            CAN: 'Cancelled'
          };
          return { 
            type: 'system', 
            message: `✅ Work Order **${wonum}** status updated to: **${statusLabels[status] || status}**` 
          };
        } catch (err) {
          return { type: 'system', message: `❌ Error: ${err.message}` };
        }
      }
    },
    '/wo-list': {
      description: 'List recent work orders',
      handler: async () => {
        try {
          const res = await fetch('/api/workorders?limit=5', {
            headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
          });
          if (!res.ok) throw new Error('Failed to fetch work orders');
          const data = await res.json();
          const wos = Array.isArray(data) ? data : data.data || [];
          if (!wos.length) return { type: 'system', message: '📋 No recent work orders found.' };
          const statusLabels = {
            WAPPR: 'Waiting Approval',
            APPR: 'Approved',
            INPRG: 'In Progress',
            WMATL: 'Waiting Material',
            COMP: 'Complete',
            CAN: 'Cancelled'
          };
          const list = wos.map(wo => 
            `🔧 **${wo.wonum}** - ${statusLabels[wo.status] || wo.status} - ${wo.asset_name || wo.asset_id || 'N/A'}`
          ).join('\n');
          return { type: 'system', message: `📋 Recent Work Orders:\n${list}` };
        } catch (err) {
          return { type: 'system', message: `❌ Error: ${err.message}` };
        }
      }
    }
  };

  const getHelpText = () => {
    const entries = Object.entries(COMMANDS);
    const maxLen = Math.max(...entries.map(([cmd]) => cmd.length));
    return [
      '📋 Available Commands:',
      ...entries.map(([cmd, info]) => 
        `  ${cmd.padEnd(maxLen + 2)} - ${info.description}`
      ),
      '',
      '💡 Work Order Commands:',
      '  /wo WO-001        - Get work order status',
      '  /wo-create "Desc" asset - Create a work order',
      '  /wo-status WO-001 STATUS - Update status',
      '  /wo-list          - List recent work orders',
      '',
      '💡 Tip: Type / followed by a command, or just type a message'
    ].join('\n');
  };

  // Send message
  const sendMessage = (content, type = 'message') => {
    if (!content.trim() || !socket) return;

    // Check for slash commands
    if (content.startsWith('/')) {
      handleCommand(content);
      setInput('');
      return;
    }

    const message = {
      id: Date.now(),
      channel: currentChannel,
      content: content.trim(),
      userId: currentUser?.id || 'system',
      username: currentUser?.name || 'User',
      timestamp: Date.now(),
      type: type,
      replyTo: replyTo,
      edited: false
    };

    // Emit via socket
    socket.emit('chat:message', message);

    // Add locally
    setMessages(prev => [...prev, message]);
    setChatHistory(prev => [...prev, message]);
    setInput('');
    setReplyTo(null);
  };

  // Handle slash commands
  const handleCommand = async (input) => {
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (COMMANDS[command]) {
      const result = await COMMANDS[command].handler(args, currentUser, onlineUsers);
      
      if (result.action === 'clear') {
        setMessages([]);
        return;
      }

      // Add system message
      const systemMsg = {
        id: Date.now(),
        channel: currentChannel,
        content: result.message,
        userId: 'system',
        username: 'System',
        timestamp: Date.now(),
        type: 'system',
        isSystem: true
      };
      setMessages(prev => [...prev, systemMsg]);
      setChatHistory(prev => [...prev, systemMsg]);
    } else {
      // Unknown command
      const helpMsg = {
        id: Date.now(),
        channel: currentChannel,
        content: `❌ Unknown command: ${command}. Type /help for available commands.`,
        userId: 'system',
        username: 'System',
        timestamp: Date.now(),
        type: 'system',
        isSystem: true
      };
      setMessages(prev => [...prev, helpMsg]);
      setChatHistory(prev => [...prev, helpMsg]);
    }
  };

  // Handle typing
  const handleTyping = (e) => {
    setInput(e.target.value);
    
    if (socket && isConnected) {
      socket.emit('chat:typing', {
        channel: currentChannel,
        userId: currentUser?.id,
        username: currentUser?.name
      });
    }
  };

  // Delete message
  const deleteMessage = (messageId) => {
    if (socket && isConnected) {
      socket.emit('chat:message:delete', { messageId, channel: currentChannel });
    }
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setChatHistory(prev => prev.filter(m => m.id !== messageId));
  };

  // Edit message
  const editMessage = (messageId, newContent) => {
    if (socket && isConnected) {
      socket.emit('chat:message:edit', { messageId, content: newContent, channel: currentChannel });
    }
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, content: newContent, edited: true } : m
    ));
    setChatHistory(prev => prev.map(m => 
      m.id === messageId ? { ...m, content: newContent, edited: true } : m
    ));
    setEditingMessage(null);
  };

  // Pin message
  const togglePin = (messageId) => {
    if (socket && isConnected) {
      socket.emit('chat:message:pin', { messageId, channel: currentChannel });
    }
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      setPinnedMessages(prev => {
        const exists = prev.find(m => m.id === messageId);
        return exists ? prev.filter(m => m.id !== messageId) : [msg, ...prev];
      });
    }
  };

  // File upload handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    
    setTimeout(() => {
      const message = {
        id: Date.now(),
        channel: currentChannel,
        content: `📎 Uploaded: ${file.name}`,
        userId: currentUser?.id || 'system',
        username: currentUser?.name || 'User',
        timestamp: Date.now(),
        type: 'file',
        file: { name: file.name, size: file.size, type: file.type }
      };
      setMessages(prev => [...prev, message]);
      setChatHistory(prev => [...prev, message]);
      setUploading(false);
    }, 1500);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderMessage = (msg) => {
    const isOwn = msg.userId === currentUser?.id;
    const isSystem = msg.type === 'system' || msg.isSystem;
    const isPinned = pinnedMessages.some(m => m.id === msg.id);

    if (isSystem) {
      return (
        <div key={msg.id} style={styles.systemMessage}>
          <span style={styles.systemIcon}>🤖</span>
          <span style={styles.systemText}>{msg.content}</span>
          <span style={styles.systemTime}>{formatTime(msg.timestamp)}</span>
        </div>
      );
    }

    return (
      <div 
        key={msg.id} 
        style={{
          ...styles.message,
          flexDirection: isOwn ? 'row-reverse' : 'row'
        }}
        onMouseEnter={(e) => {
          const actions = e.currentTarget.querySelector('.message-actions');
          if (actions) actions.style.display = 'flex';
        }}
        onMouseLeave={(e) => {
          const actions = e.currentTarget.querySelector('.message-actions');
          if (actions) actions.style.display = 'none';
        }}
      >
        <div style={styles.messageAvatar}>
          <div style={{
            ...styles.avatar,
            background: getUserColor(msg.userId)
          }}>
            {getInitials(msg.username)}
          </div>
        </div>
        <div style={styles.messageContent}>
          <div style={styles.messageHeader}>
            <span style={styles.messageUsername}>{msg.username}</span>
            <span style={styles.messageTime}>{formatTime(msg.timestamp)}</span>
            {isPinned && <span style={styles.pinBadge}>📌</span>}
            {msg.edited && <span style={styles.editedBadge}>edited</span>}
          </div>
          {editingMessage === msg.id ? (
            <div style={styles.editContainer}>
              <input
                type="text"
                defaultValue={msg.content}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editMessage(msg.id, e.target.value);
                  }
                  if (e.key === 'Escape') {
                    setEditingMessage(null);
                  }
                }}
                autoFocus
                style={styles.editInput}
              />
              <button onClick={() => setEditingMessage(null)} style={styles.cancelEditBtn}>
                <Icon.Close />
              </button>
            </div>
          ) : (
            <div style={styles.messageBody}>
              {msg.replyTo && (
                <div style={styles.replyIndicator}>
                  <Icon.Reply /> Replying to @{msg.replyTo.username}
                </div>
              )}
              {msg.type === 'file' ? (
                <div style={styles.fileMessage}>
                  <div style={styles.fileIcon}>📎</div>
                  <div style={styles.fileInfo}>
                    <div style={styles.fileName}>{msg.file?.name}</div>
                    <div style={styles.fileSize}>
                      {(msg.file?.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              ) : msg.workOrder ? (
                <div style={styles.workOrderMessage}>
                  <div style={styles.workOrderHeader}>🔧 Work Order: {msg.workOrder.wonum}</div>
                  <div style={styles.workOrderDetails}>
                    <span>Status: {msg.workOrder.status}</span>
                    <span>Asset: {msg.workOrder.asset_name || msg.workOrder.asset_id}</span>
                  </div>
                  <div style={styles.workOrderDescription}>{msg.workOrder.description}</div>
                </div>
              ) : (
                <div style={styles.messageText}>{msg.content}</div>
              )}
            </div>
          )}
          <div className="message-actions" style={styles.messageActions}>
            <button onClick={() => setReplyTo(msg)} style={styles.actionBtn}>
              <Icon.Reply /> Reply
            </button>
            {isOwn && (
              <>
                <button onClick={() => setEditingMessage(msg.id)} style={styles.actionBtn}>
                  <Icon.Edit /> Edit
                </button>
                <button onClick={() => deleteMessage(msg.id)} style={styles.actionBtn}>
                  <Icon.Trash /> Delete
                </button>
              </>
            )}
            {(isOwn || userRole === 'admin' || userRole === 'it_admin') && (
              <button onClick={() => togglePin(msg.id)} style={styles.actionBtn}>
                <Icon.Pin /> {isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (historyLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Loading chat history...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .message-actions {
          display: none;
        }
        .message-actions:hover {
          display: flex !important;
        }
      `}</style>

      {/* Channel Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>💬 Team Chat</h2>
          <span style={styles.onlineStatus}>
            {onlineUsers.length} online
          </span>
        </div>

        <div style={styles.channelList}>
          <div style={styles.sectionLabel}>Channels</div>
          {CHANNELS.map(channel => (
            <div
              key={channel.id}
              style={{
                ...styles.channelItem,
                background: currentChannel === channel.id ? 'rgba(255,255,255,0.1)' : 'transparent'
              }}
              onClick={() => setCurrentChannel(channel.id)}
            >
              <span style={styles.channelIcon}>{channel.icon}</span>
              <span style={styles.channelName}>{channel.name}</span>
            </div>
          ))}
        </div>

        <div style={styles.onlineUsers}>
          <div style={styles.sectionLabel}>Online Users</div>
          {onlineUsers.map(user => (
            <div key={user.id} style={styles.userItem}>
              <div style={styles.userDot} />
              <span style={styles.userName}>{user.name || user.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.chatArea}>
        {/* Channel Header */}
        <div style={styles.channelHeader}>
          <div style={styles.channelHeaderLeft}>
            <Icon.Hash />
            <span style={styles.channelHeaderName}>
              {CHANNELS.find(c => c.id === currentChannel)?.name || currentChannel}
            </span>
            <span style={styles.messageCount}>
              {messages.length} messages
            </span>
          </div>
          <div style={styles.channelHeaderRight}>
            {!isConnected && (
              <span style={styles.disconnectedBadge}>⚠️ Disconnected</span>
            )}
            {chatHistory.length > 0 && (
              <span style={styles.historyBadge}>📚 {chatHistory.length} total</span>
            )}
          </div>
        </div>

        {/* Pinned Messages */}
        {pinnedMessages.length > 0 && (
          <div style={styles.pinnedContainer}>
            <div style={styles.pinnedHeader}>📌 Pinned Messages</div>
            {pinnedMessages.slice(0, 3).map(msg => (
              <div key={msg.id} style={styles.pinnedMessage}>
                <span style={styles.pinnedUser}>{msg.username}:</span>
                <span style={styles.pinnedContent}>{msg.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>💬</div>
              <h3 style={styles.emptyTitle}>No messages yet</h3>
              <p style={styles.emptyText}>
                Be the first to send a message in #{CHANNELS.find(c => c.id === currentChannel)?.name}
              </p>
              {currentChannel === 'workorders' && (
                <p style={styles.emptySub}>
                  💡 Tip: Type <code style={styles.code}>/wo-list</code> to see recent work orders
                </p>
              )}
            </div>
          ) : (
            messages.map(msg => renderMessage(msg))
          )}
          <div ref={messagesEndRef} />

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div style={styles.typingIndicator}>
              {typingUsers.map((u, i) => (
                <span key={u.userId}>
                  {u.username}{i < typingUsers.length - 1 ? ', ' : ''}
                </span>
              ))}
              {typingUsers.length === 1 ? ' is' : ' are'} typing...
              <span style={styles.typingDots}>
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          )}
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div style={styles.replyContainer}>
            <span style={styles.replyLabel}>
              <Icon.Reply /> Replying to @{replyTo.username}
            </span>
            <span style={styles.replyContent}>“{replyTo.content}”</span>
            <button onClick={() => setReplyTo(null)} style={styles.replyClose}>
              <Icon.Close />
            </button>
          </div>
        )}

        {/* Input area */}
        <div style={styles.inputArea}>
          <div style={styles.inputToolbar}>
            <button 
              onClick={() => document.getElementById('fileInput').click()} 
              style={styles.toolbarBtn}
              title="Upload file"
            >
              <Icon.Plus />
            </button>
            <input
              id="fileInput"
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => setShowCommandHelp(!showCommandHelp)} 
              style={styles.toolbarBtn}
              title="Commands"
            >
              <Icon.Emoji /> /cmd
            </button>
          </div>

          {showCommandHelp && (
            <div style={styles.commandHelp}>
              <pre style={styles.commandHelpText}>{getHelpText()}</pre>
              <button onClick={() => setShowCommandHelp(false)} style={styles.commandHelpClose}>
                <Icon.Close />
              </button>
            </div>
          )}

          <div style={styles.inputRow}>
            <input
              ref={inputRef}
              value={input}
              onChange={handleTyping}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={`Message #${CHANNELS.find(c => c.id === currentChannel)?.name || currentChannel}...`}
              style={styles.input}
              disabled={!isConnected}
            />
            <button 
              onClick={() => sendMessage(input)} 
              style={styles.sendBtn}
              disabled={!input.trim() || !isConnected}
            >
              <Icon.Send />
            </button>
          </div>

          <div style={styles.inputFooter}>
            <span style={styles.inputHint}>
              {isConnected ? '✅ Connected' : '❌ Disconnected'} · 
              Type /help for commands · Enter to send
            </span>
            {uploading && <span style={styles.uploadingStatus}>📤 Uploading...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 80px)',
    background: 'linear-gradient(135deg, #0a1628, #1a2a4a)',
    borderRadius: '12px',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  sidebar: {
    width: '240px',
    background: 'rgba(0,0,0,0.3)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflow: 'auto'
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e0e0e0',
    margin: 0
  },
  onlineStatus: {
    fontSize: '11px',
    color: '#27AE60',
    fontWeight: 600,
    padding: '2px 8px',
    background: 'rgba(39, 174, 96, 0.15)',
    borderRadius: '12px'
  },
  channelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#5D6D7E',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '8px 0 4px'
  },
  channelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    color: '#95A5A6'
  },
  channelIcon: {
    fontSize: '14px'
  },
  channelName: {
    fontSize: '13px',
    fontWeight: 500
  },
  onlineUsers: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255,255,255,0.06)'
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    fontSize: '12px',
    color: '#95A5A6'
  },
  userDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#27AE60'
  },
  userName: {
    fontSize: '12px'
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0,0,0,0.2)'
  },
  channelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.15)'
  },
  channelHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#e0e0e0'
  },
  channelHeaderName: {
    fontSize: '15px',
    fontWeight: 600
  },
  messageCount: {
    fontSize: '11px',
    color: '#5D6D7E',
    marginLeft: '8px'
  },
  channelHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: '#5D6D7E'
  },
  disconnectedBadge: {
    padding: '2px 10px',
    background: 'rgba(231, 76, 60, 0.2)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '12px',
    color: '#E74C3C',
    fontSize: '10px',
    fontWeight: 600
  },
  historyBadge: {
    padding: '2px 10px',
    background: 'rgba(52, 152, 219, 0.15)',
    border: '1px solid rgba(52, 152, 219, 0.2)',
    borderRadius: '12px',
    color: '#5DADE2',
    fontSize: '10px'
  },
  pinnedContainer: {
    padding: '8px 20px',
    background: 'rgba(243, 156, 18, 0.05)',
    borderBottom: '1px solid rgba(243, 156, 18, 0.1)'
  },
  pinnedHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#F39C12',
    marginBottom: '4px'
  },
  pinnedMessage: {
    fontSize: '12px',
    color: '#95A5A6',
    padding: '2px 0'
  },
  pinnedUser: {
    color: '#e0e0e0',
    fontWeight: 600
  },
  pinnedContent: {
    marginLeft: '4px'
  },
  messagesContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  message: {
    display: 'flex',
    gap: '12px',
    padding: '6px 8px',
    borderRadius: '6px',
    animation: 'slideIn 0.15s ease-out'
  },
  messageAvatar: {
    flexShrink: 0
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: 700
  },
  messageContent: {
    flex: 1,
    minWidth: 0
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '2px'
  },
  messageUsername: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e0e0e0'
  },
  messageTime: {
    fontSize: '11px',
    color: '#5D6D7E'
  },
  pinBadge: {
    fontSize: '11px'
  },
  editedBadge: {
    fontSize: '10px',
    color: '#5D6D7E',
    fontStyle: 'italic'
  },
  messageBody: {
    fontSize: '14px',
    color: '#e0e0e0',
    lineHeight: 1.5,
    wordBreak: 'break-word'
  },
  messageText: {
    whiteSpace: 'pre-wrap'
  },
  messageActions: {
    display: 'none',
    gap: '4px',
    marginTop: '4px',
    padding: '4px 0'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderRadius: '4px',
    color: '#95A5A6',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  systemMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#95A5A6'
  },
  systemIcon: {
    fontSize: '16px'
  },
  systemText: {
    flex: 1,
    whiteSpace: 'pre-wrap'
  },
  systemTime: {
    fontSize: '11px',
    color: '#5D6D7E'
  },
  editContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  editInput: {
    flex: 1,
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '13px',
    outline: 'none'
  },
  cancelEditBtn: {
    padding: '4px 8px',
    background: 'rgba(231, 76, 60, 0.15)',
    border: '1px solid rgba(231, 76, 60, 0.2)',
    borderRadius: '4px',
    color: '#E74C3C',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  replyContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(52, 152, 219, 0.1)',
    borderTop: '1px solid rgba(52, 152, 219, 0.1)',
    fontSize: '12px',
    color: '#5DADE2'
  },
  replyLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: 500
  },
  replyContent: {
    color: '#95A5A6',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  replyClose: {
    padding: '2px 6px',
    background: 'none',
    border: 'none',
    color: '#95A5A6',
    cursor: 'pointer'
  },
  replyIndicator: {
    fontSize: '11px',
    color: '#5DADE2',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '4px'
  },
  inputArea: {
    padding: '12px 20px 16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.15)'
  },
  inputToolbar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px'
  },
  toolbarBtn: {
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    color: '#95A5A6',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px'
  },
  commandHelp: {
    position: 'relative',
    marginBottom: '8px',
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    maxHeight: '300px',
    overflow: 'auto'
  },
  commandHelpText: {
    fontSize: '12px',
    color: '#95A5A6',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    margin: 0,
    lineHeight: 1.6
  },
  commandHelpClose: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    padding: '4px',
    background: 'none',
    border: 'none',
    color: '#95A5A6',
    cursor: 'pointer'
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  sendBtn: {
    padding: '8px 16px',
    background: '#2E86C1',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.15s'
  },
  inputFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontSize: '11px',
    color: '#5D6D7E'
  },
  inputHint: {
    fontSize: '11px',
    color: '#5D6D7E'
  },
  uploadingStatus: {
    fontSize: '11px',
    color: '#F39C12'
  },
  fileMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px'
  },
  fileIcon: {
    fontSize: '24px'
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  fileName: {
    fontSize: '13px',
    color: '#e0e0e0',
    fontWeight: 500
  },
  fileSize: {
    fontSize: '11px',
    color: '#5D6D7E'
  },
  workOrderMessage: {
    padding: '8px 12px',
    background: 'rgba(52, 152, 219, 0.08)',
    borderRadius: '6px',
    border: '1px solid rgba(52, 152, 219, 0.15)'
  },
  workOrderHeader: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#5DADE2',
    marginBottom: '4px'
  },
  workOrderDetails: {
    display: 'flex',
    gap: '16px',
    fontSize: '11px',
    color: '#95A5A6',
    marginBottom: '4px'
  },
  workOrderDescription: {
    fontSize: '12px',
    color: '#e0e0e0'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#5D6D7E'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#95A5A6',
    margin: '0 0 8px'
  },
  emptyText: {
    fontSize: '13px',
    color: '#5D6D7E',
    margin: 0
  },
  emptySub: {
    fontSize: '12px',
    color: '#5D6D7E',
    marginTop: '8px'
  },
  code: {
    padding: '2px 6px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '11px'
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#5D6D7E',
    fontStyle: 'italic'
  },
  typingDots: {
    display: 'flex',
    gap: '2px',
    marginLeft: '4px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#5D6D7E'
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #5DADE2',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '12px'
  },
  loadingText: {
    fontSize: '13px',
    color: '#95A5A6'
  }
};