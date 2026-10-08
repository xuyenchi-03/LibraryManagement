const express = require("express");
const router = express.Router();

const {
    getBooks,
    searchBooks,
    getBookById,
    addBook,
    updateBook,
    deleteBook
} = require("../controllers/bookController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

const canEdit = authorizeRoles(ROLES.ADMIN, ROLES.LIBRARIAN);

router.get("/", authenticateToken, getBooks);
router.get("/search", authenticateToken, searchBooks);
router.get("/:id", authenticateToken, getBookById);
router.post("/", authenticateToken, canEdit, addBook);
router.put("/:id", authenticateToken, canEdit, updateBook);
router.delete("/:id", authenticateToken, authorizeRoles(ROLES.ADMIN), deleteBook);

module.exports = router;
