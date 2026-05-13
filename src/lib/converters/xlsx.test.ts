import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { xlsxToMarkdown } from "./xlsx";

interface FakeSheet {
  name: string;
  rows: (string | number)[][];
}

async function buildFakeXlsx(sheets: FakeSheet[]): Promise<ArrayBuffer> {
  const zip = new JSZip();

  // sharedStrings: alle unieke strings indexeren
  const stringIndex = new Map<string, number>();
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (typeof cell === "string" && !stringIndex.has(cell)) {
          stringIndex.set(cell, stringIndex.size);
        }
      }
    }
  }
  const sharedStringsXml =
    `<?xml version="1.0"?>\n<sst>` +
    Array.from(stringIndex.keys())
      .map((s) => `<si><t>${escapeXml(s)}</t></si>`)
      .join("") +
    `</sst>`;
  zip.file("xl/sharedStrings.xml", sharedStringsXml);

  // workbook.xml + rels
  const workbookXml =
    `<?xml version="1.0"?>\n<workbook xmlns:r="z"><sheets>` +
    sheets
      .map(
        (s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join("") +
    `</sheets></workbook>`;
  zip.file("xl/workbook.xml", workbookXml);

  const relsXml =
    `<?xml version="1.0"?>\n<Relationships>` +
    sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("") +
    `</Relationships>`;
  zip.file("xl/_rels/workbook.xml.rels", relsXml);

  // Sheet XML met cellen
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const rowsXml: string[] = [];
    for (let r = 0; r < sheet.rows.length; r++) {
      const rowNum = r + 1;
      const cells: string[] = [];
      for (let c = 0; c < sheet.rows[r].length; c++) {
        const cell = sheet.rows[r][c];
        const ref = `${colIndexToLetter(c + 1)}${rowNum}`;
        if (typeof cell === "string") {
          const idx = stringIndex.get(cell)!;
          cells.push(`<c r="${ref}" t="s"><v>${idx}</v></c>`);
        } else {
          cells.push(`<c r="${ref}"><v>${cell}</v></c>`);
        }
      }
      rowsXml.push(`<row r="${rowNum}">${cells.join("")}</row>`);
    }
    zip.file(
      `xl/worksheets/sheet${i + 1}.xml`,
      `<?xml version="1.0"?>\n<worksheet><sheetData>${rowsXml.join("")}</sheetData></worksheet>`,
    );
  }

  return await zip.generateAsync({ type: "arraybuffer" });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function colIndexToLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

describe("xlsxToMarkdown", () => {
  it("extraheert een eenvoudige tabel met sheet-naam", async () => {
    const buf = await buildFakeXlsx([
      {
        name: "Medewerkers",
        rows: [
          ["Naam", "Functie"],
          ["Jan Jansen", "CISO"],
          ["Piet Pietersen", "ISO"],
        ],
      },
    ]);
    const md = await xlsxToMarkdown(buf);
    expect(md).toContain("## Medewerkers");
    expect(md).toContain("| Naam | Functie |");
    expect(md).toContain("| Jan Jansen | CISO |");
    expect(md).toContain("| Piet Pietersen | ISO |");
  });

  it("voegt header-separator toe na eerste rij", async () => {
    const buf = await buildFakeXlsx([
      { name: "S", rows: [["a", "b"], ["1", "2"]] },
    ]);
    const md = await xlsxToMarkdown(buf);
    expect(md).toContain("| --- | --- |");
  });

  it("verwerkt meerdere sheets", async () => {
    const buf = await buildFakeXlsx([
      { name: "Sheet1", rows: [["A"]] },
      { name: "Sheet2", rows: [["B"]] },
    ]);
    const md = await xlsxToMarkdown(buf);
    expect(md).toContain("## Sheet1");
    expect(md).toContain("## Sheet2");
  });

  it("verwerkt numerieke waarden", async () => {
    const buf = await buildFakeXlsx([
      { name: "Cijfers", rows: [["Score", 42]] },
    ]);
    const md = await xlsxToMarkdown(buf);
    expect(md).toContain("42");
  });

  it("escape pipe-karakters in cellen", async () => {
    const buf = await buildFakeXlsx([
      { name: "Pipes", rows: [["a|b"]] },
    ]);
    const md = await xlsxToMarkdown(buf);
    expect(md).toContain("a\\|b");
  });

  it("gooit fout bij lege XLSX (geen sheets)", async () => {
    const zip = new JSZip();
    zip.file("README.txt", "geen xlsx");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(xlsxToMarkdown(buf)).rejects.toThrow(/Geen sheets/);
  });
});
