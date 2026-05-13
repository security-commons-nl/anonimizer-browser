import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { pptxToMarkdown } from "./pptx";

async function buildFakePptx(
  slides: { text: string[] }[],
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (let i = 0; i < slides.length; i++) {
    const runs = slides[i].text
      .map((t) => `<a:r><a:t>${escapeXml(t)}</a:t></a:r>`)
      .join("");
    const xml = `<?xml version="1.0"?>
<p:sld xmlns:p="x" xmlns:a="y">
  <p:cSld><p:spTree>
    <p:sp><p:txBody>${runs}</p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
  }
  return await zip.generateAsync({ type: "arraybuffer" });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

describe("pptxToMarkdown", () => {
  it("extraheert tekst per slide", async () => {
    const buf = await buildFakePptx([
      { text: ["Titel slide 1", "Bullet 1", "Bullet 2"] },
      { text: ["Titel slide 2", "Inhoud"] },
    ]);
    const md = await pptxToMarkdown(buf);
    expect(md).toContain("## Slide 1");
    expect(md).toContain("Titel slide 1");
    expect(md).toContain("Bullet 1");
    expect(md).toContain("## Slide 2");
    expect(md).toContain("Titel slide 2");
  });

  it("sorteert slides numeriek (slide10 na slide9)", async () => {
    const zip = new JSZip();
    for (const n of [9, 10, 1]) {
      zip.file(
        `ppt/slides/slide${n}.xml`,
        `<p:sld xmlns:a="y"><a:t>Slide${n}</a:t></p:sld>`,
      );
    }
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const md = await pptxToMarkdown(buf);
    const idx1 = md.indexOf("Slide1");
    const idx9 = md.indexOf("Slide9");
    const idx10 = md.indexOf("Slide10");
    expect(idx1).toBeLessThan(idx9);
    expect(idx9).toBeLessThan(idx10);
  });

  it("decode XML-entities in tekst", async () => {
    const buf = await buildFakePptx([{ text: ["Pers & Politiek"] }]);
    const md = await pptxToMarkdown(buf);
    expect(md).toContain("Pers & Politiek");
  });

  it("gooit fout bij lege PPTX (geen slides)", async () => {
    const zip = new JSZip();
    zip.file("README.txt", "geen pptx");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(pptxToMarkdown(buf)).rejects.toThrow(/Geen slides/);
  });
});
