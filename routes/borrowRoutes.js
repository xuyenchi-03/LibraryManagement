const express = require("express");
const router = express.Router();

const {
    borrowBook,
    returnBook,
    getBorrowSlips,
    getBorrowSlipById
} = require("../controllers/borrowController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

const canEdit = authorizeRoles(ROLES.ADMIN, ROLES.LIBRARIAN);

router.get("/", authenticateToken, getBorrowSlips);
router.get("/:id", authenticateToken, getBorrowSlipById);
router.post("/", authenticateToken, canEdit, borrowBook);
router.put("/:id/return", authenticateToken, canEdit, returnBook);

module.exports = router;
