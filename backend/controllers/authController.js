const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const userRepository = require("../repositories/userRepository");
const auditService = require("../services/auditService");
const { generateToken, JWT_SECRET } = require("../middleware/auth");

const pendingTotp = new Map();

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await userRepository.findByEmail(email);
        if (!user || !user.is_active) return res.status(401).json({ error: "Invalid credentials" });
        if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });

        if (!user.totp_enabled) {
            const setupToken = jwt.sign({ id: user.id, email: user.email, purpose: "totp_setup" }, JWT_SECRET, { expiresIn: "10m" });
            return res.json({ requiresTotpSetup: true, setupToken });
        }

        pendingTotp.set(email, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
        res.json({ requiresTotp: true, email });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}

async function verifyTotp(req, res) {
    try {
        const { email, token } = req.body;
        const pending = pendingTotp.get(email);
        if (!pending || Date.now() > pending.expiresAt) {
            pendingTotp.delete(email);
            return res.status(401).json({ error: "Session expired" });
        }

        const user = await userRepository.findByEmail(email);
        if (!user?.totp_secret) return res.status(401).json({ error: "TOTP not configured" });

        const isValid = speakeasy.totp.verify({
            secret: user.totp_secret, encoding: "base32",
            token: token.trim().replace(/\s/g, ""), window: 1,
        });
        if (!isValid) return res.status(401).json({ error: "Invalid code" });

        pendingTotp.delete(email);
        await userRepository.setLastLogin(user.id);
        await auditService.recordAudit(user.id, "LOGIN_SUCCESS");

        res.json({ token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}

async function totpSetup(req, res) {
    try {
        const { setupToken } = req.body;
        let decoded;
        try {
            decoded = jwt.verify(setupToken, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Invalid token" });
        }
        if (decoded.purpose !== "totp_setup") return res.status(401).json({ error: "Wrong token type" });

        const user = await userRepository.findById(decoded.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const secret = speakeasy.generateSecret({ name: `Smart Dashboard (${user.email})`, issuer: "Smart Dashboard", length: 20 });
        await userRepository.setTotpSecret(user.id, secret.base32);

        res.json({ secret: secret.base32, qrDataUrl: await QRCode.toDataURL(secret.otpauth_url), otpauthUrl: secret.otpauth_url });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}

async function totpEnable(req, res) {
    try {
        const { setupToken, token } = req.body;
        let decoded;
        try {
            decoded = jwt.verify(setupToken, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Invalid token" });
        }

        const fullUser = await userRepository.findByIdWithSecret(decoded.id);
        if (!fullUser?.totp_secret) return res.status(400).json({ error: "No TOTP secret" });

        const isValid = speakeasy.totp.verify({
            secret: fullUser.totp_secret, encoding: "base32",
            token: token.trim().replace(/\s/g, ""), window: 1,
        });
        if (!isValid) return res.status(401).json({ error: "Wrong code" });

        await userRepository.enableTotp(fullUser.id);
        await auditService.recordAudit(fullUser.id, "TOTP_ENABLED");

        res.json({
            token: generateToken(fullUser),
            user: { id: fullUser.id, name: fullUser.name, email: fullUser.email, role: fullUser.role },
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}

async function me(req, res) {
    res.json({ user: req.user });
}

module.exports = { login, verifyTotp, totpSetup, totpEnable, me };
