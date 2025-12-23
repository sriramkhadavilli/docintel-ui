const { parseMultipart } = require("../shared/multipart");
const { getDIClient, analyzeLayoutPdf } = require("../shared/diClient");
const { buildDocxFromLayout } = require("../shared/docxBuilder");

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
    const layout = await analyzeLayoutPdf(client, uploaded.buffer);
    const docxBuf = await buildDocxFromLayout(layout);

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
