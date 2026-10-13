import QRCode from "qrcode";

/**
 * Renders a QR code as a PNG data URL, on the server or in the browser.
 *
 * These payloads identify students and staff, so they are encoded locally. Nothing
 * is sent to a third-party image service.
 */
export function qrDataUrl(text: string, size: number): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: size });
}
