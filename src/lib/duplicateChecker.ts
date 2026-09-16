import { storageService } from "./db";
import type { ContactRecord, OCRData } from "../types";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedRecord?: ContactRecord;
  matchReason?: string;
}

export async function checkDuplicateContact(
  newContact: OCRData
): Promise<DuplicateCheckResult> {
  const existingContacts = await storageService.getVerifiedContacts();

  const newEmail = newContact.email?.trim().toLowerCase();
  const newPhone = newContact.phone?.replace(/\D/g, "");
  const newName = newContact.fullName?.trim().toLowerCase();
  const newCompany = newContact.companyName?.trim().toLowerCase();

  for (const contact of existingContacts) {
    const exData = contact.verifiedData;
    const exEmail = exData.email?.trim().toLowerCase();
    const exPhone = exData.phone?.replace(/\D/g, "");
    const exName = exData.fullName?.trim().toLowerCase();
    const exCompany = exData.companyName?.trim().toLowerCase();

    // 1. Email exact match
    if (newEmail && exEmail && newEmail === exEmail) {
      return {
        isDuplicate: true,
        matchedRecord: contact,
        matchReason: `Matching email address: ${exData.email}`,
      };
    }

    // 2. Phone match (min 7 digits)
    if (newPhone && exPhone && newPhone.length >= 7 && newPhone === exPhone) {
      return {
        isDuplicate: true,
        matchedRecord: contact,
        matchReason: `Matching phone number: ${exData.phone}`,
      };
    }

    // 3. Name & Company exact match
    if (newName && exName && newName === exName && newCompany && exCompany && newCompany === exCompany) {
      return {
        isDuplicate: true,
        matchedRecord: contact,
        matchReason: `Matching contact name and company (${exData.fullName} at ${exData.companyName})`,
      };
    }
  }

  return { isDuplicate: false };
}
