const MAX_QUANTITY = 100000;

function isPositiveInteger(value) {
    if (typeof value !== "number" && typeof value !== "string") return false;

    const text = String(value).trim();

    return /^\d+$/.test(text) && Number(text) > 0 && Number(text) <= 2147483647;
}

function isNonNegativeInteger(value) {
    if (typeof value !== "number" && typeof value !== "string") return false;

    const text = String(value).trim();

    return /^\d+$/.test(text) && Number(text) <= MAX_QUANTITY;
}

function isValidDateString(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function isValidEmail(value) {
    return typeof value === "string" &&
        value.length <= 100 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
    return typeof value === "string" && /^[0-9+()\-.\s]{6,20}$/.test(value);
}

function requiredText(value, maxLength) {
    if (typeof value !== "string") return null;

    const text = value.trim();

    if (!text || text.length > maxLength) return null;

    return text;
}

function optionalText(value, maxLength) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") return false;

    const text = value.trim();

    if (!text) return null;
    if (text.length > maxLength) return false;

    return text;
}

function queryText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function escapeLike(text) {
    return text.replace(/[\\%_]/g, "\\$&");
}

module.exports = {
    isPositiveInteger,
    isNonNegativeInteger,
    isValidDateString,
    isValidEmail,
    isValidPhone,
    requiredText,
    optionalText,
    queryText,
    escapeLike
};
