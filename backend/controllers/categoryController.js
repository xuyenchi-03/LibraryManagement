const db = require("../config/db");
const HttpError = require("../utils/httpError");
const {
    isPositiveInteger,
    requiredText,
    optionalText
} = require("../utils/validators");

function checkId(id) {
    if (!isPositiveInteger(id)) {
        throw new HttpError(400, "Mã thể loại không hợp lệ!");
    }

    return Number(id);
}


async function runWriting(query, params) {
    try {
        return await db.query(query, params);
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            throw new HttpError(409, "Tên thể loại đã tồn tại!");
        }

        throw err;
    }
}

function parseBody(body, partial, old) {
    const name = body.name === undefined && partial
        ? old.name
        : requiredText(body.name, 100);

    const description = body.description === undefined && partial
        ? old.description
        : optionalText(body.description, 5000);

    if (!name) {
        throw new HttpError(400, "Tên thể loại không được để trống (tối đa 100 ký tự)!");
    }

    if (description === false) {
        throw new HttpError(400, "Mô tả không hợp lệ!");
    }

    return { name, description };
}

async function getCategories(req, res) {
    const [categories] = await db.query("SELECT * FROM categories ORDER BY name");

    res.json(categories);
}

async function getCategoryById(req, res) {
    const id = checkId(req.params.id);

    const [categories] = await db.query("SELECT * FROM categories WHERE id = ?", [id]);

    if (categories.length === 0) {
        throw new HttpError(404, "Không tìm thấy thể loại!");
    }

    res.json(categories[0]);
}

async function addCategory(req, res) {
    const { name, description } = parseBody(req.body, false);

    const [result] = await runWriting(
        "INSERT INTO categories (name, description) VALUES (?, ?)",
        [name, description]
    );

    res.status(201).json({
        message: "Thêm thể loại thành công!",
        id: result.insertId
    });
}

async function updateCategory(req, res) {
    const id = checkId(req.params.id);

    const [categories] = await db.query("SELECT * FROM categories WHERE id = ?", [id]);

    if (categories.length === 0) {
        throw new HttpError(404, "Không tìm thấy thể loại!");
    }

    const { name, description } = parseBody(req.body, true, categories[0]);

    await runWriting(
        "UPDATE categories SET name = ?, description = ? WHERE id = ?",
        [name, description, id]
    );

    res.json({ message: "Cập nhật thể loại thành công!" });
}

async function deleteCategory(req, res) {
    const id = checkId(req.params.id);

    const [categories] = await db.query("SELECT id FROM categories WHERE id = ?", [id]);

    if (categories.length === 0) {
        throw new HttpError(404, "Không tìm thấy thể loại!");
    }

    const [books] = await db.query(
        "SELECT id FROM books WHERE category_id = ? LIMIT 1",
        [id]
    );

    if (books.length > 0) {
        throw new HttpError(409, "Không thể xóa thể loại còn sách trong thư viện!");
    }

    await db.query("DELETE FROM categories WHERE id = ?", [id]);

    res.json({ message: "Xóa thể loại thành công!" });
}

module.exports = {
    getCategories,
    getCategoryById,
    addCategory,
    updateCategory,
    deleteCategory
};
