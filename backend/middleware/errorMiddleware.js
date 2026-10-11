const HttpError = require("../utils/httpError");

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof HttpError) {
        return res.status(err.status).json({ message: err.message });
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Dữ liệu JSON không hợp lệ!" });
    }

    switch (err.code) {
        case "ER_DUP_ENTRY":
            return res.status(409).json({ message: "Dữ liệu bị trùng!" });

        case "ER_NO_REFERENCED_ROW_2":
            return res.status(400).json({
                message: "Dữ liệu tham chiếu không tồn tại!"
            });

        case "ER_ROW_IS_REFERENCED_2":
            return res.status(409).json({
                message: "Dữ liệu đang được sử dụng nên không thể xóa!"
            });

        case "ER_CHECK_CONSTRAINT_VIOLATED":
        case "ER_CONSTRAINT_FAILED":
            return res.status(400).json({
                message: "Dữ liệu vi phạm ràng buộc của hệ thống!"
            });

        default:
            console.error(err);

            return res.status(500).json({ message: "Lỗi Server!" });
    }
}

function notFound(req, res) {
    res.status(404).json({ message: "API không tồn tại!" });
}

module.exports = { errorHandler, notFound };
