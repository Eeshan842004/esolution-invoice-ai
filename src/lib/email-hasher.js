import md5 from "md5";

/**
 * Hash an email for privacy-safe storage in karma DB.
 * Always lowercases and trims before hashing.
 */
export function hashEmail(email) {
    return md5(email.trim().toLowerCase());
}

/**
 * Get first name only from a full name (privacy).
 */
export function getFirstName(fullName) {
    if (!fullName) return "Unknown";
    return fullName.trim().split(/\s+/)[0];
}
