const db = require("../config/db");
const HttpError = require("../utils/httpError");
const {
    isPositiveInteger,
    requiredText,
    optionalText
} = require("../utils/validators");

function checkId(id) {
    if (!isPositiveInteger(id)) {
        throw new HttpError(400, "Mã tác giả không hợp lệ!");
    }

    return Number(id);
}

function parseBody(body, partial, old) {
    const name = body.name === undefined && partial
        ? old.name
        : requiredText(body.name, 100);

    const description = body.description === undefined && partial
        ? old.description
        : optionalText(body.description, 5000);

    if (!name) {
        throw new HttpError(400, "Tên tác giả không được để trống (tối đa 100 ký tự)!");
    }

    if (description === false) {
        throw new HttpError(400, "Mô tả không hợp lệ!");
    }

    return { name, description };
}

async function getAuthors(req, res) {
    const [authors] = await db.query("SELECT * FROM authors ORDER BY name");

    res.json(authors);
}

async function getAuthorById(req, res) {
    const id = checkId(req.params.id);

    const [authors] = await db.query("SELECT * FROM authors WHERE id = ?", [id]);

    if (authors.length === 0) {
        throw new HttpError(404, "Không tìm thấy tác giả!");
    }

    res.json(authors[0]);
}

async function addAuthor(req, res) {
    const { name, description } = parseBody(req.body, false);

    const [result] = await db.query(
        "INSERT INTO authors (name, description) VALUES (?, ?)",
        [name, description]
    );

    res.status(201).json({
        message: "Thêm tác giả thành công!",
        id: result.insertId
    });
}

async function updateAuthor(req, res) {
    const id = checkId(req.params.id);

    const [authors] = await db.query("SELECT * FROM authors WHERE id = ?", [id]);

    if (authors.length === 0) {
        throw new HttpError(404, "Không tìm thấy tác giả!");
    }

    const { name, description } = parseBody(req.body, true, authors[0]);

    await db.query(
        "UPDATE authors SET name = ?, description = ? WHERE id = ?",
        [name, description, id]
    );

    res.json({ message: "Cập nhật tác giả thành công!" });
}

async function deleteAuthor(req, res) {
    const id = checkId(req.params.id);

    const [authors] = await db.query("SELECT id FROM authors WHERE id = ?", [id]);

    if (authors.length === 0) {
        throw new HttpError(404, "Không tìm thấy tác giả!");
    }

    const [books] = await db.query(
        "SELECT id FROM books WHERE author_id = ? LIMIT 1",
        [id]
    );

    if (books.length > 0) {
        throw new HttpError(409, "Không thể xóa tác giả còn sách trong thư viện!");
    }

    await db.query("DELETE FROM authors WHERE id = ?", [id]);

    res.json({ message: "Xóa tác giả thành công!" });
}

module.exports = {
    getAuthors,
    getAuthorById,
    addAuthor,
    updateAuthor,
    deleteAuthor
};
