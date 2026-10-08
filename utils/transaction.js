const db = require("../config/db");

async function withTransaction(work) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const result = await work(connection);

        await connection.commit();

        return result;
    } catch (err) {
        try {
            await connection.rollback();
        } catch (rollbackErr) {
            console.error("Rollback lỗi:", rollbackErr);
        }

        throw err;
    } finally {
        connection.release();
    }
}

module.exports = withTransaction;
