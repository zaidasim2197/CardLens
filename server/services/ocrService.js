import axios from "axios";
import FormData from "form-data";

export async function performOCR(imageBuffer) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  
  if (!apiKey) {
    throw new Error("OCR.space API key is missing. Please configure it in the environment.");
  }

  const form = new FormData();
  form.append("file", imageBuffer, { filename: "business-card.jpg" });
  form.append("apikey", apiKey);
  form.append("OCREngine", "2");

  try {
    const response = await axios.post("https://api.ocr.space/parse/image", form, {
      headers: form.getHeaders(),
    });

    const data = response.data;

    // Handle OCR.space specific API errors
    if (data.IsErroredOnProcessing) {
      console.error("OCR.space Processing Error:", data.ErrorMessage);
      throw new Error("Failed to process image with OCR service.");
    }

    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      return { rawText: "" };
    }

    const rawText = data.ParsedResults[0].ParsedText || "";
    
    // Normalize response for the rest of the application
    return {
      rawText: rawText.trim()
    };
  } catch (error) {
    console.error("OCR.space API Error:", error.response?.data || error.message);
    
    // Re-throw professional error message for the frontend
    if (error.response?.status === 403) {
      throw new Error("OCR service authentication failed. Please check the API key.");
    }
    
    throw new Error("Unable to scan this business card. Please try again.");
  }
}
