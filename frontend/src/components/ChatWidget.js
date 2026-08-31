// frontend/src/components/ChatWidget.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

function authHeaders() {
    const token = localStorage.getItem("token");
    return { 
        Authorization: token ? "Bearer " + token : "", 
        "Content-Type": "application/json" 
    };
}

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [error, setError] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [showDownloadOptions, setShowDownloadOptions] = useState(false);
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'insights' | 'history'
    const [isConfigured, setIsConfigured] = useState(false);
    
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Check if AI is configured
    useEffect(() => {
        const checkAIStatus = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/chat/test`, {
                    headers: authHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsConfigured(data.geminiConfigured || false);
                }
            } catch (error) {
                console.error("Failed to check AI status:", error);
            }
        };
        checkAIStatus();
    }, []);

    // Load chat history when session exists
    useEffect(() => {
        if (sessionId) {
            loadHistory();
        }
    }, [sessionId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const loadHistory = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat/history/${sessionId}`, {
                headers: authHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data.history && data.history.length > 0) {
                    setMessages(data.history);
                }
            }
        } catch (error) {
            console.error("Failed to load history:", error);
        }
    };

    const startSession = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat/session`, {
                method: "POST",
                headers: authHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setSessionId(data.sessionId);
                setMessages([
                    { 
                        role: "model", 
                        content: "👋 Hello! I'm your Smart Manufacturing Assistant. I have access to your work orders, assets, energy data, and ML predictions. How can I help you optimize your operations today?" 
                    }
                ]);
            }
        } catch (error) {
            console.error("Failed to start session:", error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setError(null);
        
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);
        setIsTyping(true);

        try {
            const requestBody = { message: userMessage };
            if (sessionId) {
                requestBody.sessionId = sessionId;
            }

            const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(requestBody)
            });

            const data = await res.json();
            setIsTyping(false);

            if (res.ok) {
                setMessages(prev => [...prev, { 
                    role: "model", 
                    content: data.response || "I'm not sure how to respond to that." 
                }]);
                if (data.sessionId && !sessionId) {
                    setSessionId(data.sessionId);
                }
            } else if (data.fallback) {
                setMessages(prev => [...prev, { 
                    role: "model", 
                    content: data.fallback 
                }]);
                setError(data.error || "Using fallback response");
            } else {
                setError(data.error || "Failed to send message");
                setMessages(prev => [...prev, { 
                    role: "model", 
                    content: data.error || "Sorry, I encountered an error. Please try again." 
                }]);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            setIsTyping(false);
            setError("Connection error. Please try again.");
            setMessages(prev => [...prev, { 
                role: "model", 
                content: "Sorry, I'm having trouble connecting. Please check your internet connection and try again." 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleChat = () => {
        if (!isOpen && !sessionId) {
            startSession();
        }
        setIsOpen(!isOpen);
        setError(null);
        if (!isOpen) {
            setIsMinimized(false);
        }
    };

    const downloadConversation = async (format = 'text') => {
        if (messages.length === 0) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chat_conversation_${timestamp}`;

        if (format === 'text') {
            let content = '🤖 SMART MANUFACTURING ASSISTANT - CHAT LOG\n';
            content += '='.repeat(60) + '\n';
            content += `Date: ${new Date().toLocaleString()}\n`;
            content += `Session ID: ${sessionId || 'N/A'}\n`;
            content += '='.repeat(60) + '\n\n';
            
            messages.forEach((msg, i) => {
                const role = msg.role === 'user' ? '👤 You' : '🤖 Assistant';
                content += `[${i + 1}] ${role}:\n${msg.content}\n\n`;
            });
            
            content += '='.repeat(60) + '\n';
            content += `End of conversation • ${messages.length} messages\n`;

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'html') {
            let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Chat Conversation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F5F7FA; padding: 40px; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #0B0F14 0%, #2d3a4a 100%); color: white; padding: 30px 40px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.8; font-size: 14px; }
        .messages { padding: 30px 40px; }
        .message { margin-bottom: 20px; display: flex; flex-direction: column; }
        .message.user { align-items: flex-end; }
        .message.assistant { align-items: flex-start; }
        .message .bubble { max-width: 80%; padding: 12px 18px; border-radius: 12px; word-wrap: break-word; line-height: 1.6; }
        .message.user .bubble { background: linear-gradient(135deg, #5AA9E6 0%, #3E7FB0 100%); color: white; }
        .message.assistant .bubble { background: #F5F7FA; border: 1px solid #e2e8f0; color: #0B0F14; }
        .message .role { font-size: 12px; font-weight: 600; margin-bottom: 4px; color: #5B6B7D; }
        .footer { background: #F5F7FA; padding: 20px 40px; border-top: 1px solid #e2e8f0; color: #5B6B7D; font-size: 12px; text-align: center; }
        .stats { display: flex; gap: 20px; justify-content: center; margin-top: 8px; }
        .stats span { background: white; padding: 4px 12px; border-radius: 12px; border: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Smart Manufacturing Assistant</h1>
            <p>Chat Conversation • ${new Date().toLocaleString()}</p>
            <div class="stats">
                <span>📝 ${messages.length} messages</span>
                <span>📅 ${new Date().toLocaleDateString()}</span>
                <span>🕐 ${new Date().toLocaleTimeString()}</span>
            </div>
        </div>
        <div class="messages">`;

            messages.forEach((msg) => {
                const role = msg.role === 'user' ? 'user' : 'assistant';
                const roleLabel = msg.role === 'user' ? '👤 You' : '🤖 Assistant';
                html += `
            <div class="message ${role}">
                <div class="role">${roleLabel}</div>
                <div class="bubble">${msg.content.replace(/\n/g, '<br>')}</div>
            </div>`;
            });

            html += `
        </div>
        <div class="footer">
            <p>End of conversation • Generated by Smart Manufacturing Dashboard</p>
        </div>
    </div>
</body>
</html>`;

            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.html`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'json') {
            const data = {
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                totalMessages: messages.length,
                messages: messages,
                metadata: {
                    exportedAt: new Date().toISOString(),
                    version: '1.0'
                }
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        setShowDownloadOptions(false);
    };

    // Quick actions for chat
    const quickActions = [
        { label: "📋 Work Orders", message: "Show me recent work orders" },
        { label: "🏭 Assets", message: "What assets need maintenance?" },
        { label: "⚡ Energy", message: "What's the energy consumption?" },
        { label: "⚠️ Alerts", message: "Show me active alerts" },
        { label: "📊 ML Predictions", message: "What does the ML model predict?" },
        { label: "💡 Help", message: "How can you help me?" }
    ];

    // Sample insights data
    const insights = [
        { 
            icon: "📊", 
            title: "Fleet Health Summary", 
            desc: "Average health: 78%, 2 assets at risk",
            color: "#12B886"
        },
        { 
            icon: "⚡", 
            title: "Energy Efficiency", 
            desc: "PUE: 1.09, 12% improvement this month",
            color: "#F0A93A"
        },
        { 
            icon: "📋", 
            title: "Work Orders", 
            desc: "14 open, 3 waiting approval",
            color: "#5AA9E6"
        },
        { 
            icon: "🚨", 
            title: "Critical Alerts", 
            desc: "2 active alerts need immediate attention",
            color: "#E6484B"
        },
        { 
            icon: "🔧", 
            title: "Maintenance Predictions", 
            desc: "3 assets predicted to need maintenance this week",
            color: "#8B5CF6"
        },
        { 
            icon: "📈", 
            title: "RUL Summary", 
            desc: "Average remaining life: 156 days",
            color: "#0d9488"
        }
    ];

    return (
        <>
            {/* Chat Button - Premium Design */}
            <button
                onClick={toggleChat}
                style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #5AA9E6 0%, #3E7FB0 100%)",
                    color: "#fff",
                    border: "none",
                    fontSize: 28,
                    cursor: "pointer",
                    boxShadow: "0 8px 32px rgba(29,111,204,0.4)",
                    zIndex: 9998,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    animation: isOpen ? "pulseGlow 2s ease-in-out infinite" : "none"
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.08)";
                    e.currentTarget.style.boxShadow = "0 8px 40px rgba(29,111,204,0.5)";
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "0 8px 32px rgba(29,111,204,0.4)";
                }}
            >
                {isOpen ? (
                    <span style={{ fontSize: 24 }}>✕</span>
                ) : (
                    <span style={{ position: "relative" }}>
                        💬
                        {messages.length > 0 && (
                            <span style={{
                                position: "absolute",
                                top: -8,
                                right: -8,
                                background: "#E6484B",
                                color: "white",
                                fontSize: 10,
                                fontWeight: 700,
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                {messages.length}
                            </span>
                        )}
                    </span>
                )}
            </button>

            <style>
                {`
                    @keyframes slideUp {
                        from { transform: translateY(20px) scale(0.95); opacity: 0; }
                        to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                    @keyframes pulseGlow {
                        0%, 100% { box-shadow: 0 8px 32px rgba(29,111,204,0.4); }
                        50% { box-shadow: 0 8px 48px rgba(29,111,204,0.6); }
                    }
                    @keyframes messageIn {
                        from { transform: translateY(10px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    @keyframes typingDot {
                        0%, 60%, 100% { transform: translateY(0); }
                        30% { transform: translateY(-6px); }
                    }
                    @keyframes tabIndicator {
                        from { transform: scaleX(0); }
                        to { transform: scaleX(1); }
                    }
                    .chat-messages::-webkit-scrollbar { width: 4px; }
                    .chat-messages::-webkit-scrollbar-track { background: transparent; }
                    .chat-messages::-webkit-scrollbar-thumb { 
                        background: #cbd5e1; 
                        border-radius: 4px; 
                    }
                    .chat-messages::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                    .message-enter { animation: messageIn 0.3s ease-out; }
                    .typing-dot {
                        display: inline-block;
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: #94a3b8;
                        margin: 0 2px;
                        animation: typingDot 1.4s infinite;
                    }
                    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                    .tab-active {
                        animation: tabIndicator 0.3s ease-out;
                    }
                `}
            </style>

            {/* Chat Window - Premium UI */}
            {isOpen && (
                <div
                    ref={chatContainerRef}
                    style={{
                        position: "fixed",
                        bottom: 100,
                        right: 24,
                        width: 420,
                        maxWidth: "calc(100vw - 48px)",
                        height: isMinimized ? 60 : 580,
                        maxHeight: isMinimized ? 60 : "calc(100vh - 160px)",
                        background: "#ffffff",
                        borderRadius: 16,
                        boxShadow: "0 16px 64px rgba(0,0,0,0.15)",
                        display: "flex",
                        flexDirection: "column",
                        zIndex: 9999,
                        overflow: "hidden",
                        animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                    }}
                >
                    {/* Header - Premium */}
                    <div
                        style={{
                            padding: "16px 20px",
                            background: "linear-gradient(135deg, #0B0F14 0%, #2d3a4a 100%)",
                            color: "#fff",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexShrink: 0,
                            cursor: "pointer"
                        }}
                        onClick={() => setIsMinimized(!isMinimized)}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #5AA9E6, #3E7FB0)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18
                            }}>
                                🤖
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>
                                    Smart Assistant
                                </div>
                                <div style={{ 
                                    fontSize: 10, 
                                    opacity: 0.7,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4
                                }}>
                                    <span style={{
                                        display: "inline-block",
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: "#12B886",
                                        animation: "pulseGlow 2s ease-in-out infinite"
                                    }} />
                                    {isTyping ? "Typing..." : isConfigured ? "AI Ready" : "Fallback Mode"}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                            {messages.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDownloadOptions(!showDownloadOptions);
                                    }}
                                    style={{
                                        background: "rgba(255,255,255,0.1)",
                                        border: "none",
                                        color: "#fff",
                                        cursor: "pointer",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        fontSize: 14,
                                        transition: "all 0.2s",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                >
                                    📥
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMinimized(!isMinimized);
                                }}
                                style={{
                                    background: "rgba(255,255,255,0.1)",
                                    border: "none",
                                    color: "#fff",
                                    cursor: "pointer",
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    fontSize: 14,
                                    transition: "all 0.2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                            >
                                {isMinimized ? "□" : "—"}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleChat();
                                }}
                                style={{
                                    background: "rgba(255,255,255,0.1)",
                                    border: "none",
                                    color: "#fff",
                                    cursor: "pointer",
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    fontSize: 14,
                                    transition: "all 0.2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            {/* Tabs */}
                            <div style={{
                                display: "flex",
                                borderBottom: "1px solid #e2e8f0",
                                background: "#F5F7FA",
                                flexShrink: 0
                            }}>
                                {[
                                    { id: 'chat', label: '💬 Chat' },
                                    { id: 'insights', label: '📊 Insights' },
                                    { id: 'history', label: '📋 History' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        style={{
                                            flex: 1,
                                            padding: "10px 12px",
                                            border: "none",
                                            background: activeTab === tab.id ? "#fff" : "transparent",
                                            color: activeTab === tab.id ? "#5AA9E6" : "#5B6B7D",
                                            fontWeight: activeTab === tab.id ? 700 : 500,
                                            fontSize: 12,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                            borderBottom: activeTab === tab.id ? "2px solid #5AA9E6" : "2px solid transparent",
                                            transition: "all 0.2s",
                                            position: "relative"
                                        }}
                                        onMouseEnter={e => {
                                            if (activeTab !== tab.id) {
                                                e.currentTarget.style.color = "#0B0F14";
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (activeTab !== tab.id) {
                                                e.currentTarget.style.color = "#5B6B7D";
                                            }
                                        }}
                                    >
                                        {tab.label}
                                        {tab.id === 'chat' && messages.length > 0 && (
                                            <span style={{
                                                background: "#5AA9E6",
                                                color: "#fff",
                                                fontSize: 9,
                                                fontWeight: 700,
                                                padding: "1px 6px",
                                                borderRadius: 10,
                                                marginLeft: 4
                                            }}>
                                                {messages.length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Download Options Dropdown */}
                            {showDownloadOptions && (
                                <div style={{
                                    position: "absolute",
                                    top: 110,
                                    right: 16,
                                    background: "white",
                                    borderRadius: 12,
                                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                                    padding: "8px",
                                    zIndex: 100,
                                    minWidth: 160,
                                    border: "1px solid #e2e8f0"
                                }}>
                                    <button
                                        onClick={() => downloadConversation('text')}
                                        style={{
                                            width: "100%",
                                            padding: "8px 14px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            color: "#0B0F14",
                                            borderRadius: 6,
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            transition: "all 0.2s"
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#F5F7FA"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                        📄 Download as TXT
                                    </button>
                                    <button
                                        onClick={() => downloadConversation('html')}
                                        style={{
                                            width: "100%",
                                            padding: "8px 14px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            color: "#0B0F14",
                                            borderRadius: 6,
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            transition: "all 0.2s"
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#F5F7FA"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                        🌐 Download as HTML
                                    </button>
                                    <button
                                        onClick={() => downloadConversation('json')}
                                        style={{
                                            width: "100%",
                                            padding: "8px 14px",
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            color: "#0B0F14",
                                            borderRadius: 6,
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            transition: "all 0.2s"
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#F5F7FA"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                        📊 Download as JSON
                                    </button>
                                    <div style={{
                                        borderTop: "1px solid #e2e8f0",
                                        margin: "4px 0",
                                        padding: "4px 14px",
                                        fontSize: 10,
                                        color: "#94a3b8"
                                    }}>
                                        {messages.length} messages will be exported
                                    </div>
                                </div>
                            )}

                            {/* Tab Content */}
                            {activeTab === 'chat' && (
                                <>
                                    {/* Error Message */}
                                    {error && (
                                        <div style={{
                                            padding: "8px 16px",
                                            background: "#FBEAEA",
                                            color: "#B23A3D",
                                            fontSize: 12,
                                            borderBottom: "1px solid #F3B7B8",
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6
                                        }}>
                                            <span>⚠️</span> {error}
                                        </div>
                                    )}

                                    {/* Quick Actions */}
                                    {messages.length === 0 && (
                                        <div style={{
                                            padding: "12px 16px",
                                            display: "flex",
                                            gap: 6,
                                            flexWrap: "wrap",
                                            flexShrink: 0,
                                            borderBottom: "1px solid #e2e8f0",
                                            background: "#F5F7FA"
                                        }}>
                                            {quickActions.map((action, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setInput(action.message)}
                                                    style={{
                                                        padding: "4px 12px",
                                                        fontSize: 11,
                                                        borderRadius: 16,
                                                        border: "1px solid #E2E8F0",
                                                        background: "#fff",
                                                        color: "#475569",
                                                        cursor: "pointer",
                                                        transition: "all 0.2s",
                                                        whiteSpace: "nowrap",
                                                        fontFamily: "inherit"
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = "#5AA9E6";
                                                        e.currentTarget.style.color = "#fff";
                                                        e.currentTarget.style.borderColor = "#5AA9E6";
                                                        e.currentTarget.style.transform = "scale(1.02)";
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = "#fff";
                                                        e.currentTarget.style.color = "#475569";
                                                        e.currentTarget.style.borderColor = "#E2E8F0";
                                                        e.currentTarget.style.transform = "scale(1)";
                                                    }}
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Messages */}
                                    <div
                                        className="chat-messages"
                                        style={{
                                            flex: 1,
                                            overflowY: "auto",
                                            padding: "16px 20px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            background: "#F5F7FA"
                                        }}
                                    >
                                        {messages.map((msg, i) => (
                                            <div
                                                key={i}
                                                className="message-enter"
                                                style={{
                                                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                                                    maxWidth: "85%",
                                                    padding: "10px 16px",
                                                    borderRadius: 12,
                                                    background: msg.role === "user" 
                                                        ? "linear-gradient(135deg, #5AA9E6 0%, #3E7FB0 100%)"
                                                        : "#fff",
                                                    color: msg.role === "user" ? "#fff" : "#0B0F14",
                                                    boxShadow: msg.role === "user" 
                                                        ? "0 2px 12px rgba(29,111,204,0.2)"
                                                        : "0 1px 4px rgba(0,0,0,0.04)",
                                                    border: msg.role === "model" ? "1px solid #e2e8f0" : "none",
                                                    wordBreak: "break-word",
                                                    fontSize: 13,
                                                    lineHeight: 1.6,
                                                    whiteSpace: "pre-wrap",
                                                    position: "relative"
                                                }}
                                            >
                                                {msg.role === "user" && (
                                                    <div style={{
                                                        fontSize: 10,
                                                        opacity: 0.7,
                                                        marginBottom: 4,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4
                                                    }}>
                                                        👤 You
                                                    </div>
                                                )}
                                                {msg.role === "model" && (
                                                    <div style={{
                                                        fontSize: 10,
                                                        opacity: 0.7,
                                                        marginBottom: 4,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4
                                                    }}>
                                                        🤖 Assistant
                                                    </div>
                                                )}
                                                {msg.content}
                                            </div>
                                        ))}
                                        
                                        {/* Typing Indicator */}
                                        {isTyping && (
                                            <div style={{
                                                alignSelf: "flex-start",
                                                padding: "10px 16px",
                                                background: "#fff",
                                                borderRadius: 12,
                                                border: "1px solid #e2e8f0",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6
                                            }}>
                                                <span className="typing-dot" />
                                                <span className="typing-dot" />
                                                <span className="typing-dot" />
                                            </div>
                                        )}
                                        
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    <form
                                        onSubmit={sendMessage}
                                        style={{
                                            padding: "12px 16px",
                                            borderTop: "1px solid #e2e8f0",
                                            display: "flex",
                                            gap: 8,
                                            background: "#fff",
                                            flexShrink: 0,
                                            alignItems: "center"
                                        }}
                                    >
                                        <input
                                            ref={inputRef}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            placeholder="Ask about work orders, assets, energy..."
                                            style={{
                                                flex: 1,
                                                padding: "10px 16px",
                                                border: "2px solid #e2e8f0",
                                                borderRadius: 10,
                                                fontSize: 13,
                                                fontFamily: "inherit",
                                                outline: "none",
                                                transition: "all 0.2s",
                                                background: "#F5F7FA"
                                            }}
                                            onFocus={e => {
                                                e.target.style.borderColor = "#5AA9E6";
                                                e.target.style.background = "#fff";
                                            }}
                                            onBlur={e => {
                                                e.target.style.borderColor = "#e2e8f0";
                                                e.target.style.background = "#F5F7FA";
                                            }}
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            style={{
                                                padding: "10px 20px",
                                                background: "linear-gradient(135deg, #5AA9E6 0%, #3E7FB0 100%)",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: 10,
                                                cursor: "pointer",
                                                fontSize: 16,
                                                transition: "all 0.2s",
                                                opacity: isLoading || !input.trim() ? 0.5 : 1,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                fontWeight: 600
                                            }}
                                            onMouseEnter={e => {
                                                if (!isLoading && input.trim()) {
                                                    e.currentTarget.style.transform = "scale(1.02)";
                                                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(29,111,204,0.3)";
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = "scale(1)";
                                                e.currentTarget.style.boxShadow = "none";
                                            }}
                                        >
                                            {isLoading ? "⏳" : "➤"}
                                        </button>
                                    </form>
                                </>
                            )}

                            {/* Insights Tab */}
                            {activeTab === 'insights' && (
                                <div style={{
                                    flex: 1,
                                    overflowY: "auto",
                                    padding: "16px 20px",
                                    background: "#F5F7FA"
                                }}>
                                    <h4 style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "#0B0F14",
                                        marginBottom: 12
                                    }}>
                                        📊 Smart Manufacturing Insights
                                    </h4>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10
                                    }}>
                                        {insights.map((item, i) => (
                                            <div key={i} style={{
                                                background: "#fff",
                                                borderRadius: 10,
                                                padding: "12px 14px",
                                                border: "1px solid #e2e8f0",
                                                transition: "all 0.2s",
                                                cursor: "pointer"
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.borderColor = item.color;
                                                e.currentTarget.style.boxShadow = `0 2px 8px ${item.color}20`;
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.borderColor = "#e2e8f0";
                                                e.currentTarget.style.boxShadow = "none";
                                            }}
                                            >
                                                <div style={{
                                                    fontSize: 20,
                                                    marginBottom: 4
                                                }}>
                                                    {item.icon}
                                                </div>
                                                <div style={{
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: "#0B0F14",
                                                    marginBottom: 2
                                                }}>
                                                    {item.title}
                                                </div>
                                                <div style={{
                                                    fontSize: 11,
                                                    color: "#5B6B7D",
                                                    lineHeight: 1.4
                                                }}>
                                                    {item.desc}
                                                </div>
                                                <div style={{
                                                    marginTop: 6,
                                                    width: "100%",
                                                    height: 2,
                                                    borderRadius: 2,
                                                    background: item.color,
                                                    opacity: 0.3
                                                }} />
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{
                                        marginTop: 12,
                                        padding: "10px 14px",
                                        background: "#fff",
                                        borderRadius: 10,
                                        border: "1px solid #e2e8f0"
                                    }}>
                                        <div style={{
                                            fontSize: 11,
                                            color: "#5B6B7D",
                                            textAlign: "center"
                                        }}>
                                            💡 Ask the assistant about any of these insights for more details
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* History Tab */}
                            {activeTab === 'history' && (
                                <div style={{
                                    flex: 1,
                                    overflowY: "auto",
                                    padding: "16px 20px",
                                    background: "#F5F7FA"
                                }}>
                                    <h4 style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "#0B0F14",
                                        marginBottom: 12,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}>
                                        📋 Conversation History
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 400,
                                            color: "#5B6B7D"
                                        }}>
                                            {messages.length} messages
                                        </span>
                                    </h4>
                                    {messages.length === 0 ? (
                                        <div style={{
                                            textAlign: "center",
                                            padding: "30px 20px",
                                            color: "#94a3b8"
                                        }}>
                                            <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
                                            <div style={{ fontSize: 13 }}>No conversation yet</div>
                                            <div style={{ fontSize: 11, marginTop: 4 }}>Start chatting to build history</div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6
                                        }}>
                                            {messages.map((msg, i) => (
                                                <div key={i} style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 8,
                                                    padding: "8px 12px",
                                                    background: msg.role === "user" ? "#EAF4FC" : "#fff",
                                                    borderRadius: 8,
                                                    border: "1px solid #e2e8f0"
                                                }}>
                                                    <span style={{
                                                        fontSize: 16,
                                                        flexShrink: 0
                                                    }}>
                                                        {msg.role === "user" ? "👤" : "🤖"}
                                                    </span>
                                                    <div style={{
                                                        flex: 1,
                                                        fontSize: 12,
                                                        color: "#0B0F14",
                                                        lineHeight: 1.5,
                                                        wordBreak: "break-word"
                                                    }}>
                                                        {msg.content.length > 100 
                                                            ? msg.content.substring(0, 100) + "..." 
                                                            : msg.content}
                                                    </div>
                                                    <span style={{
                                                        fontSize: 9,
                                                        color: "#94a3b8",
                                                        flexShrink: 0
                                                    }}>
                                                        #{i + 1}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {messages.length > 0 && (
                                        <div style={{
                                            marginTop: 12,
                                            textAlign: "center"
                                        }}>
                                            <button
                                                onClick={() => setShowDownloadOptions(true)}
                                                style={{
                                                    padding: "6px 16px",
                                                    background: "#5AA9E6",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: 8,
                                                    cursor: "pointer",
                                                    fontSize: 11,
                                                    fontFamily: "inherit",
                                                    fontWeight: 600
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = "#3E7FB0"}
                                                onMouseLeave={e => e.currentTarget.style.background = "#5AA9E6"}
                                            >
                                                📥 Download History
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer */}
                            <div style={{
                                padding: "6px 16px",
                                borderTop: "1px solid #F5F7FA",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: 10,
                                color: "#94a3b8",
                                background: "#F5F7FA",
                                flexShrink: 0
                            }}>
                                <span>
                                    {messages.length} messages • {new Date().toLocaleTimeString()}
                                </span>
                                <span>
                                    {isConfigured ? "🤖 AI Ready" : "💡 Fallback Mode"}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}