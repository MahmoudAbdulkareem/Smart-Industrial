// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

// Import gemini service with try-catch for safety
let geminiService;
try {
    geminiService = require("../services/aiService");
} catch (error) {
    console.error("[Chat] Failed to load geminiService:", error.message);
    // Create a fallback service
    geminiService = {
        isConfigured: false,
        sendMessage: async (sessionId, message, context) => {
            return {
                sessionId: sessionId || `fallback_${Date.now()}`,
                response: "I'm your Smart Manufacturing Assistant. I can help with work orders, assets, energy monitoring, and operational insights. What would you like to know?",
                history: [],
                isFallback: true
            };
        },
        startNewSession: (userId) => `chat_${userId}_${Date.now()}`,
        getHistory: () => [],
        clearSession: () => ({ success: true })
    };
}

// Test route to verify chat is working
router.get("/test", (req, res) => {
    res.json({ 
        status: "Chat routes are working!", 
        timestamp: new Date().toISOString(),
        geminiConfigured: geminiService.isConfigured || false
    });
});

/**
 * Send a message to the chatbot
 */
router.post("/message", requireAuth, async (req, res) => {
    try {
        console.log("[Chat] Received message request");
        console.log("[Chat] Body:", JSON.stringify(req.body, null, 2));
        
        const { message, sessionId, context } = req.body;
        
        // Validate input
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            console.log("[Chat] Invalid message received");
            return res.status(400).json({ 
                error: "Message is required",
                fallback: "Please enter a message to chat with me."
            });
        }

        // Get user info
        const userId = req.user?.id || req.user?._id || "anonymous";
        const userName = req.user?.name || "User";

        console.log(`[Chat] User ${userId} sent: "${message.substring(0, 50)}..."`);

        // Prepare context with dashboard data
        let enrichedContext = context || {};
        
        if (!context || Object.keys(context).length === 0) {
            try {
                const maximoService = require("../services/maximoService");
                const { query } = require("../db/pool");
                
                // Fetch work orders
                const workOrders = await maximoService.listWorkOrders().catch(() => []);
                
                // Fetch assets
                const assets = await query(
                    `SELECT TOP 5 id, name, type, status FROM assets WHERE status = 'OPERATING'`
                ).catch(() => []);
                
                // Fetch active alerts
                const alerts = await query(
                    `SELECT TOP 3 type, message, severity FROM alerts WHERE acknowledged = 0 ORDER BY created_at DESC`
                ).catch(() => []);
                
                const metrics = await maximoService.getWorkOrderMetrics().catch(() => ({}));
                
                enrichedContext = {
                    workOrders: workOrders || [],
                    assets: assets || [],
                    alerts: alerts || [],
                    metrics: metrics || {},
                    userId: userId,
                    userName: userName
                };
            } catch (error) {
                console.error("[Chat] Failed to fetch context:", error);
            }
        }

        // Send to Gemini service
        const result = await geminiService.sendMessage(
            sessionId || null,
            message.trim(),
            enrichedContext
        );

        if (result.error) {
            return res.status(503).json({
                error: result.error,
                fallback: result.fallback || "I'm having trouble connecting. Please try again later.",
                sessionId: result.sessionId,
                isFallback: true
            });
        }

        res.json({
            response: result.response || "I'm not sure how to respond to that.",
            sessionId: result.sessionId,
            history: result.history || []
        });
    } catch (error) {
        console.error("[Chat] Error:", error);
        res.status(500).json({ 
            error: error.message,
            fallback: "I'm sorry, I encountered an error. Please try again later."
        });
    }
});

/**
 * Start a new chat session
 */
router.post("/session", requireAuth, async (req, res) => {
    try {
        console.log("[Chat] Starting new session");
        const userId = req.user?.id || req.user?._id || "anonymous";
        const sessionId = geminiService.startNewSession(userId);
        res.json({ 
            sessionId,
            message: "New chat session started"
        });
    } catch (error) {
        console.error("[Chat] Failed to start session:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get chat history
 */
router.get("/history/:sessionId", requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }
        
        const history = geminiService.getHistory(sessionId);
        res.json({ history: history || [] });
    } catch (error) {
        console.error("[Chat] Failed to get history:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Clear chat session
 */
router.delete("/session/:sessionId", requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }
        
        const result = geminiService.clearSession(sessionId);
        res.json({ success: true, message: "Session cleared" });
    } catch (error) {
        console.error("[Chat] Failed to clear session:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;