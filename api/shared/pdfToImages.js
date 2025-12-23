const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const { createCanvas } = require("canvas");

/**
 * Render each page of PDF into PNG buffers.
 * scale controls image resolution (1.5 is decent, 2.0 is sharper but heavier).
 */
async function pdfToPngBuffers(pdfBuffer, { maxPages = 10, scale = 1.6 } = {}) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdf = await loadingTask.promise;

  const total = pdf.numPages;
  const pagesToRender = Math.min(total, maxPages);

  const out = [];
  for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const pngBuffer = canvas.toBuffer("image/png");
    out.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      pngBuffer
    });
  }

  return { totalPages: total, images: out };
}

module.exports = { pdfToPngBuffers };
