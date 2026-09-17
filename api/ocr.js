import axios from "axios";
import FormData from "form-data";

import { parseOCRText, getEmptyFields } from "../server/services/cardParser.js";


async function performOCR(imageBuffer) {
  const apiKey = process.env.OCR_SPACE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OCR.space API key is missing. Please configure OCR_SPACE_API_KEY in the environment."
    );
  }

  const form = new FormData();
  form.append("file", imageBuffer, { filename: "business-card.jpg" });
  form.append("apikey", apiKey);
  form.append("OCREngine", "2");

  try {
    const response = await axios.post(
      "https://api.ocr.space/parse/image",
      form,
      {
        headers: form.getHeaders(),
      }
    );

    const data = response.data;

    if (data.IsErroredOnProcessing) {
      console.error("OCR.space Processing Error:", data.ErrorMessage);
      throw new Error("Failed to process image with OCR service.");
    }

    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      return { rawText: "" };
    }

    const rawText = data.ParsedResults[0].ParsedText || "";

    return {
      rawText: rawText.trim(),
    };
  } catch (error) {
    console.error(
      "OCR.space API Error:",
      error.response?.data || error.message
    );

    if (error.response?.status === 403) {
      throw new Error(
        "OCR service authentication failed. Please check the API key."
      );
    }

    throw new Error("Unable to scan this business card. Please try again.");
  }
}

function parseMultipartForm(body, contentType) {
  return new Promise((resolve, reject) => {
    try {
      const boundary = contentType.split("boundary=")[1];
      if (!boundary) {
        reject(new Error("No boundary in multipart content-type"));
        return;
      }

      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const boundaryBuffer = Buffer.from("--" + boundary);
      const endBuffer = Buffer.from("--" + boundary + "--");

      let start = 0;
      while (start < buffer.length) {
        const idx = buffer.indexOf(boundaryBuffer, start);
        if (idx === -1) break;
        start = idx + boundaryBuffer.length;

        const nextIdx = buffer.indexOf(boundaryBuffer, start);
        if (nextIdx === -1) break;

        const part = buffer.slice(start, nextIdx);

        const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
        if (headerEnd === -1) continue;

        const headers = part.slice(0, headerEnd).toString("utf8");
        let content = part.slice(headerEnd + 4);
        if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
          content = content.slice(0, content.length - 2);
        }

        if (
          headers.includes('name="image"') ||
          /filename="[^"]+"/.test(headers)
        ) {
          const mimeTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1].trim() : "image/jpeg";
          resolve({ fileBuffer: content, mimeType });
          return;
        }
      }
      reject(new Error("No image file found in form data"));
    } catch (e) {
      reject(e);
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const contentType = req.headers["content-type"] || "";

    let imageBuffer;
    let mimeType = "image/jpeg";

    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === "string") {
      rawBody = Buffer.from(req.body);
    } else {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      rawBody = Buffer.concat(chunks);
    }

    if (contentType.includes("multipart/form-data")) {
      const parsed = await parseMultipartForm(rawBody, contentType);
      imageBuffer = parsed.fileBuffer;
      mimeType = parsed.mimeType;
    } else if (contentType.includes("application/octet-stream") ||
               contentType.startsWith("image/")) {
      imageBuffer = rawBody;
      mimeType = contentType;
    } else if (req.body && typeof req.body === "object" && req.body.image) {
      const b64 = req.body.image.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(b64, "base64");
    } else {
      return res.status(400).json({ error: "No image file provided." });
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ error: "No image file provided." });
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Image too large. Max 10 MB." });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      return res.status(400).json({
        error: "Invalid image format. Supported: JPG, PNG, WEBP.",
      });
    }

    const ocrResult = await performOCR(imageBuffer);

    if (!ocrResult.rawText) {
      return res.json({ rawText: "", parsed: getEmptyFields() });
    }

    const parsed = parseOCRText(ocrResult.rawText);

    return res.json({
      rawText: ocrResult.rawText,
      parsed: parsed,
    });
  } catch (error) {
    console.error("OCR Handler Error:", error.message);
    return res
      .status(500)
      .json({ error: error.message || "Failed to process image." });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
