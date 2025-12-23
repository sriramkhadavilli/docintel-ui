const { parseMultipart } = require("../shared/multipart");
const { getDIClient, analyzeLayoutPdf } = require("../shared/diClient");

// ✅ STEP 7B.4 — use hybrid builder + pdf-to-images
const { buildHybridDocx } = require("../shared/docxBuilder");
const { pdfToPngBuffers } = require("../shared/pdfToImages");

const MAX_MB = 15;
const MAX_BYTES = MAX_MB * 1024 * 1024;

// ✅ STEP 7B.4 — stricter safety limits (free-tier + performance)
const MAX_PAGES_PER_FILE = 10; // keep free + fast

module.exports = async function (context, req) {
  context.log("PDF convert request received");

  try {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("multipart/form-data")) {
      context.res = { status: 400, body: "Expected multipart/form-data upload." };
      return;
    }

    const { files } = await parseMultipart(req);
    const uploaded = files["file"];
    if (!uploaded) {
      context.res = { status: 400, body: "Missing form field: file" };
      return;
    }

    if (uploaded.buffer.length > MAX_BYTES) {
      context.res = { status: 413, body: `File too large. Max ${MAX_MB}MB.` };
      return;
    }

    const isPdf =
      uploaded.mimeType === "application/pdf" ||
      (uploaded.filename || "").toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      context.res = { status: 400, body: "Upload must be a PDF." };
      return;
    }

    const client = getDIClient();

    // Run Document Intelligence layout extraction
    const layout = await analyzeLayoutPdf(client, uploaded.buffer);

    // Render PDF pages to images (scan-perfect look)
    const { images, totalPages } = await pdfToPngBuffers(uploaded.buffer, {
      maxPages: MAX_PAGES_PER_FILE,
      scale: 1.6
    });

    if (totalPages > MAX_PAGES_PER_FILE) {
      context.res = {
        status: 400,
        body: `PDF has ${totalPages} pages. Free-tier limit is ${MAX_PAGES_PER_FILE} pages per file.`
      };
      return;
    }

    // Build hybrid docx (page images + editable content)
    const docxBuf = await buildHybridDocx(layout, images);

    // ✅ STEP 7A.2 — dynamic output filename
    const outName = (uploaded.filename || "converted.pdf")
      .replace(/\.pdf$/i, "")
      .replace(/[^\w\-]+/g, "_") + ".docx";

    context.res = {
      status: 200,
      isRaw: true,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outName}"`
      },
      body: docxBuf
    };
  } catch (e) {
    context.log.error("Conversion failed:", e);
    context.res = {
      status: 500,
      body: `Server error: ${e.message}`
    };
  }
};
