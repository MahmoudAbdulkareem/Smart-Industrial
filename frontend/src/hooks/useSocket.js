import { useEffect, useRef } from "react";
import { useSocketContext } from "../context/SocketContext";

export function useSocket(handlers) {
    const { socket, isConnected, connectionError, on, off, reconnect } = useSocketContext();
    const handlersRef = useRef(handlers);
    const registeredHandlersRef = useRef([]);
    
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    useEffect(() => {
        // Clean up previous handlers
        registeredHandlersRef.current.forEach(({ event, handler }) => {
            off(event, handler);
        });
        registeredHandlersRef.current = [];

        if (!socket) {
            console.log("[useSocket] Socket not initialized");
            return;
        }

        if (!isConnected) {
            console.log("[useSocket] Socket not connected, waiting...");
            reconnect();
            return;
        }

        const events = Object.keys(handlersRef.current || {});

        if (events.length === 0) {
            console.warn("[useSocket] No handlers provided");
            return;
        }

        events.forEach(event => {
            const handler = (...args) => {
                try {
                    if (handlersRef.current[event]) {
                        handlersRef.current[event](...args);
                    }
                } catch (err) {
                    console.error(`[useSocket] Error in handler for ${event}:`, err);
                }
            };
            
            on(event, handler);
            registeredHandlersRef.current.push({ event, handler });
            console.log(`[useSocket] Registered handler for: ${event}`);
        });

        return () => {
            registeredHandlersRef.current.forEach(({ event, handler }) => {
                off(event, handler);
                console.log(`[useSocket] Unregistered handler for: ${event}`);
            });
            registeredHandlersRef.current = [];
        };
    }, [socket, isConnected, on, off, reconnect]);

    return { isConnected, connectionError };
}