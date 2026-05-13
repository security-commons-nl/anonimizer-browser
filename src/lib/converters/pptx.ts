/**
 * PPTX → Markdown.
 *
 * Een .pptx is een ZIP met XML-files per slide onder `ppt/slides/slideN.xml`.
 * Per slide pakken we alle <a:t>-elementen (drawing-text) op, in document-
 * volgorde. Geen layout-preservatie, maar wel volledige tekst-extractie.
 *
 * Genoeg voor anonimisatie-doeleinden: de detector leest tekst, niet vorm.
 */
import JSZip from "jszip";

function extractTextNodes(xml: string): string[] {
  // Match <a:t>...</a:t> inclusief eventuele attributen op de open-tag.
  // Geen HTML entity decoding nodig — alle bekende entities die hier
  // voorkomen (&amp; &lt; &gt; &quot; &apos;) worden hieronder vertaald.
  const matches = xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
  const out: string[] = [];
  for (const m of matches) {
    out.push(decodeXmlEntities(m[1]));
  }
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function pptxToMarkdown(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  // Verzamel slide-bestanden en sorteer numeriek (slide1, slide2, slide10).
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/slide(\d+)/)![1], 10);
      const nb = Number.parseInt(b.match(/slide(\d+)/)![1], 10);
      return na - nb;
    });

  if (slidePaths.length === 0) {
    throw new Error("Geen slides gevonden in PPTX-bestand.");
  }

  const sections: string[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const xml = await zip.files[slidePaths[i]].async("string");
    const teksten = extractTextNodes(xml);
    const inhoud = teksten.filter((t) => t.trim()).join("\n");
    sections.push(`## Slide ${i + 1}\n\n${inhoud}`);
  }

  return sections.join("\n\n").trim();
}
