const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, requireRole("it_admin"), usersController.listUsers);
router.get("/:id", requireAuth, requireRole("it_admin"), usersController.getUser);
router.post("/", requireAuth, requireRole("it_admin"), usersController.createUser);
router.put("/:id", requireAuth, requireRole("it_admin"), usersController.updateUser);
router.patch("/:id/toggle-active", requireAuth, requireRole("it_admin"), usersController.toggleActive);
router.delete("/:id", requireAuth, requireRole("it_admin"), usersController.deleteUser);
router.post("/:id/reset-totp", requireAuth, requireRole("it_admin"), usersController.resetTotp);

module.exports = router;
