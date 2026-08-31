// controllers/chatController.js
const geminiService = require("../services/geminiService");
const maximoService = require("../services/maximoService");

/**
 * Send a message to the chatbot
 */
async function sendMessage(req, res) {
    try {
        const { message, sessionId, context } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Get dashboard context if available
        let enrichedContext = context || {};
        if (!context || Object.keys(context).length === 0) {
            // Fetch real-time data for context
            try {
                const [workOrders, metrics] = await Promise.all([
                    maximoService.listWorkOrders(),
                    maximoService.getWorkOrderMetrics().catch(() => null)
                ]);
                
                enrichedContext = {
                    workOrders: workOrders ? workOrders.slice(0, 10) : [],
                    metrics: metrics || {},
                    userId: req.user?.id || "anonymous"
                };
            } catch (error) {
                console.error("Failed to fetch context:", error);
            }
        }

        const result = await geminiService.sendMessage(
            sessionId || null,
            message,
            enrichedContext
        );

        if (result.error) {
            return res.status(503).json({
                error: result.error,
                fallback: result.fallback,
                sessionId: result.sessionId
            });
        }

        res.json({
            response: result.response,
            sessionId: result.sessionId,
            history: result.history
        });
    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Start a new chat session
 */
async function startSession(req, res) {
    try {
        const sessionId = geminiService.startNewSession(req.user?.id || "anonymous");
        res.json({ sessionId });
    } catch (error) {
        console.error("Failed to start session:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get chat history
 */
async function getHistory(req, res) {
    try {
        const { sessionId } = req.params;
        const history = geminiService.getHistory(sessionId);
        res.json({ history });
    } catch (error) {
        console.error("Failed to get history:", error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Clear chat session
 */
async function clearSession(req, res) {
    try {
        const { sessionId } = req.params;
        const result = geminiService.clearSession(sessionId);
        res.json(result);
    } catch (error) {
        console.error("Failed to clear session:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    sendMessage,
    startSession,
    getHistory,
    clearSession
};