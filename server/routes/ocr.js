import { hasReadableContact, NO_CONTACT_MESSAGE } from "../../shared/contactValidation.mjs";
import express from "express";
import multer from "multer";
import { performOCR } from "../services/ocrService.js";
import { parseOCRText } from "../services/cardParser.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    // MIME type validation
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Invalid image format. Supported: JPG, PNG, WEBP." });
    }

    const ocrResult = await performOCR(req.file.buffer);
    
    const parsed = parseOCRText(ocrResult.rawText || "");
    if (!hasReadableContact(ocrResult.rawText, parsed)) {
      return res.status(422).json({ code: "NO_CONTACT_DETECTED", error: NO_CONTACT_MESSAGE });
    }

    res.json({
      rawText: ocrResult.rawText,
      parsed: parsed,
    });
  } catch (error) {
    console.error("OCR Route Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to process image." });
  }
});

export default router;

