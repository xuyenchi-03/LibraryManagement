const express = require("express");
const router = express.Router();

const { register, login, logout } = require("../controllers/authController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.post("/login", login);
router.post("/register", authenticateToken, authorizeRoles(ROLES.ADMIN), register);
router.post("/logout", authenticateToken, logout);

module.exports = router;
