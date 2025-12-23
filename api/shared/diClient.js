const DocumentIntelligence = require("@azure-rest/ai-document-intelligence").default;
const {
  isUnexpected,
  getLongRunningPoller
} = require("@azure-rest/ai-document-intelligence");

function getDIClient() {
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  const key = process.env.AZURE_DI_KEY;

  if (!endpoint || !key) {
    throw new Error("Missing AZURE_DI_ENDPOINT or AZURE_DI_KEY in app settings.");
  }

  // API KEY auth (REST SDK)
  return DocumentIntelligence(endpoint, { key });
}

async function analyzeLayoutPdf(client, pdfBuffer) {
  const base64Source = Buffer.from(pdfBuffer).toString("base64");

  const initialResponse = await client
    .path("/documentModels/{modelId}:analyze", "prebuilt-layout")
    .post({
      contentType: "application/json",
      body: { base64Source }
    });

  if (isUnexpected(initialResponse)) {
    throw new Error(initialResponse.body?.error?.message || "Document Intelligence analyze failed");
  }

  const poller = getLongRunningPoller(client, initialResponse);
  const result = await poller.pollUntilDone();

  // REST SDK returns { body: ... }
  return result.body;
}

module.exports = { getDIClient, analyzeLayoutPdf };
