export const NO_CONTACT_MESSAGE = "No readable business card detected. Please capture a clear, well-lit photo of the card or upload another image.";

// Keep partial contacts reviewable, but reject empty output and OCR punctuation/noise.
export function hasReadableContact(rawText, parsed) {
  if (typeof rawText !== 'string' || !/[\p{L}\p{N}]/u.test(rawText) || !parsed) return false;
  return ['fullName', 'companyName', 'jobTitle', 'email', 'phone', 'alternatePhone', 'website', 'address'].some(key =>
    typeof parsed[key] === 'string' && /[\p{L}\p{N}]/u.test(parsed[key])
  );
}
