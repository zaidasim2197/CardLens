import axios from "axios";
import FormData from "form-data";

function getEmptyFields() {
  return {
    fullName: "",
    jobTitle: "",
    companyName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    website: "",
    address: "",
    city: "",
    country: "",
    notes: "",
  };
}

function parseOCRText(text) {
  if (!text) return getEmptyFields();

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fields = getEmptyFields();

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/i;
  const urlRegex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;

  let phoneCount = 0;

  for (const line of lines) {
    if (!fields.email && emailRegex.test(line)) {
      fields.email = line.match(emailRegex)[0];
      continue;
    }

    if (
      !fields.website &&
      (line.toLowerCase().includes("www.") || urlRegex.test(line)) &&
      !line.includes("@")
    ) {
      fields.website = line;
      continue;
    }

    if (phoneRegex.test(line) && /\d{3}/.test(line)) {
      if (phoneCount === 0) {
        fields.phone = line;
        phoneCount++;
      } else if (phoneCount === 1) {
        fields.alternatePhone = line;
        phoneCount++;
      }
      continue;
    }
  }

  let remainingLines = lines.filter(
    (l) =>
      l !== fields.email &&
      l !== fields.phone &&
      l !== fields.alternatePhone &&
      l !== fields.website
  );

  const titleKeywords = [
    "ceo",
    "chief",
    "officer",
    "manager",
    "director",
    "president",
    "founder",
    "executive",
    "engineer",
    "developer",
    "consultant",
  ];

  const titleIndex = remainingLines.findIndex((line) =>
    titleKeywords.some((keyword) => line.toLowerCase().includes(keyword))
  );

  if (titleIndex !== -1) {
    fields.jobTitle = remainingLines[titleIndex];
    remainingLines.splice(titleIndex, 1);
  }

  let domain = "";
  if (fields.email) {
    domain = fields.email.split("@")[1].split(".")[0].toLowerCase();
  } else if (fields.website) {
    domain = fields.website.replace("www.", "").split(".")[0].toLowerCase();
  }

  const companyIndex = remainingLines.findIndex((line) => {
    const l = line.toLowerCase().replace(/\s+/g, "");
    return domain && (l.includes(domain) || domain.includes(l));
  });

  if (companyIndex !== -1) {
    fields.companyName = remainingLines[companyIndex];
    remainingLines.splice(companyIndex, 1);
  } else if (remainingLines.length >= 2 && !fields.jobTitle) {
    fields.companyName = remainingLines[0];
    remainingLines.splice(0, 1);
  } else if (remainingLines.length > 1 && fields.jobTitle) {
    fields.companyName = remainingLines[0];
    remainingLines.splice(0, 1);
  }

  if (remainingLines.length > 0) {
    fields.fullName = remainingLines[0];
    remainingLines.splice(0, 1);
  }

  if (remainingLines.length > 0) {
    fields.address = remainingLines.join(", ");
  }

  if (fields.address) {
    const addressLower = fields.address.toLowerCase();
    if (addressLower.includes("karachi")) {
      fields.city = "Karachi";
      fields.country = "Pakistan";
    }
  }

  return fields;
}

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
        const content = part.slice(headerEnd + 4);

        if (
          headers.includes('name="image"') ||
          /filename="[^"]+"/.test(headers)
        ) {
          const mimeTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
          const mime = mimeTypeMatch ? mimeTypeMatch[1].trim() : "image/jpeg";
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
