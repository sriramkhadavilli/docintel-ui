// api/shared/docxBuilder.js

const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak
} = require("docx");

function safeText(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

/**
 * Checks if a line overlaps any table span range (to avoid duplicate text).
 * If spans are missing, returns false (we keep the line).
 */
function lineOverlapsTableSpans(line, tableSpanRanges) {
  const spans = line?.spans || [];
  if (!spans.length || !tableSpanRanges.length) return false;

  for (const sp of spans) {
    const a0 = sp.offset ?? 0;
    const a1 = a0 + (sp.length ?? 0);

    for (const [b0, b1] of tableSpanRanges) {
      if (a0 < b1 && b0 < a1) return true;
    }
  }
  return false;
}

function buildWordTableFromDI(diTable) {
  const rowCount = diTable?.rowCount || 0;
  const colCount = diTable?.columnCount || 0;
  const cells = diTable?.cells || [];

  // Create empty grid
  const grid = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => "")
  );

  // Fill values
  for (const c of cells) {
    const r = c?.rowIndex ?? 0;
    const col = c?.columnIndex ?? 0;
    const txt = safeText(c?.content);
    if (r < rowCount && col < colCount) grid[r][col] = txt;
  }

  // Convert grid to docx Table
  const rows = grid.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cellText) =>
            new TableCell({
              width: {
                size: 100 / Math.max(colCount, 1),
                type: WidthType.PERCENTAGE
              },
              children: [
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [new TextRun(cellText || "")]
                })
              ]
            })
        )
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows
  });
}

async function buildDocxFromLayout(layoutResult) {
  const children = [];

  // ✅ Supports REST SDK shape (layoutResult.analyzeResult.*) + legacy (layoutResult.*)
  const analyze = layoutResult?.analyzeResult || layoutResult || {};
  const pages = analyze?.pages || [];
  const tables = analyze?.tables || [];

  // Precompute all table span ranges for deduping lines
  const allTableSpanRanges = [];
  for (const t of tables) {
    for (const sp of t?.spans || []) {
      const start = sp.offset ?? 0;
      const end = start + (sp.length ?? 0);
      if (end > start) allTableSpanRanges.push([start, end]);
    }
  }

  let tableCounter = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageNumber = i + 1;

    // Page heading
    children.push(
      new Paragraph({
        text: `Page ${pageNumber}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
      })
    );

    // 1) Insert tables belonging to this page
    const tablesOnPage = tables.filter((t) =>
      (t?.boundingRegions || []).some((br) => br?.pageNumber === pageNumber)
    );

    for (const t of tablesOnPage) {
      tableCounter += 1;

      children.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: `Table ${tableCounter}`, bold: true })]
        })
      );

      children.push(buildWordTableFromDI(t));

      children.push(
        new Paragraph({
          spacing: { after: 200 },
          text: ""
        })
      );
    }

    // 2) Insert text lines (skip ones that overlap table spans to reduce duplicates)
    const lines = pages[i]?.lines || [];
    for (const ln of lines) {
      const t = safeText(ln?.content);
      if (!t) continue;

      if (lineOverlapsTableSpans(ln, allTableSpanRanges)) continue;

      children.push(
        new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [new TextRun(t)]
        })
      );
    }

    // Page break between pages
    if (i !== pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const doc = new Document({
    sections: [{ children }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = { buildDocxFromLayout };
