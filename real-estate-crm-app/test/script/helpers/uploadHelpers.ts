// Reusable upload helpers for CRM file-input tests.
// All selectors are derived from actual frontend DOM:
//   - DocumentUploadSection.tsx  (Owner KYC: Photo / PAN / Aadhar)
//   - MediaUploadSection.tsx     (Property images / videos)
//   - PDFUploadSection.tsx       (Property agreement / verification PDFs in NEW mode)
//   - PropertyDetails.tsx        (Property generic documents in EDIT mode)
import { Page, Locator, expect } from '@playwright/test';
import * as path from 'path';
import { ASSETS_DIR } from './config';

/* ───────────────────────── Asset file paths ───────────────────────── */
export const ASSET_PHOTO = path.join(ASSETS_DIR, 'Adhar_Card.jpg');
export const ASSET_PAN = path.join(ASSETS_DIR, 'Pan_Card.jpg');
export const ASSET_AADHAR = path.join(ASSETS_DIR, 'Adhar_Card.jpg');
export const ASSET_AGREEMENT_PDF = path.join(ASSETS_DIR, 'agreemnet_doc.pdf');
export const ASSET_PROPERTY_PDF = path.join(ASSETS_DIR, 'property_doc.pdf');
export const ASSET_PROPERTY_IMAGE = path.join(ASSETS_DIR, 'property_image.jpg');
export const ASSET_VIDEO = path.join(ASSETS_DIR, 'property_video.mp4');

/* ───────────────────────── Generic helpers ───────────────────────── */

/** Set files on a hidden <input type="file"> locator (string selector or Locator). */
export async function setFileInput(page: Page, locator: string | Locator, filePath: string) {
  const input = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await expect(input).toBeAttached({ timeout: 5_000 });
  await input.setInputFiles(filePath);
}

/* ───────────────────────── Owner KYC uploads ─────────────────────────
   DocumentUploadSection.tsx renders THREE inputs with stable IDs:
     #owner-photo-upload   accept="image/*"
     #owner-pan-upload     accept="image/*,application/pdf"
     #owner-aadhar-upload  accept="image/*,application/pdf"
   Each input is paired with a <label htmlFor="..."> whose text toggles
   between "Choose File" and "Uploading...".
   IMPORTANT: inputs are disabled when isNew=true → must be on EXISTING
   owner edit page (URL: /crm/owners/{UUID}). */

/** Wait until the upload completes by re-reading the label text. */
async function waitForOwnerKycUploadComplete(page: Page, inputId: string) {
  const label = page.locator(`label[for="${inputId}"]`);
  // While uploading the label reads "Uploading...". When done it returns to "Choose File".
  await expect(label).toContainText('Choose File', { timeout: 20_000 });
}

export async function uploadOwnerPhoto(page: Page) {
  await setFileInput(page, '#owner-photo-upload', ASSET_PHOTO);
  await waitForOwnerKycUploadComplete(page, 'owner-photo-upload');
  // Wait for image preview to render (handleSave reloads owner)
  await expect(page.locator('img[alt="Profile"]')).toBeVisible({ timeout: 10_000 });
}

export async function uploadOwnerPan(page: Page) {
  await setFileInput(page, '#owner-pan-upload', ASSET_PAN);
  await waitForOwnerKycUploadComplete(page, 'owner-pan-upload');
  // PAN was uploaded as JPG → preview is <img alt="PAN Card">
  await expect(page.locator('img[alt="PAN Card"]')).toBeVisible({ timeout: 10_000 });
}

export async function uploadOwnerAadhar(page: Page) {
  await setFileInput(page, '#owner-aadhar-upload', ASSET_AADHAR);
  await waitForOwnerKycUploadComplete(page, 'owner-aadhar-upload');
  // Aadhar was uploaded as JPG → preview is <img alt="Aadhar Card">
  await expect(page.locator('img[alt="Aadhar Card"]')).toBeVisible({ timeout: 10_000 });
}

/** Assert that all owner KYC previews rendered. */
export async function assertOwnerKycUploadsVisible(page: Page) {
  await expect(page.locator('img[alt="Profile"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('img[alt="PAN Card"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('img[alt="Aadhar Card"]')).toBeVisible({ timeout: 5_000 });
}

/* ───────────────────────── Property images / videos (pending in NEW mode) ─────────────────────────
   MediaUploadSection.tsx renders ONE hidden <input type="file" accept="image/*"|"video/*" multiple>
   per section (Images section + Videos section). Pending files appear as:
     - Image: button "Pending 1" containing the thumbnail
     - Video: filename text + "Pending" badge */

export async function setPropertyImageInput(page: Page, filePath: string) {
  await setFileInput(page, 'input[type="file"][accept="image/*"]', filePath);
}

export async function setPropertyVideoInput(page: Page, filePath: string) {
  await setFileInput(page, 'input[type="file"][accept="video/*"]', filePath);
}

/* ───────────────────────── Property PDFs (pending in NEW mode) ─────────────────────────
   PDFUploadSection.tsx renders <input type="file" accept="application/pdf,.pdf" />.
   In NEW mode there are exactly 2: Agreement (first) + Verification (second).
   After selection both show "✓ 1 file(s) selected" indicator. */

export async function setPropertyAgreementDocInput(page: Page, filePath: string) {
  const inputs = page.locator('input[type="file"][accept*="pdf"]');
  await expect(inputs.first()).toBeAttached({ timeout: 5_000 });
  await inputs.first().setInputFiles(filePath);
}

export async function setPropertyVerificationDocInput(page: Page, filePath: string) {
  const inputs = page.locator('input[type="file"][accept*="pdf"]');
  await expect(inputs.nth(1)).toBeAttached({ timeout: 5_000 });
  await inputs.nth(1).setInputFiles(filePath);
}

/** Assert that pending property uploads appear in the sidebar before save. */
export async function assertPropertyPendingUploadsVisible(page: Page) {
  const timeout = 10_000;
  // Image pending: button "Pending 1" badge
  const imagePending = await page.getByRole('button', { name: /Pending\s*1/i }).first()
    .isVisible({ timeout }).catch(() => false);
  // Video pending: filename shown OR "Pending" text
  const videoPending = await page.getByText(/property_video\.mp4/i).first()
    .isVisible({ timeout }).catch(() => false);
  // PDF pending: "✓ N file(s) selected" indicator (rendered by PDFUploadSection? No — that's the
  // PropertyDetails edit-mode chooser. In NEW mode the PDF section just shows the standard area.
  // Both PDF sections show "1 file(s) selected" via the document chooser too — actually no, the
  // PDFUploadSection itself just shows uploading spinner. Use "Click to upload" → "Remove" toggle.)
  const pdfPending = await page.getByRole('button', { name: 'Remove' }).first()
    .isVisible({ timeout: 3_000 }).catch(() => false);

  if (!imagePending && !videoPending && !pdfPending) {
    throw new Error('No property pending uploads visible in sidebar (expected image "Pending 1", video filename, or PDF "Remove" button)');
  }
}

/* ───────────────────────── Property generic document uploads (EDIT mode) ─────────────────────────
   PropertyDetails.tsx (lines 1399-1463) renders the Documents section ONLY when isEditing=true.
   Structure:
     <h2>Documents</h2>
     <label>Document Type</label>
     <select> — has options: PHOTO|VIDEO|AGREEMENT|VERIFICATION|OTHER
     <label>Description (optional)</label>
     <input type="text" placeholder="e.g. Signed agreement, ..." />
     <label><input type="file" multiple /></label>  ← unique because it's the only input[type=file] inside the Documents card with no accept attr
     <button type="button">Upload</button>          ← becomes "Uploading..." during upload */

/** Locator for the Documents section card (scoped by the h2 "Documents" heading). */
function propertyDocumentsSection(page: Page): Locator {
  return page.locator('div.bg-white.rounded-lg.shadow').filter({
    has: page.getByRole('heading', { name: 'Documents', exact: true }),
  });
}

export async function selectPropertyDocumentType(
  page: Page,
  docType: 'PHOTO' | 'VIDEO' | 'AGREEMENT' | 'VERIFICATION' | 'OTHER',
) {
  const section = propertyDocumentsSection(page);
  await expect(section).toBeVisible({ timeout: 10_000 });
  // The select is the only <select> inside the Documents section.
  const select = section.locator('select').first();
  await expect(select).toBeVisible({ timeout: 5_000 });
  await select.selectOption(docType);
}

export async function setPropertyGenericDocInput(page: Page, filePath: string) {
  const section = propertyDocumentsSection(page);
  // The file input inside Documents has NO accept attribute (PropertyDetails line 1440-1445).
  // Use :not([accept]) to disambiguate from any other file inputs.
  const docInput = section.locator('input[type="file"]:not([accept])').first();
  await expect(docInput).toBeAttached({ timeout: 5_000 });
  await docInput.setInputFiles(filePath);
  // Confirm "N file(s) selected" appears
  await expect(section.getByText(/file\(s\) selected/i)).toBeVisible({ timeout: 5_000 });
}

export async function clickPropertyDocumentUploadButton(page: Page) {
  const section = propertyDocumentsSection(page);
  // Exact match to avoid hitting "Save Property" or other Upload-suffix buttons.
  const uploadBtn = section.getByRole('button', { name: 'Upload', exact: true });
  await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
  await expect(uploadBtn).toBeEnabled({ timeout: 5_000 });
  await uploadBtn.click();
}

export async function waitForPropertyDocumentUploadComplete(page: Page) {
  const section = propertyDocumentsSection(page);
  // Button text returns from "Uploading..." → "Upload" once handleUploadDocument finishes.
  await expect(section.getByRole('button', { name: 'Upload', exact: true }))
    .toBeVisible({ timeout: 30_000 });
  // "file(s) selected" text disappears after upload (state cleared)
  await expect(section.getByText(/file\(s\) selected/i)).toBeHidden({ timeout: 10_000 }).catch(() => null);
}

/** Assert the uploaded document appears in the Documents list with the given type label. */
export async function assertPropertyDocumentInList(page: Page, docType: string) {
  const section = propertyDocumentsSection(page);
  // Documents list groups by type with the type label rendered as text.
  // Capitalize first letter for human-readable label (AGREEMENT → Agreement).
  const humanLabel = docType.charAt(0).toUpperCase() + docType.slice(1).toLowerCase();
  // Exclude the select dropdown by looking for the label in the list area (after the form inputs)
  // The list area is the sibling that comes after the upload form
  const listLocator = section.locator('div:has-text("' + humanLabel + '")').filter({ hasNot: section.locator('select') });
  await expect(listLocator.first()).toBeVisible({ timeout: 10_000 });
}
