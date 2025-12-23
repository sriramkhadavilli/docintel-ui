const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require("docx");

function safeText(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

async function buildDocxFromLayout(layoutResult) {
  const children = [];

  const pages = layoutResult?.pages || [];
  for (let i = 0; i < pages.length; i++) {
    children.push(new Paragraph({ text: `Page ${i + 1}`, heading: HeadingLevel.HEADING_2 }));

    const page = pages[i];
    const lines = page?.lines || [];
    for (const ln of lines) {
      const t = safeText(ln?.content);
      if (t) children.push(new Paragraph({ children: [new TextRun(t)] }));
    }

    if (i !== pages.length - 1) {
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({
    sections: [{ children }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = { buildDocxFromLayout };
