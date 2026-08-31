// services/aiService.js
const OpenAI = require('openai');

// Get API key from environment
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// Initialize OpenRouter
let openai = null;
let isConfigured = false;
let activeModel = "openai/gpt-3.5-turbo";

try {
    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "" && OPENROUTER_API_KEY !== "your_openrouter_api_key_here") {
        openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: OPENROUTER_API_KEY,
            defaultHeaders: {
                "HTTP-Referer": process.env.APP_URL || "http://localhost:5000",
                "X-Title": "Smart Manufacturing Dashboard",
            }
        });
        isConfigured = true;
        console.log("[AI] ✅ OpenRouter initialized successfully");
        console.log("[AI] Using model: " + activeModel);
    } else {
        console.warn("[AI] ⚠️ OpenRouter API key not configured.");
        console.warn("[AI] Get your free API key at: https://openrouter.ai/");
        console.warn("[AI] Using fallback responses.");
    }
} catch (error) {
    console.error("[AI] ❌ Failed to initialize:", error.message);
}

// System prompt
const SYSTEM_PROMPT = `You are an expert Industrial IoT and Smart Manufacturing Assistant for a manufacturing plant.

ABOUT THE DASHBOARD:
You have access to a Smart Manufacturing Dashboard that monitors:
1. WORK ORDERS - Track maintenance tasks with statuses (WAPPR, APPR, INPRG, COMP, CLOSE, CAN)
2. ASSETS - Equipment health scores, RUL predictions, MTBF, and sensor data
3. ENERGY - Real-time PUE, EER, CO2 emissions, and consumption trends
4. ALERTS - Predictive maintenance alerts and anomaly detection
5. ML PREDICTIONS - Isolation Forest anomaly detection, RUL forecasts
6. SENSOR DATA - Live readings from IoT sensors on equipment

YOUR PERSONALITY:
- Professional but conversational and approachable
- Data-driven and precise
- Proactive in suggesting best practices
- Always provide actionable insights

CAPABILITIES:
- Answer questions about work orders, assets, energy, and alerts
- Explain technical concepts in simple terms
- Suggest maintenance strategies based on asset health
- Help optimize energy consumption
- Interpret ML predictions and anomalies
- Guide users through dashboard features

RESPONSE STYLE:
- Use clear, concise language
- Use bullet points for lists (use • for bullet points)
- Use emojis sparingly for visual appeal (📋, 🏭, ⚡, ⚠️, 📊, 💡)
- Be specific about dashboard sections
- Provide examples when helpful
- Ask clarifying questions when needed

Always remember: You are an AI assistant for a manufacturing plant. Help users make better operational decisions!`;

// Chat history storage
const chatSessions = new Map();

class AIService {
    constructor() {
        this.isConfigured = isConfigured;
        this.activeModel = process.env.AI_MODEL || "openai/gpt-3.5-turbo";
        
        if (this.isConfigured) {
            console.log(`[AI] ✅ Service ready with model: ${this.activeModel}`);
        }
    }

    /**
     * Start a new chat session
     */
    startNewSession(userId) {
        const sessionId = `chat_${userId}_${Date.now()}`;
        
        chatSessions.set(sessionId, {
            messages: [
                { role: "system", content: SYSTEM_PROMPT }
            ],
            history: [],
            createdAt: new Date(),
            userId
        });
        
        console.log(`[AI] 📝 New session started: ${sessionId}`);
        return sessionId;
    }

    /**
     * Send a message with context
     */
    async sendMessage(sessionId, message, context = {}) {
        // Validate session
        let session = chatSessions.get(sessionId);
        if (!session) {
            sessionId = this.startNewSession(context.userId || "anonymous");
            session = chatSessions.get(sessionId);
        }

        // If not configured, use fallback
        if (!this.isConfigured || !openai) {
            const fallbackResponse = this.getFallbackResponse(message, context);
            session.history.push({ role: "user", content: message });
            session.history.push({ role: "assistant", content: fallbackResponse });
            
            return {
                sessionId,
                response: fallbackResponse,
                history: session.history.slice(-20),
                isFallback: true,
                usingAI: false
            };
        }

        try {
            // Build context message
            const enhancedMessage = this.buildContextMessage(message, context);
            
            // Prepare messages for API
            const messages = [
                { role: "system", content: SYSTEM_PROMPT },
                ...session.messages.slice(-10),
                { role: "user", content: enhancedMessage }
            ];

            console.log(`[AI] 💬 Sending to ${this.activeModel}...`);
            
            // Send to OpenRouter
            const startTime = Date.now();
            const completion = await openai.chat.completions.create({
                model: this.activeModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048,
            });
            
            const response = completion.choices[0]?.message?.content || "I'm not sure how to respond to that.";
            const elapsed = Date.now() - startTime;
            
            console.log(`[AI] ⏱️ Response in ${elapsed}ms`);

            // Store in history
            session.messages.push({ role: "user", content: message });
            session.messages.push({ role: "assistant", content: response });
            session.history.push({ role: "user", content: message });
            session.history.push({ role: "assistant", content: response });

            return {
                sessionId,
                response,
                history: session.history.slice(-20),
                isFallback: false,
                usingAI: true,
                model: this.activeModel,
                elapsed
            };
        } catch (error) {
            console.error("[AI] ❌ API Error:", error.message);
            
            // Use fallback on error
            const fallbackResponse = this.getFallbackResponse(message, context);
            session.history.push({ role: "user", content: message });
            session.history.push({ role: "assistant", content: fallbackResponse });
            
            return {
                sessionId,
                response: fallbackResponse,
                history: session.history.slice(-20),
                isFallback: true,
                usingAI: false,
                error: error.message
            };
        }
    }

    /**
     * Build enhanced message with dashboard context
     */
    buildContextMessage(message, context) {
        let contextParts = [];
        
        if (context.workOrders && context.workOrders.length > 0) {
            const woSummary = context.workOrders.slice(0, 10).map(wo => 
                `• ${wo.wonum || 'N/A'}: ${wo.status || 'Unknown'} (Priority: ${wo.priority || 'N/A'})`
            ).join('\n');
            contextParts.push(`\n📋 RECENT WORK ORDERS:\n${woSummary}`);
        }

        if (context.assets && context.assets.length > 0) {
            const assetSummary = context.assets.slice(0, 10).map(a => 
                `• ${a.name || a.assetnum || 'N/A'}: ${a.status || 'Operating'}`
            ).join('\n');
            contextParts.push(`\n🏭 ASSETS:\n${assetSummary}`);
        }

        if (context.alerts && context.alerts.length > 0) {
            const alertSummary = context.alerts.slice(0, 5).map(a => 
                `• ${a.type || 'Alert'}: ${a.message || 'No message'}`
            ).join('\n');
            contextParts.push(`\n⚠️ ACTIVE ALERTS:\n${alertSummary}`);
        }

        if (context.metrics && Object.keys(context.metrics).length > 0) {
            const metricsParts = [];
            if (context.metrics.total !== undefined) metricsParts.push(`Total Work Orders: ${context.metrics.total}`);
            if (context.metrics.in_progress !== undefined) metricsParts.push(`In Progress: ${context.metrics.in_progress}`);
            
            if (metricsParts.length > 0) {
                contextParts.push(`\n📊 SYSTEM METRICS:\n${metricsParts.join('\n')}`);
            }
        }

        let enhancedMessage = message;
        if (contextParts.length > 0) {
            enhancedMessage = `[Dashboard Context:${contextParts.join('')}]\n\nUser Question: ${message}`;
        }

        return enhancedMessage;
    }

    /**
     * Get chat history
     */
    getHistory(sessionId) {
        const session = chatSessions.get(sessionId);
        return session ? session.history : [];
    }

    /**
     * Clear chat session
     */
    clearSession(sessionId) {
        const result = chatSessions.delete(sessionId);
        if (result) {
            console.log(`[AI] 🗑️ Session cleared: ${sessionId}`);
        }
        return result;
    }

    /**
     * Smart fallback responses
     */
    getFallbackResponse(message, context = {}) {
        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('work order') || lowerMsg.includes('workorder') || lowerMsg.includes('wo')) {
            const woCount = context?.metrics?.total || 0;
            if (woCount > 0) {
                return `📋 WORK ORDERS SUMMARY:\n\nYou have ${woCount} total work orders.\n• In Progress: ${context?.metrics?.in_progress || 0}\n• Waiting Approval: ${context?.metrics?.waiting_approval || 0}\n\n💡 Go to the Work Orders section to view all details.`;
            }
            return "📋 Work orders are available in the Work Orders section. Click the '+' button to create a new one.";
        }
        
        if (lowerMsg.includes('asset') || lowerMsg.includes('machine') || lowerMsg.includes('equipment')) {
            return "🏭 Assets are displayed in the Assets section. You can see their status, health metrics, and maintenance history.";
        }
        
        if (lowerMsg.includes('energy') || lowerMsg.includes('power') || lowerMsg.includes('pue')) {
            return "⚡ Energy data is available in the Energy Dashboard. View real-time consumption, PUE, EER, and CO2 emissions.";
        }
        
        if (lowerMsg.includes('alert') || lowerMsg.includes('warning')) {
            const alertCount = context?.alerts?.length || 0;
            if (alertCount > 0) {
                return `⚠️ You have ${alertCount} active alerts. Check the Alerts section to view and acknowledge them.`;
            }
            return "⚠️ No active alerts at the moment. Check the Alerts section for historical alerts.";
        }
        
        if (lowerMsg.includes('help') || lowerMsg.includes('what can you')) {
            return `🤖 HOW I CAN HELP YOU:

I can assist with:
1. 📋 Work Orders - View, create, update, and track maintenance
2. 🏭 Assets - Monitor health, RUL predictions, and maintenance
3. ⚡ Energy - Track consumption, PUE, EER, and optimize
4. ⚠️ Alerts - View and acknowledge predictive alerts
5. 📊 ML Predictions - Anomaly detection and RUL forecasts

💡 Just ask me a question about any of these topics!`;
        }
        
        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
            return "👋 Hello! I'm your Smart Manufacturing Assistant. I can help with work orders, assets, energy, alerts, and ML predictions. What would you like to know?";
        }
        
        return `🤖 I'm your Smart Manufacturing Assistant. I can help with work orders, assets, energy, alerts, and ML predictions. What would you like to know?`;
    }
}

module.exports = new AIService();