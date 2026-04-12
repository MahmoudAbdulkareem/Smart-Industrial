const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "smart_dashboard_secret_2026";

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: "8h" }
    );
}

function requireAuth(req, res, next) {
    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }
    try {
        req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: "Access denied" });
        }
        next();
    };
}

module.exports = { generateToken, requireAuth, requireRole };
