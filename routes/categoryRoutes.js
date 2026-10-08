const express = require("express");
const router = express.Router();

const {
    getCategories,
    getCategoryById,
    addCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");
const {
    ROLES,
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

const canEdit = authorizeRoles(ROLES.ADMIN, ROLES.LIBRARIAN);

router.get("/", authenticateToken, getCategories);
router.get("/:id", authenticateToken, getCategoryById);
router.post("/", authenticateToken, canEdit, addCategory);
router.put("/:id", authenticateToken, canEdit, updateCategory);
router.delete("/:id", authenticateToken, authorizeRoles(ROLES.ADMIN), deleteCategory);

module.exports = router;
