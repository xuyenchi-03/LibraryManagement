const crypto = require("crypto");

const db = require("../config/db");
const HttpError = require("../utils/httpError");
const withTransaction = require("../utils/transaction");
const {
    isPositiveInteger,
    isValidEmail,
    isValidPhone,
    requiredText,
    optionalText,
    queryText,
    escapeLike
} = require("../utils/validators");

function checkId(id) {
    if (!isPositiveInteger(id)) {
        throw new HttpError(400, "Mã người đọc không hợp lệ!");
    }

    return Number(id);
}

function parseBody(body, old) {
    const partial = Boolean(old);

    const fullName = body.full_name === undefined && partial
        ? old.full_name
        : requiredText(body.full_name, 100);

    const email = body.email === undefined && partial
        ? old.email
        : optionalText(body.email, 100);

    const phone = body.phone === undefined && partial
        ? old.phone
        : optionalText(body.phone, 20);

    const address = body.address === undefined && partial
        ? old.address
        : optionalText(body.address, 255);

    if (!fullName) {
        throw new HttpError(400, "Họ tên không được để trống (tối đa 100 ký tự)!");
    }

    if (email === false || (email && !isValidEmail(email))) {
        throw new HttpError(400, "Email không hợp lệ!");
    }

    if (phone === false || (phone && !isValidPhone(phone))) {
        throw new HttpError(400, "Số điện thoại không hợp lệ!");
    }

    if (address === false) {
        throw new HttpError(400, "Địa chỉ không hợp lệ (tối đa 255 ký tự)!");
    }

    return { full_name: fullName, email, phone, address };
}

async function getReaders(req, res) {
    let sql = "SELECT * FROM readers WHERE 1=1";
    const params = [];

    const search = queryText(req.query.search);

    if (search) {
        const like = `%${escapeLike(search)}%`;

        sql += " AND (full_name LIKE ? OR reader_code LIKE ? OR email LIKE ? OR phone LIKE ?)";
        params.push(like, like, like, like);
    }

    sql += " ORDER BY id DESC";

    const [readers] = await db.query(sql, params);

    res.json(readers);
}

async function getReaderById(req, res) {
    const id = checkId(req.params.id);

    const [readers] = await db.query("SELECT * FROM readers WHERE id = ?", [id]);

    if (readers.length === 0) {
        throw new HttpError(404, "Không tìm thấy người đọc!");
    }

    res.json(readers[0]);
}

async function addReader(req, res) {
    const data = parseBody(req.body);

    const tempCode = "TMP" + crypto.randomBytes(6).toString("hex");

    const result = await withTransaction(async (connection) => {
        const [inserted] = await connection.query(
            `INSERT INTO readers (reader_code, full_name, email, phone, address)
             VALUES (?, ?, ?, ?, ?)`,
            [tempCode, data.full_name, data.email, data.phone, data.address]
        );

        await connection.query(
            "UPDATE readers SET reader_code = CONCAT('DG', LPAD(id, 5, '0')) WHERE id = ?",
            [inserted.insertId]
        );

        const [rows] = await connection.query(
            "SELECT reader_code FROM readers WHERE id = ?",
            [inserted.insertId]
        );

        return { id: inserted.insertId, reader_code: rows[0].reader_code };
    });

    res.status(201).json({
        message: "Thêm người đọc thành công!",
        id: result.id,
        reader_code: result.reader_code
    });
}

async function updateReader(req, res) {
    const id = checkId(req.params.id);

    const [readers] = await db.query("SELECT * FROM readers WHERE id = ?", [id]);

    if (readers.length === 0) {
        throw new HttpError(404, "Không tìm thấy người đọc!");
    }

    const data = parseBody(req.body, readers[0]);

    await db.query(
        `UPDATE readers
         SET full_name = ?, email = ?, phone = ?, address = ?
         WHERE id = ?`,
        [data.full_name, data.email, data.phone, data.address, id]
    );

    res.json({ message: "Cập nhật người đọc thành công!" });
}

async function deleteReader(req, res) {
    const id = checkId(req.params.id);

    const [readers] = await db.query("SELECT id FROM readers WHERE id = ?", [id]);

    if (readers.length === 0) {
        throw new HttpError(404, "Không tìm thấy người đọc!");
    }

    const [slips] = await db.query(
        "SELECT id FROM borrow_slips WHERE reader_id = ? LIMIT 1",
        [id]
    );

    if (slips.length > 0) {
        throw new HttpError(409, "Không thể xóa người đọc đã có lịch sử mượn!");
    }

    await db.query("DELETE FROM readers WHERE id = ?", [id]);

    res.json({ message: "Xóa người đọc thành công!" });
}

async function getReaderBorrowHistory(req, res) {
    const id = checkId(req.params.id);

    const [readers] = await db.query("SELECT id FROM readers WHERE id = ?", [id]);

    if (readers.length === 0) {
        throw new HttpError(404, "Không tìm thấy người đọc!");
    }

    const [history] = await db.query(
        `SELECT
            bs.id,
            bs.slip_code,
            bs.borrow_date,
            bs.due_date,
            CASE
                WHEN bs.status = 'RETURNED' THEN 'RETURNED'
                WHEN bs.due_date < CURDATE() THEN 'OVERDUE'
                ELSE 'BORROWING'
            END AS slip_status,
            b.id AS book_id,
            b.title,
            bd.id AS detail_id,
            bd.quantity,
            bd.return_date,
            bd.status AS detail_status,
            (bd.status = 'BORROWING' AND bs.due_date < CURDATE()) AS is_overdue,
            (bd.return_date IS NOT NULL AND bd.return_date > bs.due_date) AS is_late
         FROM borrow_slips bs
         JOIN borrow_details bd ON bs.id = bd.borrow_slip_id
         JOIN books b ON bd.book_id = b.id
         WHERE bs.reader_id = ?
         ORDER BY bs.borrow_date DESC, bs.id DESC`,
        [id]
    );

    res.json(history.map((row) => ({
        ...row,
        is_overdue: Boolean(row.is_overdue),
        is_late: Boolean(row.is_late)
    })));
}

module.exports = {
    getReaders,
    getReaderById,
    addReader,
    updateReader,
    deleteReader,
    getReaderBorrowHistory
};
