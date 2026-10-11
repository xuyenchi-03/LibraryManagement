const jwt = require("jsonwebtoken");

const ROLES = {
    ADMIN: "ADMIN",
    LIBRARIAN: "LIBRARIAN"
};

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Chưa đăng nhập!" });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Token không hợp lệ!" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);

        next();
    } catch (err) {
        const message = err.name === "TokenExpiredError"
            ? "Token đã hết hạn, vui lòng đăng nhập lại!"
            : "Token không hợp lệ!";

        return res.status(401).json({ message });
    }
}

function authorizeRoles(...roles) {
    const allowed = roles.map((role) => String(role).toUpperCase());

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Chưa đăng nhập!" });
        }

        if (!allowed.includes(String(req.user.role).toUpperCase())) {
            return res.status(403).json({
                message: "Bạn không có quyền thực hiện chức năng này!"
            });
        }

        next();
    };
}

module.exports = { ROLES, authenticateToken, authorizeRoles };
