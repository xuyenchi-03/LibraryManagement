const express = require("express");
const router = express.Router();

const {
    getBorrowByMonth,
    getOverdue,
    getSummary
} = require("../controllers/statisticsController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

const canView = authorizeRoles(ROLES.ADMIN, ROLES.LIBRARIAN);

router.get("/borrow-month", authenticateToken, canView, getBorrowByMonth);
router.get("/overdue", authenticateToken, canView, getOverdue);
router.get("/summary", authenticateToken, canView, getSummary);

module.exports = router;
