

const swaggerUi  = require("swagger-ui-express");

const spec = {
    openapi: "3.0.3",
    info: {
        title:       "Smart Industrial Dashboard API",
        version:     "2.0.0",
        description: "REST API for the Smart Industrial Dashboard — predictive maintenance, energy monitoring, IoT pipeline, and automated work orders.",
        contact: { name: "SINORFI / PFE 2025–2026" },
    },
    servers: [
        { url: "http://localhost:5000", description: "Local development" },
        { url: "http://smart-backend:5000", description: "Docker Compose internal" },
    ],
    tags: [
        { name: "Status",       description: "Server health check" },
        { name: "Auth",         description: "Authentication and 2FA (TOTP)" },
        { name: "Assets",       description: "Asset health and sensor readings" },
        { name: "Energy",       description: "Energy metrics and history" },
        { name: "Alerts",       description: "Alert management" },
        { name: "Work Orders",  description: "Work order lifecycle" },
        { name: "Thresholds",   description: "Configurable alert thresholds" },
        { name: "Users",        description: "User management (it_admin only)" },
        { name: "Audit",        description: "Audit log" },
        { name: "Reports",      description: "Export reports (HTML / Excel / PDF)" },
        { name: "Chatbot",      description: "Gemini-powered assistant proxy" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type:         "http",
                scheme:       "bearer",
                bearerFormat: "JWT",
                description:  "JWT token obtained from POST /api/auth/login",
            },
        },
        schemas: {
            // ── Common ────────────────────────────────────────────────────────
            Error: {
                type: "object",
                properties: {
                    error: { type: "string", example: "Unauthorized" },
                },
            },
            // ── Auth ──────────────────────────────────────────────────────────
            LoginRequest: {
                type: "object", required: ["email", "password"],
                properties: {
                    email:    { type: "string", format: "email", example: "maintenance@dashboard.com" },
                    password: { type: "string", example: "Maint@2026" },
                },
            },
            LoginResponse: {
                type: "object",
                properties: {
                    token:         { type: "string", description: "JWT (present when totp_required=false)" },
                    totp_required: { type: "boolean", example: false },
                    setup_token:   { type: "string", description: "Short-lived token for TOTP setup flow" },
                    role:          { type: "string", enum: ["maintenance_engineer","energy_manager","it_admin"] },
                    name:          { type: "string", example: "Ali Hassan" },
                },
            },
            TotpVerifyRequest: {
                type: "object", required: ["email", "token"],
                properties: {
                    email: { type: "string", format: "email" },
                    token: { type: "string", example: "123456" },
                },
            },
            // ── Asset ─────────────────────────────────────────────────────────
            AssetHealth: {
                type: "object",
                properties: {
                    id:          { type: "string", example: "AST-001" },
                    name:        { type: "string", example: "Compressor Unit A" },
                    type:        { type: "string", example: "Compressor" },
                    location:    { type: "string", example: "Zone 1" },
                    healthScore: { type: "number", minimum: 0, maximum: 100, example: 88 },
                    rul:         { type: "number", description: "Remaining Useful Life (days)", example: 398 },
                    mtbf:        { type: "number", description: "Mean Time Between Failures (hours)", example: 804 },
                    status:      { type: "string", enum: ["healthy","caution","critical"] },
                    vibration:   { type: "number", example: 1.2 },
                    temperature: { type: "number", example: 45.3 },
                    pressure:    { type: "number", example: 2.5 },
                    anomaly:     { type: "boolean", example: false },
                },
            },
            // ── Energy ────────────────────────────────────────────────────────
            EnergyZone: {
                type: "object",
                properties: {
                    zone:             { type: "string", example: "Zone 1" },
                    electricity_kwh:  { type: "number", example: 142.5 },
                    electricity_base: { type: "number", example: 130.0 },
                    water_lpm:        { type: "number", example: 45.2 },
                    gas_m3h:          { type: "number", example: 12.1 },
                    pue:              { type: "number", description: "Power Usage Effectiveness", example: 1.42 },
                    eer:              { type: "number", description: "Energy Efficiency Ratio",   example: 3.8 },
                    co2_emissions:    { type: "number", description: "CO₂ kg/h",                  example: 28.4 },
                },
            },
            // ── Alert ─────────────────────────────────────────────────────────
            Alert: {
                type: "object",
                properties: {
                    id:           { type: "integer", example: 1 },
                    asset_id:     { type: "string",  example: "AST-003" },
                    asset_name:   { type: "string",  example: "Conveyor Belt C" },
                    severity:     { type: "string",  enum: ["critical","caution"] },
                    message:      { type: "string",  example: "Health score dropped to 22/100" },
                    acknowledged: { type: "boolean", example: false },
                    created_at:   { type: "string",  format: "date-time" },
                },
            },
            // ── Work Order ────────────────────────────────────────────────────
            WorkOrder: {
                type: "object",
                properties: {
                    id:          { type: "integer", example: 1 },
                    wonum:       { type: "string",  example: "WO-2026-0042" },
                    asset_id:    { type: "string",  example: "AST-003" },
                    asset_name:  { type: "string",  example: "Conveyor Belt C" },
                    description: { type: "string",  example: "Critical vibration detected — inspect bearings" },
                    status:      { type: "string",  enum: ["WAPPR","APPR","INPRG","WMATL","COMP","CAN"] },
                    priority:    { type: "string",  enum: ["Low","Medium","High","Critical"] },
                    created_by:  { type: "string",  example: "Ali Hassan" },
                    created_at:  { type: "string",  format: "date-time" },
                },
            },
            WorkOrderCreateRequest: {
                type: "object", required: ["assetId","description"],
                properties: {
                    assetId:     { type: "string", example: "AST-003" },
                    description: { type: "string", example: "Vibration abnormally high — schedule bearing inspection" },
                    priority:    { type: "string", enum: ["Low","Medium","High","Critical"], default: "Medium" },
                },
            },
            // ── Threshold ─────────────────────────────────────────────────────
            ThresholdRequest: {
                type: "object", required: ["assetId","metric","value"],
                properties: {
                    assetId: { type: "string", example: "AST-001" },
                    metric:  { type: "string", example: "vibration", description: "health_score | vibration | temperature | pressure | electricity_kwh" },
                    value:   { type: "number", example: 8.0 },
                },
            },
            // ── User ──────────────────────────────────────────────────────────
            User: {
                type: "object",
                properties: {
                    id:          { type: "integer", example: 1 },
                    name:        { type: "string",  example: "Ali Hassan" },
                    email:       { type: "string",  format: "email" },
                    role:        { type: "string",  enum: ["maintenance_engineer","energy_manager","it_admin"] },
                    is_active:   { type: "boolean", example: true },
                    totp_enabled:{ type: "boolean", example: true },
                    created_at:  { type: "string",  format: "date-time" },
                },
            },
            UserCreateRequest: {
                type: "object", required: ["name","email","role","password"],
                properties: {
                    name:         { type: "string",  example: "Sara Khalid" },
                    email:        { type: "string",  format: "email", example: "sara@dashboard.com" },
                    role:         { type: "string",  enum: ["maintenance_engineer","energy_manager","it_admin"] },
                    password:     { type: "string",  example: "Secure@2026" },
                    phone_number: { type: "string",  example: "+21699000000" },
                },
            },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        // ── Status ────────────────────────────────────────────────────────────
        "/api/status": {
            get: {
                tags: ["Status"], summary: "Server health check",
                security: [],
                responses: {
                    200: { description: "Server is running", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" }, version: { type: "string" }, uptime: { type: "number" } } } } } },
                },
            },
        },
        // ── Auth ──────────────────────────────────────────────────────────────
        "/api/auth/login": {
            post: {
                tags: ["Auth"], summary: "Login with email + password",
                security: [],
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
                responses: {
                    200: { description: "Login successful — returns JWT or TOTP challenge", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
                    400: { description: "Missing email or password" },
                    401: { description: "Invalid credentials" },
                    403: { description: "Account inactive" },
                    429: { description: "Too many requests (rate limited: 20 req/15 min)" },
                },
            },
        },
        "/api/auth/verify-totp": {
            post: {
                tags: ["Auth"], summary: "Verify 6-digit TOTP code (2FA step)",
                security: [],
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/TotpVerifyRequest" } } } },
                responses: {
                    200: { description: "TOTP valid — returns JWT", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" }, role: { type: "string" } } } } } },
                    401: { description: "Invalid or expired TOTP code" },
                },
            },
        },
        "/api/auth/totp-setup": {
            post: {
                tags: ["Auth"], summary: "Generate TOTP secret and QR code for first-time 2FA setup",
                security: [{ bearerAuth: [] }],
                description: "Requires the short-lived setup_token from login. Returns a QR code URL to scan with Google Authenticator.",
                responses: {
                    200: { description: "QR code data URL + otpauth URI", content: { "application/json": { schema: { type: "object", properties: { qrCode: { type: "string" }, otpauthUrl: { type: "string" } } } } } },
                    401: { description: "Invalid or expired setup token" },
                },
            },
        },
        "/api/auth/totp-enable": {
            post: {
                tags: ["Auth"], summary: "Confirm and enable 2FA after scanning QR",
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string", example: "123456" } } } } } },
                responses: {
                    200: { description: "2FA enabled — returns full JWT", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } },
                    401: { description: "Invalid TOTP code" },
                },
            },
        },
        "/api/auth/qr-generate": {
            post: {
                tags: ["Auth"], summary: "Generate a QR code for mobile scan-to-login",
                security: [],
                responses: {
                    200: { description: "QR token + short-lived polling ID", content: { "application/json": { schema: { type: "object", properties: { qrToken: { type: "string" }, expiresIn: { type: "integer", example: 120 } } } } } },
                },
            },
        },
        "/api/auth/qr-approve": {
            get: {
                tags: ["Auth"], summary: "Poll QR login approval (called by mobile)",
                parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
                responses: {
                    200: { description: "Approval result", content: { "application/json": { schema: { type: "object", properties: { approved: { type: "boolean" }, token: { type: "string" } } } } } },
                    401: { description: "Expired or invalid QR token" },
                },
            },
        },
        "/api/auth/me": {
            get: {
                tags: ["Auth"], summary: "Get current user profile",
                responses: {
                    200: { description: "Current user", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        // ── Assets ────────────────────────────────────────────────────────────
        "/api/assets/health": {
            get: {
                tags: ["Assets"], summary: "Get latest health readings for all 5 assets",
                description: "Returns health score, RUL, MTBF, live sensor readings, and anomaly flag for each asset. Also triggers a new ML prediction cycle.",
                responses: {
                    200: { description: "Array of asset health objects", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/AssetHealth" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        // ── Energy ────────────────────────────────────────────────────────────
        "/api/energy": {
            get: {
                tags: ["Energy"], summary: "Get current energy metrics for all zones",
                responses: {
                    200: { description: "Array of zone energy objects", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/EnergyZone" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        "/api/energy/history": {
            get: {
                tags: ["Energy"], summary: "Get 24-hour energy history per zone",
                parameters: [{ name: "zone", in: "query", schema: { type: "string" }, description: "Filter by zone name (optional)" }],
                responses: {
                    200: { description: "Hourly history array", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        // ── Alerts ────────────────────────────────────────────────────────────
        "/api/alerts": {
            get: {
                tags: ["Alerts"], summary: "List all alerts (critical first)",
                responses: {
                    200: { description: "Array of alerts", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Alert" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        "/api/alerts/{id}/acknowledge": {
            patch: {
                tags: ["Alerts"], summary: "Acknowledge an alert",
                description: "Requires role: maintenance_engineer or it_admin",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Alert acknowledged" },
                    403: { description: "Insufficient role" },
                    404: { description: "Alert not found" },
                },
            },
        },
        // ── Work Orders ───────────────────────────────────────────────────────
        "/api/workorders": {
            get: {
                tags: ["Work Orders"], summary: "List all work orders",
                responses: {
                    200: { description: "Array of work orders", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WorkOrder" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
            post: {
                tags: ["Work Orders"], summary: "Create a work order manually",
                description: "Requires role: maintenance_engineer. Auto-created WOs use prefix AUTO-.",
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkOrderCreateRequest" } } } },
                responses: {
                    201: { description: "Work order created", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkOrder" } } } },
                    400: { description: "Missing required fields" },
                    403: { description: "Insufficient role" },
                },
            },
        },
        "/api/workorders/{id}/status": {
            patch: {
                tags: ["Work Orders"], summary: "Update work order status",
                description: "Valid transitions: WAPPR→APPR→INPRG→WMATL→COMP or any→CAN",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["WAPPR","APPR","INPRG","WMATL","COMP","CAN"] } } } } } },
                responses: {
                    200: { description: "Status updated" },
                    400: { description: "Invalid status" },
                    403: { description: "Insufficient role" },
                    404: { description: "Work order not found" },
                },
            },
        },
        // ── Thresholds ────────────────────────────────────────────────────────
        "/api/thresholds": {
            get: {
                tags: ["Thresholds"], summary: "List all configured thresholds",
                responses: {
                    200: { description: "Array of thresholds with asset names joined in", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ThresholdRequest" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
            post: {
                tags: ["Thresholds"], summary: "Create or update a threshold",
                description: "Requires role: energy_manager. Upserts: creates if not exists, updates if already set.",
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ThresholdRequest" } } } },
                responses: {
                    200: { description: "Threshold saved" },
                    400: { description: "Missing fields" },
                    403: { description: "Insufficient role (energy_manager required)" },
                },
            },
        },
        "/api/thresholds/{id}": {
            delete: {
                tags: ["Thresholds"], summary: "Delete a threshold",
                description: "Requires role: energy_manager.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Threshold deleted" },
                    400: { description: "Invalid threshold ID" },
                    403: { description: "Insufficient role (energy_manager required)" },
                    404: { description: "Threshold not found" },
                },
            },
        },
        "/api/energy/weekly": {
            get: {
                tags: ["Energy"], summary: "Get 7-day average daily energy consumption",
                description: "Used by the weekly trend chart. Returns one row per day with averaged electricity, water, gas, PUE, and CO2.",
                responses: {
                    200: { description: "Array of daily averages", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        "/api/energy/zones": {
            get: {
                tags: ["Energy"], summary: "Get latest snapshot per zone (not aggregated)",
                description: "Used by the zone comparison bar chart to show which zone is over-consuming.",
                responses: {
                    200: { description: "Array of per-zone snapshots", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/EnergyZone" } } } } },
                    401: { description: "Not authenticated" },
                },
            },
        },
        // ── Users ─────────────────────────────────────────────────────────────
        "/api/users": {
            get: {
                tags: ["Users"], summary: "List all users (it_admin only)",
                responses: {
                    200: { description: "Array of users", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } },
                    403: { description: "Insufficient role" },
                },
            },
            post: {
                tags: ["Users"], summary: "Create a new user (it_admin only)",
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserCreateRequest" } } } },
                responses: {
                    201: { description: "User created", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
                    400: { description: "Validation error" },
                    403: { description: "Insufficient role" },
                    409: { description: "Email already in use" },
                },
            },
        },
        "/api/users/{id}": {
            get: {
                tags: ["Users"], summary: "Get a user by ID (it_admin only)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                responses: { 200: { description: "User object" }, 403: { description: "Insufficient role" }, 404: { description: "Not found" } },
            },
            put: {
                tags: ["Users"], summary: "Update a user (it_admin only)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserCreateRequest" } } } },
                responses: { 200: { description: "User updated" }, 403: { description: "Insufficient role" }, 404: { description: "Not found" } },
            },
            delete: {
                tags: ["Users"], summary: "Delete a user permanently (it_admin only)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                responses: { 200: { description: "User deleted" }, 403: { description: "Insufficient role" }, 404: { description: "Not found" } },
            },
        },
        "/api/users/{id}/toggle-active": {
            patch: {
                tags: ["Users"], summary: "Activate or deactivate a user account (it_admin only)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                responses: { 200: { description: "Active status toggled" }, 403: { description: "Insufficient role" } },
            },
        },
        "/api/users/{id}/reset-totp": {
            post: {
                tags: ["Users"], summary: "Reset a user's 2FA secret (it_admin only)",
                description: "Forces the user to re-scan a new QR code on next login.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                responses: { 200: { description: "TOTP reset" }, 403: { description: "Insufficient role" } },
            },
        },
        // ── Audit ─────────────────────────────────────────────────────────────
        "/api/audit-logs": {
            get: {
                tags: ["Audit"], summary: "Get paginated audit log (it_admin only)",
                parameters: [
                    { name: "page",   in: "query", schema: { type: "integer", default: 1 } },
                    { name: "limit",  in: "query", schema: { type: "integer", default: 50 } },
                    { name: "action", in: "query", schema: { type: "string" }, description: "Filter by action type e.g. LOGIN_SUCCESS" },
                ],
                responses: {
                    200: { description: "Audit log entries", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
                    403: { description: "Insufficient role" },
                },
            },
        },
        // ── Reports ───────────────────────────────────────────────────────────
        "/api/reports/energy": {
            get: {
                tags: ["Reports"], summary: "Download energy + asset health report",
                parameters: [{
                    name: "format", in: "query",
                    schema: { type: "string", enum: ["html","excel","pdf"], default: "html" },
                    description: "html = printable HTML | excel = .xls SpreadsheetML (3 sheets) | pdf = PDF via Puppeteer",
                }],
                responses: {
                    200: {
                        description: "Report file",
                        content: {
                            "text/html":                  { schema: { type: "string", format: "binary" } },
                            "application/vnd.ms-excel":   { schema: { type: "string", format: "binary" } },
                            "application/pdf":            { schema: { type: "string", format: "binary" } },
                        },
                    },
                    401: { description: "Not authenticated" },
                },
            },
        },
        // ── Chatbot ───────────────────────────────────────────────────────────
        "/api/chatbot": {
            post: {
                tags: ["Chatbot"], summary: "Send message to Gemini assistant (server-side proxy)",
                description: "The Gemini API key is kept server-side. The chatbot only answers questions about the Smart Dashboard application.",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["history"], properties: { history: { type: "array", items: { type: "object", properties: { role: { type: "string", enum: ["user","assistant"] }, content: { type: "string" } } } } } } } },
                },
                responses: {
                    200: { description: "Chatbot reply", content: { "application/json": { schema: { type: "object", properties: { reply: { type: "string" } } } } } },
                    400: { description: "Missing history array" },
                    401: { description: "Not authenticated" },
                    503: { description: "GEMINI_API_KEY not configured" },
                },
            },
        },
    },
};

module.exports = { swaggerUi, spec };
