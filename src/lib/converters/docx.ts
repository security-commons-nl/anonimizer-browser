/**
 * DOCX → Markdown via mammoth.js.
 *
 * Mammoth produceert HTML; die conventeren we via onze eigen htmlToMarkdown.
 * Eén pipeline voor HTML én DOCX — minder code-paden om te onderhouden.
 */
import mammoth from "mammoth";
import { htmlToMarkdown } from "./html";

export async function docxToMarkdown(data: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer: data });
  return htmlToMarkdown(result.value).trim();
}
