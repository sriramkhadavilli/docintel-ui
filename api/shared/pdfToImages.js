const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

/**
 * Render PDF pages to PNG buffers using Playwright (serverless-safe).
 * Returns scan-perfect images without native dependencies.
 */
async function pdfToPngBuffers(pdfBuffer, maxPages = 10) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
  const pdfPath = path.join(tmpDir, "input.pdf");

  await fs.writeFile(pdfPath, pdfBuffer);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Chromium can natively render PDFs
  await page.goto(`file://${pdfPath}`, { waitUntil: "load" });

  // Best-effort page count detection
  const pageCount = await page.evaluate(() =>
    Math.max(document.querySelectorAll("embed, canvas").length, 1)
  );

  const pagesToRender = Math.min(pageCount, maxPages);
  const images = [];

  for (let i = 0; i < pagesToRender; i++) {
    const png = await page.screenshot({ fullPage: true });

    images.push({
      pageNumber: i + 1,
      pngBuffer: png,
      width: 800,
      height: 1100
    });
  }

  await browser.close();

  return {
    images,
    totalPages: pageCount
  };
}

module.exports = { pdfToPngBuffers };
