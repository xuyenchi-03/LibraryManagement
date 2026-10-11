const db = require("../config/db");
const HttpError = require("../utils/httpError");

async function getBorrowByMonth(req, res) {
    let sql = `
        SELECT
            YEAR(borrow_date) AS year,
            MONTH(borrow_date) AS month,
            COUNT(*) AS total_borrow
        FROM borrow_slips
    `;
    const params = [];

    if (req.query.year !== undefined) {
        if (typeof req.query.year !== "string" || !/^\d{4}$/.test(req.query.year)) {
            throw new HttpError(400, "year phải gồm 4 chữ số!");
        }

        sql += " WHERE borrow_date >= ? AND borrow_date <= ?";
        params.push(`${req.query.year}-01-01`, `${req.query.year}-12-31`);
    }

    sql += `
        GROUP BY YEAR(borrow_date), MONTH(borrow_date)
        ORDER BY year DESC, month DESC
    `;

    const [rows] = await db.query(sql, params);

    res.json(rows);
}

async function getOverdue(req, res) {
    const [rows] = await db.query(`
        SELECT
            bs.id AS slip_id,
            bs.slip_code,
            bd.id AS detail_id,
            r.id AS reader_id,
            r.reader_code,
            r.full_name AS reader,
            r.phone,
            b.id AS book_id,
            b.title,
            bd.quantity,
            bs.borrow_date,
            bs.due_date,
            DATEDIFF(CURDATE(), bs.due_date) AS overdue_days
        FROM borrow_slips bs
        JOIN readers r ON bs.reader_id = r.id
        JOIN borrow_details bd ON bs.id = bd.borrow_slip_id
        JOIN books b ON bd.book_id = b.id
        WHERE bs.due_date < CURDATE()
          AND bd.status = 'BORROWING'
        ORDER BY bs.due_date ASC, bs.id ASC
    `);

    res.json(rows);
}

async function getSummary(req, res) {
    const [[books]] = await db.query(`
        SELECT
            COUNT(*) AS total_books,
            COALESCE(SUM(quantity), 0) AS total_quantity,
            COALESCE(SUM(available_quantity), 0) AS available_books
        FROM books
    `);

    const [[readers]] = await db.query("SELECT COUNT(*) AS total_readers FROM readers");

    const [[slips]] = await db.query(`
        SELECT
            COUNT(*) AS borrowing_slips,
            COALESCE(SUM(due_date < CURDATE()), 0) AS overdue_slips
        FROM borrow_slips
        WHERE status <> 'RETURNED'
    `);

    res.json({
        total_books: Number(books.total_books),
        total_quantity: Number(books.total_quantity),
        available_books: Number(books.available_books),
        total_readers: Number(readers.total_readers),
        borrowing_slips: Number(slips.borrowing_slips),
        overdue_slips: Number(slips.overdue_slips)
    });
}

module.exports = { getBorrowByMonth, getOverdue, getSummary };
