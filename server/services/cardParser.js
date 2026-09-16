export function getEmptyFields() {
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

export function parseOCRText(text) {
  if (!text) return getEmptyFields();
  
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const fields = getEmptyFields();

  // Basic heuristical parsing
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/i;
  const urlRegex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;

  let phoneCount = 0;

  for (const line of lines) {
    // Email
    if (!fields.email && emailRegex.test(line)) {
      fields.email = line.match(emailRegex)[0];
      continue;
    }

    // Website (if it contains www. or .com etc, and isn't email)
    if (!fields.website && (line.toLowerCase().includes("www.") || urlRegex.test(line)) && !line.includes("@")) {
      fields.website = line;
      continue;
    }

    // Phone
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

  // Remaining lines that are not email, phone, or website
  let remainingLines = lines.filter(
    l => l !== fields.email && l !== fields.phone && l !== fields.alternatePhone && l !== fields.website
  );

  // Job Title Heuristics
  const titleKeywords = ["ceo", "chief", "officer", "manager", "director", "president", "founder", "executive", "engineer", "developer", "consultant"];
  
  const titleIndex = remainingLines.findIndex(line => 
    titleKeywords.some(keyword => line.toLowerCase().includes(keyword))
  );

  if (titleIndex !== -1) {
    fields.jobTitle = remainingLines[titleIndex];
    remainingLines.splice(titleIndex, 1);
  }

  // Company Name Heuristics
  // Look at email domain if available
  let domain = "";
  if (fields.email) {
    domain = fields.email.split("@")[1].split(".")[0].toLowerCase();
  } else if (fields.website) {
    domain = fields.website.replace("www.", "").split(".")[0].toLowerCase();
  }

  const companyIndex = remainingLines.findIndex(line => {
    const l = line.toLowerCase().replace(/\s+/g, "");
    return domain && (l.includes(domain) || domain.includes(l));
  });

  if (companyIndex !== -1) {
    fields.companyName = remainingLines[companyIndex];
    remainingLines.splice(companyIndex, 1);
  } else if (remainingLines.length >= 2 && !fields.jobTitle) {
    // Fallback if we couldn't find company/title easily
    fields.companyName = remainingLines[0];
    remainingLines.splice(0, 1);
  } else if (remainingLines.length > 1 && fields.jobTitle) {
    // If we found a title, usually the company name is another prominent line
    // We'll just guess it might be the first line if name is the second, or vice versa
    // For this specific layout: Company -> Name -> Title
    fields.companyName = remainingLines[0];
    remainingLines.splice(0, 1);
  }

  // Full Name Heuristic - usually what's left first
  if (remainingLines.length > 0) {
    fields.fullName = remainingLines[0];
    remainingLines.splice(0, 1);
  }

  // Address
  if (remainingLines.length > 0) {
    fields.address = remainingLines.join(", ");
  }

  // City / Country Extraction
  if (fields.address) {
    const addressLower = fields.address.toLowerCase();
    if (addressLower.includes("karachi")) {
      fields.city = "Karachi";
      fields.country = "Pakistan";
    }
    // Could add more basic city extraction here if needed
  }

  return fields;
}
