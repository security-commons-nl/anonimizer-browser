/**
 * PDF → Markdown. Gebruikt pdfjs-dist (Mozilla, runs in browser).
 *
 * Geen layout-preservatie — alleen tekst, in lees-volgorde per pagina.
 * Voor documenten met complexe layout (kolommen, tabellen) kan handmatige
 * nabewerking nodig zijn.
 */
import * as pdfjs from "pdfjs-dist";
// Worker-script wordt door Vite gebundeld via deze import-URL.
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export async function pdfToMarkdown(data: ArrayBuffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let lineY: number | null = null;
    let lineBuf: string[] = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = (item as { transform: number[] }).transform[5];
      const txt = (item as { str: string }).str;

      if (lineY === null || Math.abs(y - lineY) < 2) {
        lineBuf.push(txt);
        lineY = y;
      } else {
        lines.push(lineBuf.join(" ").trim());
        lineBuf = [txt];
        lineY = y;
      }
    }
    if (lineBuf.length) lines.push(lineBuf.join(" ").trim());

    pages.push(lines.filter((l) => l).join("\n"));
  }

  return pages.join("\n\n").trim();
}
