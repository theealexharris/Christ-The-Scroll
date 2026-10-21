import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocModel } from "./model";

const NAVY = rgb(0.07, 0.16, 0.34);
const SLATE = rgb(0.28, 0.33, 0.41);
const RED = rgb(0.66, 0.11, 0.11);

/** Standard PDF fonts only cover WinAnsi; replace anything else with a close ASCII equivalent. */
function makeSanitizer(font: PDFFont) {
  const cache = new Map<string, string>();
  const replacements: Record<string, string> = { "−": "-", "≥": ">=", "≤": "<=", "≈": "~", "→": "->", "✓": "x", " ": " " };
  return (text: string) =>
    Array.from(text)
      .map((ch) => {
        if (cache.has(ch)) return cache.get(ch)!;
        let out = replacements[ch] ?? ch;
        try {
          font.encodeText(out);
        } catch {
          out = "?";
        }
        cache.set(ch, out);
        return out;
      })
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text === "") return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPdf(model: DocModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(model.title);
  pdf.setProducer("DealPilot AI");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = makeSanitizer(font);
  const margin = 54;
  const width = 612;
  const height = 792;
  const contentWidth = width - margin * 2;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin + 20) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }
  };
  const text = (value: string, opts: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const f = opts.f ?? font;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    for (const line of wrap(clean(value), f, size, contentWidth - indent)) {
      ensure(size + 4);
      page.drawText(line, { x: margin + indent, y: y - size, size, font: f, color: opts.color ?? rgb(0.1, 0.1, 0.12) });
      y -= size + (opts.gap ?? 4);
    }
  };

  for (const banner of model.banners) {
    ensure(24);
    page.drawRectangle({ x: margin, y: y - 20, width: contentWidth, height: 20, color: rgb(1, 0.93, 0.93), borderColor: RED, borderWidth: 1 });
    page.drawText(clean(banner), { x: margin + 8, y: y - 14, size: 10, font: bold, color: RED });
    y -= 28;
  }
  text(model.title, { f: bold, size: 18, color: NAVY, gap: 6 });
  text(model.subtitle, { size: 9, color: SLATE, gap: 10 });

  for (const section of model.sections) {
    y -= 6;
    ensure(30);
    text(section.heading, { f: bold, size: 12, color: NAVY, gap: 6 });
    if (section.table) {
      for (const [label, value] of section.table) {
        const labelLines = wrap(clean(label), bold, 9, contentWidth * 0.4 - 6);
        const valueLines = wrap(clean(value), font, 9, contentWidth * 0.6);
        const rows = Math.max(labelLines.length, valueLines.length);
        ensure(rows * 13 + 2);
        labelLines.forEach((l, i) => page.drawText(l, { x: margin, y: y - 9 - i * 13, size: 9, font: bold, color: SLATE }));
        valueLines.forEach((l, i) => page.drawText(l, { x: margin + contentWidth * 0.4, y: y - 9 - i * 13, size: 9, font }));
        y -= rows * 13 + 2;
      }
    }
    for (const line of section.lines ?? []) text(line, { size: 9.5 });
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(clean(`${model.footer} · Page ${i + 1} of ${pages.length}`), { x: margin, y: 28, size: 8, font, color: SLATE });
  });
  return pdf.save();
}

export async function renderDocx(model: DocModel): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  for (const banner of model.banners) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { type: ShadingType.CLEAR, fill: "FDECEC", color: "auto" },
        children: [new TextRun({ text: banner, bold: true, color: "A81C1C" })],
        spacing: { after: 120 },
      }),
    );
  }
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: model.title, color: "122957" })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: model.subtitle, italics: true, color: "475569", size: 18 })], spacing: { after: 240 } }));
  for (const section of model.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: section.heading, color: "122957" })], spacing: { before: 240, after: 120 } }));
    if (section.table) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: section.table.map(
            ([label, value]) =>
              new TableRow({
                children: [
                  new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })] }),
                  new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph(value)] }),
                ],
              }),
          ),
        }),
      );
    }
    for (const line of section.lines ?? []) children.push(new Paragraph({ children: [new TextRun(line)], spacing: { after: 60 } }));
  }
  children.push(new Paragraph({ children: [new TextRun({ text: model.footer, italics: true, size: 16, color: "475569" })], spacing: { before: 360 } }));
  const doc = new Document({ creator: "DealPilot AI", title: model.title, sections: [{ children }] });
  return Packer.toBuffer(doc);
}
