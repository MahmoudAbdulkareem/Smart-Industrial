import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext();

let socket = null;

export function useSocketContext() {
    return useContext(SocketContext);
}

export function SocketProvider({ children }) {
    const [isConnected, setIsConnected] = useState(false);
    const [socketInstance, setSocketInstance] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        if (!socket) {
            socket = io("http://localhost:5000", {
                auth: { token },
                transports: ["websocket", "polling"],
            });
        }

        socket.on("connect", () => {
            console.log("[SocketContext] Connected");
            setIsConnected(true);
        });

        socket.on("disconnect", () => {
            console.log("[SocketContext] Disconnected");
            setIsConnected(false);
        });

        setSocketInstance(socket);

        return () => {
            if (socket) {
                socket.off("connect");
                socket.off("disconnect");
            }
        };
    }, []);

    const value = {
        socket: socketInstance,
        isConnected,
        emit: (event, data) => socketInstance?.emit(event, data),
        on: (event, callback) => socketInstance?.on(event, callback),
        off: (event, callback) => socketInstance?.off(event, callback),
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}