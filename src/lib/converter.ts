/**
 * Document → Markdown dispatcher.
 *
 * Ondersteunde formaten: .md, .txt, .html, .htm, .pdf, .docx, .pptx, .xlsx
 *
 * De zware converters (pdf, docx, pptx, xlsx) worden lazy-loaded zodat
 * de eerste bundle klein blijft — pas wanneer een gebruiker een PDF
 * upload, downloadt de browser pdfjs-dist.
 */

export class ConverterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConverterError";
  }
}

export const ONDERSTEUNDE_EXTENSIES = [
  ".md",
  ".txt",
  ".html",
  ".htm",
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
] as const;

function readText(data: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(data);
}

export async function toMarkdown(
  filename: string,
  data: ArrayBuffer,
): Promise<string> {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot === -1 ? "" : lower.slice(dot);

  if (ext === ".md" || ext === ".txt") {
    return readText(data);
  }

  if (ext === ".html" || ext === ".htm") {
    const { htmlToMarkdown } = await import("./converters/html");
    return htmlToMarkdown(readText(data));
  }

  if (ext === ".pdf") {
    const { pdfToMarkdown } = await import("./converters/pdf");
    return pdfToMarkdown(data);
  }

  if (ext === ".docx") {
    const { docxToMarkdown } = await import("./converters/docx");
    return docxToMarkdown(data);
  }

  if (ext === ".pptx") {
    const { pptxToMarkdown } = await import("./converters/pptx");
    return pptxToMarkdown(data);
  }

  if (ext === ".xlsx") {
    const { xlsxToMarkdown } = await import("./converters/xlsx");
    return xlsxToMarkdown(data);
  }

  throw new ConverterError(
    `Niet-ondersteund bestandsformaat: ${ext || "(geen extensie)"}. ` +
      `Ondersteund: ${ONDERSTEUNDE_EXTENSIES.join(", ")}`,
  );
}
