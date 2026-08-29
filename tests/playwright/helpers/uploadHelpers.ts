// Reusable upload helpers for CRM file-input tests.
import { Page, Locator, expect } from '@playwright/test';
import * as path from 'path';
import { ASSETS_DIR } from './config';

export const ASSET_PHOTO = path.join(ASSETS_DIR, 'Adhar_Card.jpg');
export const ASSET_PAN = path.join(ASSETS_DIR, 'Pan_Card.jpg');
export const ASSET_AADHAR = path.join(ASSETS_DIR, 'Adhar_Card.jpg');
export const ASSET_AGREEMENT_PDF = path.join(ASSETS_DIR, 'agreemnet_doc.pdf');
export const ASSET_PROPERTY_PDF = path.join(ASSETS_DIR, 'property_doc.pdf');
export const ASSET_PROPERTY_IMAGE = path.join(ASSETS_DIR, 'property_image.jpg');
export const ASSET_VIDEO = path.join(ASSETS_DIR, 'property_video.mp4');

export async function setFileInput(page: Page, locator: string | Locator, filePath: string) {
  const input = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await expect(input).toBeAttached({ timeout: 5_000 });
  await input.setInputFiles(filePath);
}

async function waitForOwnerKycUploadComplete(page: Page, inputId: string) {
  const label = page.locator(`label[for="${inputId}"]`);
  await expect(label).toContainText('Choose File', { timeout: 20_000 });
}

export async function uploadOwnerPhoto(page: Page) {
  await setFileInput(page, '#owner-photo-upload', ASSET_PHOTO);
  await waitForOwnerKycUploadComplete(page, 'owner-photo-upload');
  await expect(page.locator('img[alt="Profile"]')).toBeVisible({ timeout: 10_000 });
}

export async function uploadOwnerPan(page: Page) {
  await setFileInput(page, '#owner-pan-upload', ASSET_PAN);
  await waitForOwnerKycUploadComplete(page, 'owner-pan-upload');
  await expect(page.locator('img[alt="PAN Card"]')).toBeVisible({ timeout: 10_000 });
}

export async function uploadOwnerAadhar(page: Page) {
  await setFileInput(page, '#owner-aadhar-upload', ASSET_AADHAR);
  await waitForOwnerKycUploadComplete(page, 'owner-aadhar-upload');
  await expect(page.locator('img[alt="Aadhar Card"]')).toBeVisible({ timeout: 10_000 });
}

export async function assertOwnerKycUploadsVisible(page: Page) {
  await expect(page.locator('img[alt="Profile"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('img[alt="PAN Card"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('img[alt="Aadhar Card"]')).toBeVisible({ timeout: 5_000 });
}

export async function setPropertyImageInput(page: Page, filePath: string) {
  await setFileInput(page, 'input[type="file"][accept="image/*"]', filePath);
}

export async function setPropertyVideoInput(page: Page, filePath: string) {
  await setFileInput(page, 'input[type="file"][accept="video/*"]', filePath);
}

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

export async function assertPropertyPendingUploadsVisible(page: Page) {
  const timeout = 10_000;
  const imagePending = await page.getByRole('button', { name: /Pending\s*1/i }).first()
    .isVisible({ timeout }).catch(() => false);
  const videoPending = await page.getByText(/property_video\.mp4/i).first()
    .isVisible({ timeout }).catch(() => false);
  const pdfPending = await page.getByRole('button', { name: 'Remove' }).first()
    .isVisible({ timeout: 3_000 }).catch(() => false);

  if (!imagePending && !videoPending && !pdfPending) {
    throw new Error('No property pending uploads visible in sidebar');
  }
}

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
  const select = section.locator('select').first();
  await expect(select).toBeVisible({ timeout: 5_000 });
  await select.selectOption(docType);
}

export async function setPropertyGenericDocInput(page: Page, filePath: string) {
  const section = propertyDocumentsSection(page);
  const input = section.locator('input[type="file"]').filter({ hasNot: page.locator('') }).first();
  await expect(input).toBeAttached({ timeout: 5_000 });
  await input.setInputFiles(filePath);
}

export async function clickPropertyDocumentUploadButton(page: Page) {
  const section = propertyDocumentsSection(page);
  const btn = section.locator('button[type="button"]').filter({ hasText: /^Upload$/i }).first();
  await expect(btn).toBeVisible({ timeout: 5_000 });
  await btn.click();
}

export async function waitForPropertyDocumentUploadComplete(page: Page) {
  const section = propertyDocumentsSection(page);
  await expect(section.locator('button[type="button"]').filter({ hasText: /^Upload$/i }).first()).toBeVisible({ timeout: 20_000 });
}

export async function assertPropertyDocumentInList(page: Page, docType: string) {
  const section = propertyDocumentsSection(page);
  await expect(section.getByText(docType, { exact: false })).toBeVisible({ timeout: 10_000 });
}
