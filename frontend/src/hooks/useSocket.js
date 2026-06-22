import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

let _socket = null;

function getSocket() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log("[WS] No token found, waiting for login...");
        return null;
    }

    if (_socket && _socket.connected) {
        return _socket;
    }

    if (_socket) {
        _socket.removeAllListeners();
        _socket.disconnect();
        _socket = null;
    }

    const socketUrl = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    console.log("[WS] Connecting to", socketUrl);
    
    try {
        _socket = io(socketUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnectionAttempts: 20,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            timeout: 15000,
        });

        _socket.on("connect", () => {
            console.log("[WS] Connected to backend");
        });
        
        _socket.on("disconnect", (reason) => {
            console.warn("[WS] Disconnected:", reason);
        });
        
        _socket.on("connect_error", (e) => {
            console.error("[WS] Connection error:", e.message);
        });
    } catch (err) {
        console.error("[WS] Socket creation error:", err);
        return null;
    }

    return _socket;
}

export function disconnectSocket() {
    if (_socket) {
        _socket.removeAllListeners();
        _socket.disconnect();
        _socket = null;
        console.log("[WS] Disconnected manually");
    }
}

export function useSocket(handlers) {
    const handlersRef = useRef(handlers);
    const [isConnected, setIsConnected] = useState(false);
    
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    useEffect(() => {
        let retryTimer = null;
        let wrappers = [];
        let currentSocket = null;

        function attach(socket) {
            if (!socket) return;
            
            wrappers.forEach(([ev, fn]) => {
                try { socket.off(ev, fn); } catch (e) {}
            });
            wrappers = [];
            
            const events = Object.keys(handlersRef.current || {});
            if (events.length === 0) return;
            
            events.forEach(event => {
                const wrapper = (...args) => {
                    try {
                        handlersRef.current[event]?.(...args);
                    } catch (err) {
                        console.error(`[WS] Error in handler for ${event}:`, err);
                    }
                };
                socket.on(event, wrapper);
                wrappers.push([event, wrapper]);
                console.log(`[WS] Registered handler for: ${event}`);
            });
        }

        function register() {
            const socket = getSocket();
            if (!socket) {
                retryTimer = setTimeout(register, 3000);
                return;
            }
            currentSocket = socket;
            attach(socket);
            setIsConnected(socket.connected);
            
            socket.on("connect", () => {
                console.log("[WS] Reconnected, reattaching handlers");
                setIsConnected(true);
                attach(socket);
            });
            
            socket.on("disconnect", () => {
                setIsConnected(false);
            });
        }

        register();

        return () => {
            clearTimeout(retryTimer);
            if (currentSocket) {
                wrappers.forEach(([ev, fn]) => {
                    try { currentSocket.off(ev, fn); } catch (e) {}
                });
            }
        };
    }, []);
    
    return { isConnected };
}