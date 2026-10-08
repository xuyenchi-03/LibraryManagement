const express = require("express");
const router = express.Router();

const {
    getReaders,
    getReaderById,
    addReader,
    updateReader,
    deleteReader,
    getReaderBorrowHistory
} = require("../controllers/readerController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

const canEdit = authorizeRoles(ROLES.ADMIN, ROLES.LIBRARIAN);

router.get("/", authenticateToken, getReaders);
router.get("/:id", authenticateToken, getReaderById);
router.get("/:id/borrow-history", authenticateToken, getReaderBorrowHistory);
router.post("/", authenticateToken, canEdit, addReader);
router.put("/:id", authenticateToken, canEdit, updateReader);
router.delete("/:id", authenticateToken, authorizeRoles(ROLES.ADMIN), deleteReader);

module.exports = router;
