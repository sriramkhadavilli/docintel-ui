const { parseMultipart } = require("../shared/multipart");
const { getDIClient, analyzeLayoutPdf } = require("../shared/diClient");

// ✅ Playwright hybrid builder + renderer
const { buildHybridDocx } = require("../shared/docxBuilder");
const { pdfToPngBuffers } = require("../shared/pdfToImages");

const MAX_MB = 15;
const MAX_BYTES = MAX_MB * 1024 * 1024;

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

    // 1) Document Intelligence layout extraction (editable text/tables)
    const layout = await analyzeLayoutPdf(client, uploaded.buffer);

    // 2) Render PDF pages to images (scan-perfect look)
    const MAX_PAGES = 10;
    const { images, totalPages } = await pdfToPngBuffers(uploaded.buffer, MAX_PAGES);

    if (totalPages > MAX_PAGES) {
      context.res = {
        status: 400,
        body: `PDF has ${totalPages} pages. Max allowed is ${MAX_PAGES}.`
      };
      return;
    }

    // 3) Build hybrid docx (page images + editable content)
    const docxBuf = await buildHybridDocx(layout, images);

    // ✅ Dynamic output filename
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
