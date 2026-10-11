const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/db");
const HttpError = require("../utils/httpError");
const { requiredText } = require("../utils/validators");

async function register(req, res) {
    const { username, password, full_name } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
        throw new HttpError(400, "Username và password phải là chuỗi!");
    }

    const cleanUsername = requiredText(username, 50);
    const cleanFullName = requiredText(full_name, 100);

    if (!cleanUsername || cleanUsername.length < 3) {
        throw new HttpError(400, "Username phải có từ 3 đến 50 ký tự!");
    }

    if (!cleanFullName) {
        throw new HttpError(400, "Vui lòng nhập họ tên (tối đa 100 ký tự)!");
    }

    if (password.length < 6 || Buffer.byteLength(password) > 72) {
        throw new HttpError(400, "Mật khẩu phải từ 6 đến 72 ký tự!");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const [result] = await db.query(
            `INSERT INTO users (username, password, full_name, role)
             VALUES (?, ?, ?, 'LIBRARIAN')`,
            [cleanUsername, hashedPassword, cleanFullName]
        );

        res.status(201).json({
            message: "Tạo tài khoản thủ thư thành công!",
            user: {
                id: result.insertId,
                username: cleanUsername,
                full_name: cleanFullName,
                role: "LIBRARIAN"
            }
        });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            throw new HttpError(409, "Username đã tồn tại!");
        }

        throw err;
    }
}

async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        throw new HttpError(400, "Vui lòng nhập đầy đủ thông tin!");
    }

    if (typeof username !== "string" || typeof password !== "string") {
        throw new HttpError(400, "Username và password phải là chuỗi!");
    }

    const [users] = await db.query(
        `SELECT id, username, password, full_name, role
         FROM users
         WHERE username = ?`,
        [username.trim()]
    );

    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new HttpError(401, "Sai username hoặc password!");
    }

    const token = jwt.sign(
        {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );

    res.json({
        message: "Đăng nhập thành công!",
        token,
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        }
    });
}

function logout(req, res) {
    res.json({ message: "Đăng xuất thành công!" });
}

module.exports = { register, login, logout };
