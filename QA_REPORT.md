# Aventure Aviation Contact Capture — QA Report

Date: 17 September 2026  
Test target: local production build (`npm run build`) and local API  
Approach: lightweight automated checks, source review, and browser smoke testing. Only one live OCR request was made to conserve API usage.

## Summary

- **Passed:** 9
- **Partial / code-reviewed only:** 7
- **Failed:** 3
- **Not run:** 2

The build is stable and the core capture UI, parser, camera-denial message, blank-result guard, common phone formats, exact-email duplicate logic, local route refresh, and secret isolation checks passed. The three items that should be fixed before presenting are the oversized-file response, validation when editing an already saved contact, and the missing reliable demo fallback.

## Checklist results

| Test | Result | Evidence / notes |
|---|---|---|
| Mobile phone | **Partial** | Responsive source was reviewed, including the fixed header/footer navigation and the revised single-scroll review form. A physical iPhone or Android device was not available, so production-device behaviour was not verified. |
| Desktop browser | **Pass** | Local production build opened at 1280×720. Home and Verified Contacts rendered correctly and navigation worked. |
| Upload a supported business-card image | **Partial** | The upload control advertises and validates JPG, PNG, and WEBP. The API accepted the supplied PNG when sent with `image/png`. The native browser file chooser could not be completed in the test browser. |
| Camera capture | **Partial** | Camera UI opened correctly. Physical capture could not be completed because the test browser had no permitted camera. |
| OCR success using prepared sample card | **Partial** | One live OCR request returned a valid response. The supplied image is a screenshot of the review screen rather than an isolated card, so OCR also read interface text and produced an inaccurate structured record (`Review Contact` as the name). Retest with a clean card image. |
| Low-quality / blank image | **Pass (automated)** | Three validation tests passed for blank, whitespace-only, punctuation-only, missing, and empty parsed results. These results are rejected before the review form opens. No second live OCR credit was used. |
| Invalid image type | **Pass** | Client rejects unsupported MIME types. API returned HTTP 400 JSON: `Invalid image format. Supported: JPG, PNG, WEBP.` |
| Oversized image | **Fail** | A 10 MB + 1 byte upload returned HTTP 500 HTML from Multer. Because the frontend expects JSON, the user may see a technical parsing error instead of a friendly size warning. Add Multer error handling that returns HTTP 413 or 400 JSON. |
| No-camera-permission path | **Pass** | Browser showed `Camera Unavailable` with a clear permission explanation and a Try Again action. |
| OCR / API error path | **Partial** | Client catch/error UI and server JSON error handling were reviewed. A controlled live OCR-service outage was not introduced. Note that non-JSON server errors, such as the current oversized-file response, are not handled cleanly. |
| Manual correction of every contact field | **Partial** | Both review and saved-contact edit forms expose full name, company, job title, email, phone, alternate phone, website, address, city, country, and notes. Full end-to-end editing was not run because a controlled OCR fixture is unavailable. |
| Invalid email handling | **Fail / inconsistent** | Initial OCR review rejects malformed email through its schema. The saved-contact edit form has no equivalent validation and uses a plain text input, so an invalid email can be saved later. |
| Phone number formatting | **Pass** | Parser preserved three common formats: `+1 (202) 555-0148`, `0319-1980857`, and `+971 50 123 4567`. Values are trimmed but not normalized to one canonical format. |
| Exact-email duplicate | **Pass (code review)** | Duplicate comparison trims and lowercases both emails before exact matching. |
| Possible duplicate state | **Partial** | Warning modal and Save Anyway / Review Existing actions are implemented. Detection covers exact email, normalized exact phone, and exact name + company. There is no fuzzy similarity detection despite the `Possible Duplicate` label. |
| Save success state | **Partial** | Success view and IndexedDB save path are implemented. It was not exercised end-to-end because the test environment lacked a clean controlled OCR fixture. |
| Refresh / reopen deployed link | **Partial** | Local production routes `/` and `/verified` survived refresh and reopened correctly. No deployed production URL was supplied, so hosting behaviour was not verified. |
| No secret / API key visible in browser | **Pass** | Production `dist` contains no `OCR_SPACE_API_KEY`, `apikey`, or OCR service URL markers. No hard-coded OCR key assignment was found in tracked source. `.env` is ignored, and the browser calls same-origin `/api/ocr`. |
| Reliable fallback demo flow | **Fail** | No deterministic demo/fallback response or prepared fixture exists. The meeting demo currently depends on the live OCR service, network, API key, and card-image quality. |

## Supporting checks

- Production TypeScript/Vite build: **passed**.
- Contact parser samples: **passed** for the two included sample texts.
- Blank/contact validation tests: **3 passed, 0 failed**.
- Lint: **completed with warnings and no errors**. Warnings include unused variables, effect state updates, and React fast-refresh notices.
- Local `/verified` route refresh: **passed**.

## Recommended fixes before the meeting

1. Return a JSON 413/400 response for Multer `LIMIT_FILE_SIZE` errors and make the client tolerate non-JSON API errors.
2. Apply the same email and required-field validation to `EditContactModal` that is used by the initial OCR review form.
3. Add a clearly labelled demo fallback using a prepared sample card and deterministic extracted data, available when live OCR fails.
4. Retest the deployed HTTPS link on one real iPhone and one Android phone, including camera permission, capture, keyboard interaction, and the fixed header/footer navigation.

