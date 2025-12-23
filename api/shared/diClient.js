const { DocumentIntelligenceClient } = require("@azure/ai-documentintelligence");
const { AzureKeyCredential } = require("@azure/core-auth");

function getDIClient() {
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  const key = process.env.AZURE_DI_KEY;

  if (!endpoint || !key) {
    throw new Error("Missing AZURE_DI_ENDPOINT or AZURE_DI_KEY in app settings.");
  }
  return new DocumentIntelligenceClient(endpoint, new AzureKeyCredential(key));
}

async function analyzeLayoutPdf(client, pdfBuffer) {
  const poller = await client.beginAnalyzeDocument("prebuilt-layout", pdfBuffer, {
    contentType: "application/pdf"
  });
  const result = await poller.pollUntilDone();
  return result;
}

module.exports = { getDIClient, analyzeLayoutPdf };
