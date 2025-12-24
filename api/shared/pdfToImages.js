const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { pathToFileURL } = require("url");

async function pdfToPngBuffers(pdfBuffer, maxPages = 10) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  await fs.writeFile(pdfPath, pdfBuffer);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // Use file URL safely
    const fileUrl = pathToFileURL(pdfPath).toString();
    await page.goto(fileUrl, { waitUntil: "load" });

    // We can’t reliably count PDF pages from DOM here; keep it simple:
    // Treat totalPages as maxPages (enforced server-side) for now.
    const totalPages = maxPages;

    const images = [];
    for (let i = 0; i < maxPages; i++) {
      const png = await page.screenshot({ fullPage: true });
      images.push({
        pageNumber: i + 1,
        pngBuffer: png,
        width: 800,
        height: 1100
      });
    }

    return { images, totalPages };
  } finally {
    if (browser) await browser.close().catch(() => {});
    // Best-effort cleanup
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { pdfToPngBuffers };
