const express = require("express");
const cors = require("cors");
require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const authorRoutes = require("./routes/authorRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const readerRoutes = require("./routes/readerRoutes");
const borrowRoutes = require("./routes/borrowRoutes");
const statisticsRoutes = require("./routes/statisticsRoutes");

if (!process.env.JWT_SECRET) {
    console.error("Thiếu JWT_SECRET trong file .env!");
    process.exit(1);
}

const app = express();

app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN } : undefined));
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ message: "Library Management API đang hoạt động!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/authors", authorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/readers", readerRoutes);
app.use("/api/borrow", borrowRoutes);
app.use("/api/statistics", statisticsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
