const express = require("express");
const router = express.Router();

const {
    getAuthors,
    getAuthorById,
    addAuthor,
    updateAuthor,
    deleteAuthor
} = require("../controllers/authorController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

const canEdit = authorizeRoles(ROLES.ADMIN, ROLES.LIBRARIAN);

router.get("/", authenticateToken, getAuthors);
router.get("/:id", authenticateToken, getAuthorById);
router.post("/", authenticateToken, canEdit, addAuthor);
router.put("/:id", authenticateToken, canEdit, updateAuthor);
router.delete("/:id", authenticateToken, authorizeRoles(ROLES.ADMIN), deleteAuthor);

module.exports = router;
