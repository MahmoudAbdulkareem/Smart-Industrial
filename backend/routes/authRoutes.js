const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.post("/login", authController.login);
router.post("/verify-totp", authController.verifyTotp);
router.post("/totp-setup", authController.totpSetup);
router.post("/totp-enable", authController.totpEnable);
router.get("/me", requireAuth, authController.me);

module.exports = router;
