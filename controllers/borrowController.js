const crypto = require("crypto");

const db = require("../config/db");
const HttpError = require("../utils/httpError");
const withTransaction = require("../utils/transaction");
const {
    isPositiveInteger,
    isValidDateString
} = require("../utils/validators");

const MAX_ITEMS = 20;
const MAX_QUANTITY_PER_ITEM = 100;

const SLIP_STATUS_SQL = `
    CASE
        WHEN bs.status = 'RETURNED' THEN 'RETURNED'
        WHEN bs.due_date < CURDATE() THEN 'OVERDUE'
        ELSE 'BORROWING'
    END
`;

function checkId(id, label) {
    if (!isPositiveInteger(id)) {
        throw new HttpError(400, `${label} không hợp lệ!`);
    }

    return Number(id);
}

function parseItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new HttpError(400, "Vui lòng chọn ít nhất một cuốn sách!");
    }

    if (items.length > MAX_ITEMS) {
        throw new HttpError(400, `Mỗi phiếu tối đa ${MAX_ITEMS} dòng sách!`);
    }

    const wanted = new Map();

    for (const item of items) {
        if (!item || !isPositiveInteger(item.book_id)) {
            throw new HttpError(400, "Mã sách không hợp lệ!");
        }

        const quantity = item.quantity === undefined ? 1 : item.quantity;

        if (!isPositiveInteger(quantity) || Number(quantity) > MAX_QUANTITY_PER_ITEM) {
            throw new HttpError(400, "Số lượng mượn phải là số nguyên dương!");
        }

        const bookId = Number(item.book_id);

        wanted.set(bookId, (wanted.get(bookId) || 0) + Number(quantity));
    }

    return wanted;
}

async function borrowBook(req, res) {
    const { reader_id, due_date, items } = req.body;

    const readerId = checkId(reader_id, "Mã người đọc");

    if (!isValidDateString(due_date)) {
        throw new HttpError(400, "Hạn trả phải có dạng YYYY-MM-DD và là ngày hợp lệ!");
    }

    const wanted = parseItems(items);

    const result = await withTransaction(async (connection) => {
        const [todayRows] = await connection.query("SELECT CURDATE() AS today");

        if (due_date < todayRows[0].today) {
            throw new HttpError(400, "Hạn trả không được ở trong quá khứ!");
        }

        const [readers] = await connection.query(
            "SELECT id FROM readers WHERE id = ?",
            [readerId]
        );

        if (readers.length === 0) {
            throw new HttpError(404, "Không tìm thấy người đọc!");
        }

        const bookIds = [...wanted.keys()].sort((a, b) => a - b);

        const [books] = await connection.query(
            `SELECT id, title, available_quantity
             FROM books
             WHERE id IN (?)
             ORDER BY id
             FOR UPDATE`,
            [bookIds]
        );

        if (books.length !== bookIds.length) {
            throw new HttpError(404, "Có sách không tồn tại trong thư viện!");
        }

        for (const book of books) {
            if (book.available_quantity < wanted.get(book.id)) {
                throw new HttpError(
                    409,
                    `Sách "${book.title}" chỉ còn ${book.available_quantity} bản!`
                );
            }
        }

        const [active] = await connection.query(
            `SELECT DISTINCT b.title
             FROM borrow_slips bs
             JOIN borrow_details bd ON bs.id = bd.borrow_slip_id
             JOIN books b ON bd.book_id = b.id
             WHERE bs.reader_id = ?
               AND bd.status = 'BORROWING'
               AND bd.book_id IN (?)`,
            [readerId, bookIds]
        );

        if (active.length > 0) {
            throw new HttpError(
                409,
                `Người đọc đang mượn chưa trả: ${active.map((row) => row.title).join(", ")}!`
            );
        }

        const tempCode = "TMP" + crypto.randomBytes(6).toString("hex");

        const [slip] = await connection.query(
            `INSERT INTO borrow_slips
                (slip_code, reader_id, librarian_id, borrow_date, due_date, status)
             VALUES (?, ?, ?, CURDATE(), ?, 'BORROWING')`,
            [tempCode, readerId, req.user.id, due_date]
        );

        await connection.query(
            "UPDATE borrow_slips SET slip_code = CONCAT('PM', LPAD(id, 5, '0')) WHERE id = ?",
            [slip.insertId]
        );

        const detailRows = bookIds.map((bookId) => [
            slip.insertId,
            bookId,
            wanted.get(bookId),
            "BORROWING"
        ]);

        await connection.query(
            `INSERT INTO borrow_details (borrow_slip_id, book_id, quantity, status)
             VALUES ?`,
            [detailRows]
        );

        for (const bookId of bookIds) {
            await connection.query(
                `UPDATE books
                 SET available_quantity = available_quantity - ?
                 WHERE id = ?`,
                [wanted.get(bookId), bookId]
            );
        }

        const [codeRows] = await connection.query(
            "SELECT slip_code FROM borrow_slips WHERE id = ?",
            [slip.insertId]
        );

        return { id: slip.insertId, slip_code: codeRows[0].slip_code };
    });

    res.status(201).json({
        message: "Lập phiếu mượn thành công!",
        id: result.id,
        slip_code: result.slip_code
    });
}

async function returnBook(req, res) {
    const slipId = checkId(req.params.id, "Mã phiếu mượn");
    const body = req.body || {};

    let detailIds = null;

    if (body.detail_ids !== undefined) {
        if (!Array.isArray(body.detail_ids) ||
            body.detail_ids.length === 0 ||
            !body.detail_ids.every(isPositiveInteger)) {
            throw new HttpError(400, "detail_ids phải là mảng mã chi tiết hợp lệ!");
        }

        detailIds = [...new Set(body.detail_ids.map(Number))];
    }

    const result = await withTransaction(async (connection) => {
        const [slips] = await connection.query(
            "SELECT id, status FROM borrow_slips WHERE id = ? FOR UPDATE",
            [slipId]
        );

        if (slips.length === 0) {
            throw new HttpError(404, "Không tìm thấy phiếu mượn!");
        }

        if (slips[0].status === "RETURNED") {
            throw new HttpError(409, "Phiếu mượn này đã được trả hết!");
        }

        let sql = `SELECT id, book_id, quantity
                   FROM borrow_details
                   WHERE borrow_slip_id = ? AND status = 'BORROWING'`;
        const params = [slipId];

        if (detailIds) {
            sql += " AND id IN (?)";
            params.push(detailIds);
        }

        sql += " ORDER BY book_id FOR UPDATE";

        const [details] = await connection.query(sql, params);

        if (details.length === 0 || (detailIds && details.length !== detailIds.length)) {
            throw new HttpError(
                409,
                "Sách không thuộc phiếu này hoặc đã được trả rồi!"
            );
        }

        const ids = details.map((detail) => detail.id);

        await connection.query(
            `UPDATE borrow_details
             SET return_date = CURDATE(), status = 'RETURNED'
             WHERE id IN (?)`,
            [ids]
        );

        for (const detail of details) {
            await connection.query(
                `UPDATE books
                 SET available_quantity = available_quantity + ?
                 WHERE id = ?`,
                [detail.quantity, detail.book_id]
            );
        }

        const [remaining] = await connection.query(
            `SELECT COUNT(*) AS total
             FROM borrow_details
             WHERE borrow_slip_id = ? AND status = 'BORROWING'`,
            [slipId]
        );

        const allReturned = Number(remaining[0].total) === 0;

        if (allReturned) {
            await connection.query(
                "UPDATE borrow_slips SET status = 'RETURNED' WHERE id = ?",
                [slipId]
            );
        }

        const [info] = await connection.query(
            `SELECT (CURDATE() > due_date) AS is_late
             FROM borrow_slips
             WHERE id = ?`,
            [slipId]
        );

        return {
            returned_items: details.length,
            slip_status: allReturned ? "RETURNED" : "BORROWING",
            is_late: Boolean(info[0].is_late)
        };
    });

    res.json({ message: "Trả sách thành công!", ...result });
}

async function getBorrowSlips(req, res) {
    let sql = `
        SELECT
            bs.id,
            bs.slip_code,
            bs.reader_id,
            r.reader_code,
            r.full_name AS reader,
            u.full_name AS librarian,
            bs.borrow_date,
            bs.due_date,
            ${SLIP_STATUS_SQL} AS status,
            (SELECT COUNT(*) FROM borrow_details d WHERE d.borrow_slip_id = bs.id) AS item_count
        FROM borrow_slips bs
        JOIN readers r ON bs.reader_id = r.id
        JOIN users u ON bs.librarian_id = u.id
        WHERE 1=1
    `;
    const params = [];

    const { status, reader_id } = req.query;

    if (status !== undefined) {
        if (status === "RETURNED") {
            sql += " AND bs.status = 'RETURNED'";
        } else if (status === "OVERDUE") {
            sql += " AND bs.status <> 'RETURNED' AND bs.due_date < CURDATE()";
        } else if (status === "BORROWING") {
            sql += " AND bs.status <> 'RETURNED' AND bs.due_date >= CURDATE()";
        } else {
            throw new HttpError(400, "status phải là BORROWING, OVERDUE hoặc RETURNED!");
        }
    }

    if (reader_id !== undefined) {
        sql += " AND bs.reader_id = ?";
        params.push(checkId(reader_id, "Mã người đọc"));
    }

    sql += " ORDER BY bs.id DESC";

    const [slips] = await db.query(sql, params);

    res.json(slips);
}

async function getBorrowSlipById(req, res) {
    const slipId = checkId(req.params.id, "Mã phiếu mượn");

    const [slips] = await db.query(
        `SELECT
            bs.id,
            bs.slip_code,
            bs.reader_id,
            r.reader_code,
            r.full_name AS reader,
            u.full_name AS librarian,
            bs.borrow_date,
            bs.due_date,
            ${SLIP_STATUS_SQL} AS status
         FROM borrow_slips bs
         JOIN readers r ON bs.reader_id = r.id
         JOIN users u ON bs.librarian_id = u.id
         WHERE bs.id = ?`,
        [slipId]
    );

    if (slips.length === 0) {
        throw new HttpError(404, "Không tìm thấy phiếu mượn!");
    }

    const [items] = await db.query(
        `SELECT
            bd.id AS detail_id,
            bd.book_id,
            b.title,
            bd.quantity,
            bd.return_date,
            bd.status,
            (bd.status = 'BORROWING' AND bs.due_date < CURDATE()) AS is_overdue,
            (bd.return_date IS NOT NULL AND bd.return_date > bs.due_date) AS is_late
         FROM borrow_details bd
         JOIN borrow_slips bs ON bd.borrow_slip_id = bs.id
         JOIN books b ON bd.book_id = b.id
         WHERE bd.borrow_slip_id = ?
         ORDER BY bd.id`,
        [slipId]
    );

    res.json({
        ...slips[0],
        items: items.map((item) => ({
            ...item,
            is_overdue: Boolean(item.is_overdue),
            is_late: Boolean(item.is_late)
        }))
    });
}

module.exports = {
    borrowBook,
    returnBook,
    getBorrowSlips,
    getBorrowSlipById
};
