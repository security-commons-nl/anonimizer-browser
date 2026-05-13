/**
 * XLSX → Markdown.
 *
 * Een .xlsx is een ZIP met:
 *   - xl/sharedStrings.xml — alle string-waarden (cellen verwijzen via index)
 *   - xl/worksheets/sheetN.xml — celdata per sheet
 *   - xl/workbook.xml — sheet-namen en volgorde
 *
 * We extraheren rijen als markdown-tabellen per sheet. Genoeg voor
 * anonimisatie: de detector leest waarden, niet formatting/formulas.
 */
import JSZip from "jszip";

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const result: string[] = [];
  // <si> kan meerdere <t>-elementen bevatten (rich text). We concatten ze.
  const siMatches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g);
  for (const si of siMatches) {
    const tMatches = si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g);
    let combined = "";
    for (const t of tMatches) combined += decodeXmlEntities(t[1]);
    result.push(combined);
  }
  return result;
}

interface Cell {
  ref: string;
  col: number;
  row: number;
  value: string;
}

/** Excel column letter (A, B, ..., AA) → 1-based column index. */
function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const c of letters) {
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return n;
}

function parseCellRef(ref: string): { col: number; row: number } {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return { col: 0, row: 0 };
  return { col: colLetterToIndex(m[1]), row: Number.parseInt(m[2], 10) };
}

function parseSheet(xml: string, sharedStrings: string[]): Cell[] {
  const cells: Cell[] = [];
  const cMatches = xml.matchAll(
    /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
  );
  for (const m of cMatches) {
    const attrs = m[1];
    const inner = m[2] ?? "";
    const refMatch = attrs.match(/r="([^"]+)"/);
    if (!refMatch) continue;
    const tMatch = attrs.match(/t="([^"]+)"/);
    const type = tMatch?.[1] ?? "n";

    let value = "";
    const valMatch = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
    if (valMatch) {
      const raw = decodeXmlEntities(valMatch[1]);
      if (type === "s") {
        const idx = Number.parseInt(raw, 10);
        value = sharedStrings[idx] ?? "";
      } else {
        value = raw;
      }
    } else if (type === "inlineStr") {
      const isMatch = inner.match(/<is>([\s\S]*?)<\/is>/);
      if (isMatch) {
        const tIn = isMatch[1].match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (tIn) value = decodeXmlEntities(tIn[1]);
      }
    }

    if (value === "") continue;

    const { col, row } = parseCellRef(refMatch[1]);
    cells.push({ ref: refMatch[1], col, row, value });
  }
  return cells;
}

function buildTable(cells: Cell[]): string {
  if (cells.length === 0) return "";

  const maxCol = Math.max(...cells.map((c) => c.col));
  const rows = new Map<number, Map<number, string>>();
  for (const c of cells) {
    if (!rows.has(c.row)) rows.set(c.row, new Map());
    rows.get(c.row)!.set(c.col, c.value);
  }

  const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b);
  const lines: string[] = [];

  for (let i = 0; i < sortedRowKeys.length; i++) {
    const rowNum = sortedRowKeys[i];
    const cols = rows.get(rowNum)!;
    const cells: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      cells.push((cols.get(c) ?? "").replace(/\|/g, "\\|"));
    }
    lines.push(`| ${cells.join(" | ")} |`);

    // Markdown-tabel-header-separator na de eerste rij
    if (i === 0) {
      lines.push(`| ${Array(maxCol).fill("---").join(" | ")} |`);
    }
  }

  return lines.join("\n");
}

function parseWorkbookSheets(
  xml: string | undefined,
): { name: string; rId: string }[] {
  if (!xml) return [];
  const result: { name: string; rId: string }[] = [];
  const matches = xml.matchAll(/<sheet\b([^>]*?)\/?>/g);
  for (const m of matches) {
    const attrs = m[1];
    const name = attrs.match(/name="([^"]+)"/)?.[1] ?? "Sheet";
    const rId =
      attrs.match(/r:id="([^"]+)"/)?.[1] ??
      attrs.match(/relationships:id="([^"]+)"/)?.[1] ??
      "";
    result.push({ name, rId });
  }
  return result;
}

function parseRelationships(
  xml: string | undefined,
): Record<string, string> {
  if (!xml) return {};
  const result: Record<string, string> = {};
  const matches = xml.matchAll(/<Relationship\b([^>]*?)\/?>/g);
  for (const m of matches) {
    const id = m[1].match(/Id="([^"]+)"/)?.[1];
    const target = m[1].match(/Target="([^"]+)"/)?.[1];
    if (id && target) result[id] = target;
  }
  return result;
}

export async function xlsxToMarkdown(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);

  const sharedStringsXml = await zip.files["xl/sharedStrings.xml"]?.async("string");
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  const workbookXml = await zip.files["xl/workbook.xml"]?.async("string");
  const sheets = parseWorkbookSheets(workbookXml);

  const relsXml = await zip.files["xl/_rels/workbook.xml.rels"]?.async("string");
  const rels = parseRelationships(relsXml);

  const sections: string[] = [];
  for (const sheet of sheets) {
    const target = rels[sheet.rId];
    if (!target) continue;
    // Target is meestal "worksheets/sheet1.xml" — relatief aan xl/
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const sheetXml = await zip.files[path]?.async("string");
    if (!sheetXml) continue;
    const cells = parseSheet(sheetXml, sharedStrings);
    const table = buildTable(cells);
    sections.push(`## ${sheet.name}\n\n${table}`);
  }

  if (sections.length === 0) {
    throw new Error("Geen sheets gevonden in XLSX-bestand.");
  }

  return sections.join("\n\n").trim();
}
