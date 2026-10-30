// De lat van het redactiestatuut (C5): versie en peildatum, status en de weg naar de tests staan op de pagina.
// De versie op de pagina is dezelfde als in package.json; wie de ene ophoogt en de andere vergeet, ziet dit rood.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };

describe("de lat op de pagina (statuut C5)", () => {
  it("toont de versie uit package.json met een peildatum", () => {
    const m = html.match(/versie (\d+\.\d+\.\d+) \(peildatum (\d{4}-\d{2}-\d{2})\)/);
    expect(m, "regel 'versie x.y.z (peildatum JJJJ-MM-DD)' ontbreekt").not.toBeNull();
    expect(m![1]).toBe(pkg.version);
  });

  it("toont de status en de weg naar de tests", () => {
    expect(html).toMatch(/status: in gebruik/);
    expect(html).toContain("https://github.com/security-commons-nl/anonimizer-browser/actions/workflows/ci.yml");
  });

  it("begint met een kruimelpad naar de voorpagina (B10)", () => {
    expect(html).toContain('aria-label="Kruimelpad"');
    expect(html).toContain('href="https://security-commons-nl.github.io/"');
  });
});
