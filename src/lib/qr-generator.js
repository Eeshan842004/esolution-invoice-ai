import QRCode from "qrcode";

/**
 * Generate a UPI QR code as a data URL (base64 PNG).
 * @param {object} opts - { upiId, name, amount }
 * @returns {Promise<string>} data:image/png;base64,...
 */
export async function generateUPIQR({ upiId, name, amount }) {
    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;

    const dataUrl = await QRCode.toDataURL(upiString, {
        width: 280,
        margin: 2,
        color: { dark: "#1a3b7d", light: "#ffffff" },
    });

    return dataUrl;
}

/**
 * Generate a plain QR code as a data URL from any string.
 */
export async function generateQR(text, size = 200) {
    return QRCode.toDataURL(text, {
        width: size,
        margin: 2,
    });
}
