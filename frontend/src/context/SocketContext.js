import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

export function useSocketContext() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocketContext must be used within a SocketProvider");
    }
    return context;
}

export function SocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false);
    const [socketInstance, setSocketInstance] = useState(null);
    const [connectionError, setConnectionError] = useState(null);
    const socketRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        let reconnectTimer = null;

        const connectSocket = () => {
            const token = localStorage.getItem("token");
            if (!token) {
                console.log("[SocketProvider] No token found");
                setConnectionError("No authentication token");
                return;
            }

            const socketUrl = process.env.REACT_APP_SOCKET_URL || 
                             process.env.REACT_APP_API_URL || 
                             "http://localhost:5000";

            // Clean up existing socket
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
            }

            console.log("[SocketProvider] Connecting to:", socketUrl);

            try {
                const socket = io(socketUrl, {
                    auth: { token },
                    transports: ["websocket", "polling"],
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000,
                    reconnectionDelayMax: 10000,
                    timeout: 15000,
                    forceNew: true,
                    path: '/socket.io',
                    withCredentials: true,
                });

                socket.on("connect", () => {
                    if (!mountedRef.current) return;
                    console.log("[SocketProvider] ✅ Connected to server with ID:", socket.id);
                    setIsConnected(true);
                    setSocketInstance(socket);
                    setConnectionError(null);
                });

                socket.on("connect_error", (error) => {
                    if (!mountedRef.current) return;
                    console.error("[SocketProvider] Connection error:", error.message);
                    setConnectionError(error.message);
                    setIsConnected(false);
                    
                    // Try polling if websocket fails
                    if (error.message.includes('websocket') && socket.io.opts.transports[0] === 'websocket') {
                        console.log("[SocketProvider] Falling back to polling transport");
                        socket.io.opts.transports = ['polling', 'websocket'];
                        setTimeout(() => {
                            if (mountedRef.current && !socket.connected) {
                                socket.connect();
                            }
                        }, 1000);
                    }
                });

                socket.on("disconnect", (reason) => {
                    if (!mountedRef.current) return;
                    console.log("[SocketProvider] Disconnected:", reason);
                    setIsConnected(false);
                    
                    if (reason === "io server disconnect") {
                        // Server disconnected us, try to reconnect
                        setTimeout(() => {
                            if (mountedRef.current && socketRef.current) {
                                socketRef.current.connect();
                            }
                        }, 2000);
                    }
                });

                socket.on("reconnect", (attemptNumber) => {
                    if (!mountedRef.current) return;
                    console.log(`[SocketProvider] Reconnected after ${attemptNumber} attempts`);
                    setIsConnected(true);
                    setSocketInstance(socket);
                    setConnectionError(null);
                });

                socket.on("reconnect_attempt", (attempt) => {
                    console.log(`[SocketProvider] Reconnection attempt ${attempt}`);
                    const newToken = localStorage.getItem("token");
                    if (newToken && socket.auth.token !== newToken) {
                        socket.auth = { token: newToken };
                    }
                });

                socket.on("reconnect_error", (error) => {
                    console.error("[SocketProvider] Reconnection error:", error.message);
                    setConnectionError(error.message);
                });

                socket.on("reconnect_failed", () => {
                    console.error("[SocketProvider] Reconnection failed");
                    setConnectionError("Failed to reconnect");
                    setIsConnected(false);
                });

                socketRef.current = socket;
                setSocketInstance(socket);

                if (socket.connected) {
                    setIsConnected(true);
                    setConnectionError(null);
                }

            } catch (error) {
                console.error("[SocketProvider] Error creating socket:", error);
                setConnectionError(error.message);
                setIsConnected(false);
            }
        };

        connectSocket();

        // Retry connection every 10 seconds if not connected
        const retryInterval = setInterval(() => {
            if (!mountedRef.current) return;
            
            if (!socketRef.current || !socketRef.current.connected) {
                console.log("[SocketProvider] Retrying connection...");
                connectSocket();
            }
        }, 10000);

        return () => {
            mountedRef.current = false;
            clearInterval(retryInterval);
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setSocketInstance(null);
            setIsConnected(false);
        };
    }, []);

    // Listen for auth changes
    useEffect(() => {
        const handleAuthChange = () => {
            const token = localStorage.getItem("token");
            if (token && socketRef.current) {
                socketRef.current.auth = { token };
                if (!socketRef.current.connected) {
                    socketRef.current.connect();
                }
            } else if (!token && socketRef.current) {
                socketRef.current.disconnect();
                setIsConnected(false);
            }
        };

        window.addEventListener('storage', handleAuthChange);
        return () => {
            window.removeEventListener('storage', handleAuthChange);
        };
    }, []);

    const value = {
        socket: socketInstance,
        isConnected,
        connectionError,
        emit: (event, data) => {
            if (socketRef.current && socketRef.current.connected) {
                socketRef.current.emit(event, data);
                return true;
            } else {
                console.warn(`[SocketProvider] Cannot emit "${event}" - socket not connected`);
                return false;
            }
        },
        on: (event, callback) => {
            if (socketRef.current) {
                socketRef.current.on(event, callback);
            } else {
                console.warn(`[SocketProvider] Cannot listen to "${event}" - socket not initialized`);
            }
        },
        off: (event, callback) => {
            if (socketRef.current) {
                socketRef.current.off(event, callback);
            }
        },
        reconnect: () => {
            if (socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
            }
        }
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export default SocketProvider;