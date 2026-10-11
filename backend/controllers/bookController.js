const db = require("../config/db");
const HttpError = require("../utils/httpError");
const withTransaction = require("../utils/transaction");
const {
    isPositiveInteger,
    isNonNegativeInteger,
    requiredText,
    optionalText,
    queryText,
    escapeLike
} = require("../utils/validators");

const BOOK_SELECT = `
    SELECT
        b.id,
        b.title,
        b.author_id,
        a.name AS author,
        b.category_id,
        c.name AS category,
        b.publisher,
        b.publish_year,
        b.quantity,
        b.available_quantity,
        IF(b.available_quantity > 0, 'available', 'unavailable') AS status
    FROM books b
    JOIN authors a ON b.author_id = a.id
    JOIN categories c ON b.category_id = c.id
`;

function checkId(id) {
    if (!isPositiveInteger(id)) {
        throw new HttpError(400, "Mã sách không hợp lệ!");
    }

    return Number(id);
}

function checkYear(value) {
    if (value === undefined || value === null || value === "") return null;

    const maxYear = new Date().getFullYear() + 1;

    if (!/^\d{4}$/.test(String(value)) ||
        Number(value) < 1000 ||
        Number(value) > maxYear) {
        throw new HttpError(400, `Năm xuất bản phải từ 1000 đến ${maxYear}!`);
    }

    return Number(value);
}

async function ensureAuthorAndCategory(connection, authorId, categoryId) {
    const [authors] = await connection.query(
        "SELECT id FROM authors WHERE id = ?",
        [authorId]
    );

    if (authors.length === 0) {
        throw new HttpError(400, "Tác giả không tồn tại!");
    }

    const [categories] = await connection.query(
        "SELECT id FROM categories WHERE id = ?",
        [categoryId]
    );

    if (categories.length === 0) {
        throw new HttpError(400, "Thể loại không tồn tại!");
    }
}

async function getBooks(req, res) {
    let sql = BOOK_SELECT + " WHERE 1=1";
    const params = [];

    const search = queryText(req.query.search);
    const author = queryText(req.query.author);
    const category = queryText(req.query.category);

    if (search) {
        sql += " AND b.title LIKE ?";
        params.push(`%${escapeLike(search)}%`);
    }

    if (author) {
        sql += " AND a.name LIKE ?";
        params.push(`%${escapeLike(author)}%`);
    }

    if (category) {
        sql += " AND c.name LIKE ?";
        params.push(`%${escapeLike(category)}%`);
    }

    if (req.query.author_id !== undefined) {
        if (!isPositiveInteger(req.query.author_id)) {
            throw new HttpError(400, "author_id không hợp lệ!");
        }

        sql += " AND b.author_id = ?";
        params.push(Number(req.query.author_id));
    }

    if (req.query.category_id !== undefined) {
        if (!isPositiveInteger(req.query.category_id)) {
            throw new HttpError(400, "category_id không hợp lệ!");
        }

        sql += " AND b.category_id = ?";
        params.push(Number(req.query.category_id));
    }

    if (req.query.available === "true") {
        sql += " AND b.available_quantity > 0";
    } else if (req.query.available === "false") {
        sql += " AND b.available_quantity = 0";
    }

    sql += " ORDER BY b.id DESC";

    const [books] = await db.query(sql, params);

    res.json(books);
}

async function searchBooks(req, res) {
    const keyword = queryText(req.query.keyword);

    let sql = BOOK_SELECT;
    const params = [];

    if (keyword) {
        const like = `%${escapeLike(keyword)}%`;

        sql += " WHERE b.title LIKE ? OR a.name LIKE ? OR c.name LIKE ?";
        params.push(like, like, like);
    }

    sql += " ORDER BY b.id DESC";

    const [books] = await db.query(sql, params);

    res.json(books);
}

async function getBookById(req, res) {
    const id = checkId(req.params.id);

    const [books] = await db.query(BOOK_SELECT + " WHERE b.id = ?", [id]);

    if (books.length === 0) {
        throw new HttpError(404, "Không tìm thấy sách!");
    }

    res.json(books[0]);
}

async function addBook(req, res) {
    const { title, author_id, category_id, publisher, publish_year, quantity } = req.body;

    const cleanTitle = requiredText(title, 255);
    const cleanPublisher = optionalText(publisher, 150);

    if (!cleanTitle) {
        throw new HttpError(400, "Tên sách không được để trống (tối đa 255 ký tự)!");
    }

    if (!isPositiveInteger(author_id) || !isPositiveInteger(category_id)) {
        throw new HttpError(400, "Vui lòng chọn tác giả và thể loại hợp lệ!");
    }

    if (cleanPublisher === false) {
        throw new HttpError(400, "Nhà xuất bản không hợp lệ (tối đa 150 ký tự)!");
    }

    if (!isNonNegativeInteger(quantity)) {
        throw new HttpError(400, "Số lượng phải là số nguyên không âm!");
    }

    const year = checkYear(publish_year);
    const total = Number(quantity);

    await ensureAuthorAndCategory(db, Number(author_id), Number(category_id));

    const [result] = await db.query(
        `INSERT INTO books
            (title, author_id, category_id, publisher, publish_year, quantity, available_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cleanTitle, Number(author_id), Number(category_id), cleanPublisher, year, total, total]
    );

    res.status(201).json({
        message: "Thêm sách thành công!",
        id: result.insertId
    });
}

async function updateBook(req, res) {
    const id = checkId(req.params.id);
    const body = req.body;

    await withTransaction(async (connection) => {
        const [books] = await connection.query(
            "SELECT * FROM books WHERE id = ? FOR UPDATE",
            [id]
        );

        if (books.length === 0) {
            throw new HttpError(404, "Không tìm thấy sách!");
        }

        const old = books[0];

        const title = body.title === undefined ? old.title : requiredText(body.title, 255);
        const publisher = body.publisher === undefined
            ? old.publisher
            : optionalText(body.publisher, 150);

        if (!title) {
            throw new HttpError(400, "Tên sách không được để trống (tối đa 255 ký tự)!");
        }

        if (publisher === false) {
            throw new HttpError(400, "Nhà xuất bản không hợp lệ (tối đa 150 ký tự)!");
        }

        let authorId = old.author_id;
        let categoryId = old.category_id;

        if (body.author_id !== undefined) {
            if (!isPositiveInteger(body.author_id)) {
                throw new HttpError(400, "Tác giả không hợp lệ!");
            }

            authorId = Number(body.author_id);
        }

        if (body.category_id !== undefined) {
            if (!isPositiveInteger(body.category_id)) {
                throw new HttpError(400, "Thể loại không hợp lệ!");
            }

            categoryId = Number(body.category_id);
        }

        const year = body.publish_year === undefined
            ? old.publish_year
            : checkYear(body.publish_year);

        const borrowed = old.quantity - old.available_quantity;
        let quantity = old.quantity;

        if (body.quantity !== undefined) {
            if (!isNonNegativeInteger(body.quantity)) {
                throw new HttpError(400, "Số lượng phải là số nguyên không âm!");
            }

            quantity = Number(body.quantity);

            if (quantity < borrowed) {
                throw new HttpError(
                    409,
                    `Tổng số lượng không thể nhỏ hơn số sách đang được mượn (${borrowed})!`
                );
            }
        }

        const available = quantity - borrowed;

        await ensureAuthorAndCategory(connection, authorId, categoryId);

        await connection.query(
            `UPDATE books
             SET title = ?, author_id = ?, category_id = ?, publisher = ?,
                 publish_year = ?, quantity = ?, available_quantity = ?
             WHERE id = ?`,
            [title, authorId, categoryId, publisher, year, quantity, available, id]
        );
    });

    res.json({ message: "Cập nhật sách thành công!" });
}

async function deleteBook(req, res) {
    const id = checkId(req.params.id);

    const [books] = await db.query("SELECT id FROM books WHERE id = ?", [id]);

    if (books.length === 0) {
        throw new HttpError(404, "Không tìm thấy sách!");
    }

    const [details] = await db.query(
        "SELECT id FROM borrow_details WHERE book_id = ? LIMIT 1",
        [id]
    );

    if (details.length > 0) {
        throw new HttpError(409, "Không thể xóa sách đã có lịch sử mượn!");
    }

    await db.query("DELETE FROM books WHERE id = ?", [id]);

    res.json({ message: "Xóa sách thành công!" });
}

module.exports = {
    getBooks,
    searchBooks,
    getBookById,
    addBook,
    updateBook,
    deleteBook
};
