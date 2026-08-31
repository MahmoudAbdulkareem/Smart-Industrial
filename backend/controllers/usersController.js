const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const auditService = require("../services/auditService");

const VALID_ROLES = ["maintenance_engineer", "energy_manager", "it_admin"];

async function listUsers(req, res) {
    try {
        res.json(await userRepository.listAll());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getUser(req, res) {
    try {
        const user = await userRepository.findById(parseInt(req.params.id));
        if (!user) return res.status(404).json({ error: "Not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function createUser(req, res) {
    try {
        const { name, email, role, password, phone_number: phoneNumber } = req.body;
        if (!name || !email || !role || !password) return res.status(400).json({ error: "name, email, role, password required" });
        if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
        if (await userRepository.emailInUse(email)) return res.status(409).json({ error: "Email in use" });

        const passwordHash = bcrypt.hashSync(password, 10);
        const created = await userRepository.createUser({ name, email, passwordHash, role, phoneNumber });
        await auditService.recordAudit(req.user.id, "USER_CREATED", { email, role });
        res.status(201).json(created);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateUser(req, res) {
    try {
        const id = parseInt(req.params.id);
        const { name, email, role, password, phone_number: phoneNumber } = req.body;
        if (await userRepository.emailInUse(email, id)) return res.status(409).json({ error: "Email in use" });

        const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
        const updated = await userRepository.updateUser(id, { name, email, role, passwordHash, phoneNumber });
        await auditService.recordAudit(req.user.id, "USER_UPDATED", { target: id });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function toggleActive(req, res) {
    try {
        const id = parseInt(req.params.id);
        if (req.user.id === id) return res.status(400).json({ error: "Cannot change own status" });

        const target = await userRepository.findById(id);
        if (!target) return res.status(404).json({ error: "Not found" });
        if (target.role === "it_admin") return res.status(400).json({ error: "Cannot deactivate IT Admin" });

        const newState = !target.is_active;
        await userRepository.toggleActive(id, newState);
        await auditService.recordAudit(req.user.id, newState ? "USER_REACTIVATED" : "USER_DEACTIVATED", { target: id });
        res.json({ id, is_active: newState });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteUser(req, res) {
    try {
        const id = parseInt(req.params.id);
        if (req.user.id === id) return res.status(400).json({ error: "Cannot delete own account" });

        const target = await userRepository.findById(id);
        if (!target) return res.status(404).json({ error: "Not found" });
        if (target.role === "it_admin") return res.status(400).json({ error: "Cannot delete IT Admin" });

        await userRepository.deleteUser(id);
        await auditService.recordAudit(req.user.id, "USER_DELETED", { email: target.email });
        res.json({ message: "Deleted", id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function resetTotp(req, res) {
    try {
        const id = parseInt(req.params.id);
        await userRepository.resetTotp(id);
        await auditService.recordAudit(req.user.id, "TOTP_RESET", { target: id });
        res.json({ message: "TOTP reset" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { listUsers, getUser, createUser, updateUser, toggleActive, deleteUser, resetTotp };
