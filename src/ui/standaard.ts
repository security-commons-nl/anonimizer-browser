/**
 * Minimale YAML-parser voor het standaard-vervangingen formulier.
 *
 * Ondersteunt alleen het simpele formaat dat in de UI gebruikt wordt:
 *
 *     vervangingen:
 *       Leiden: VOORBEELDGEMEENTE
 *       "Servicepunt71": "VOORBEELDSAMENWERKING"
 *
 * Of (zonder vervangingen-wrapper) direct key: value paren.
 * Behoeft geen full-fledged YAML library — scheelt 50KB in de bundle.
 */
import type { Mapping } from "../lib/types";

function unquote(s: string): string {
  s = s.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

export function parseStandaardYaml(yaml: string): Mapping {
  const result: Mapping = {};
  const lines = yaml.split(/\r?\n/);
  let insideVervangingen = false;

  for (const rawLine of lines) {
    // Strip line comments
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;

    // "vervangingen:" wrapper detecteren
    if (/^vervangingen\s*:\s*$/.test(line.trim())) {
      insideVervangingen = true;
      continue;
    }

    // key: value formaat
    const m = line.match(/^\s*(.+?)\s*:\s*(.*)$/);
    if (!m) continue;

    // Buiten een 'vervangingen:'-blok blijven we toch parsen — het is
    // OK om dezelfde structuur platgeslagen te accepteren.
    const key = unquote(m[1]);
    const value = unquote(m[2]);
    if (!key || !value) continue;
    if (key === "vervangingen") {
      insideVervangingen = true;
      continue;
    }
    result[key] = value;
  }

  // Als we 'vervangingen:' zagen maar niks oppikten — onverwacht, maar
  // dan is het object gewoon leeg. Geen fout gooien.
  void insideVervangingen;

  return result;
}
