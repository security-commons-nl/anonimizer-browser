import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./html";

describe("htmlToMarkdown", () => {
  it("converteert h1-h6 naar # tot ######", () => {
    expect(htmlToMarkdown("<h1>Titel</h1>")).toContain("# Titel");
    expect(htmlToMarkdown("<h3>Subkop</h3>")).toContain("### Subkop");
  });

  it("converteert bold en italic", () => {
    expect(htmlToMarkdown("<p>Iets <b>vet</b> en <i>schuin</i>.</p>"))
      .toContain("**vet**");
  });

  it("converteert lijsten", () => {
    const md = htmlToMarkdown("<ul><li>een</li><li>twee</li></ul>");
    expect(md).toContain("- een");
    expect(md).toContain("- twee");
  });

  it("negeert script en style tags", () => {
    const md = htmlToMarkdown(
      "<p>zichtbaar</p><script>alert('x')</script><style>p{color:red}</style>",
    );
    expect(md).toContain("zichtbaar");
    expect(md).not.toContain("alert");
    expect(md).not.toContain("color:red");
  });

  it("collapst meerdere lege regels", () => {
    const md = htmlToMarkdown("<p>a</p><p></p><p></p><p>b</p>");
    expect(md).not.toMatch(/\n{3}/);
  });
});

import { toMarkdown } from "../converter";

describe("toMarkdown — extensies dispatch", () => {
  it("leest .md als plain text", async () => {
    const data = new TextEncoder().encode("# Een titel\n\nMet inhoud.");
    const r = await toMarkdown("test.md", data.buffer);
    expect(r).toContain("# Een titel");
  });

  it("leest .txt als plain text", async () => {
    const data = new TextEncoder().encode("Plain content.");
    const r = await toMarkdown("notes.txt", data.buffer);
    expect(r).toContain("Plain content.");
  });

  it("dispatcht .html naar HTML converter", async () => {
    const data = new TextEncoder().encode("<h1>Test</h1>");
    const r = await toMarkdown("page.html", data.buffer);
    expect(r).toContain("# Test");
  });

  it("gooit fout op onbekende extensie", async () => {
    const data = new TextEncoder().encode("data");
    await expect(toMarkdown("file.xyz", data.buffer)).rejects.toThrow(
      /Niet-ondersteund/,
    );
  });

  it("gooit fout op bestand zonder extensie", async () => {
    const data = new TextEncoder().encode("data");
    await expect(toMarkdown("README", data.buffer)).rejects.toThrow(
      /Niet-ondersteund/,
    );
  });
});
