/**
 * Gedeelde PII-fixture: elk geval uit src/lib/fixtures/pii-patronen.json door patronen.ts.
 *
 * De fixture is een byte-identieke KOPIE van de canonieke versie in
 * anonimizer-local/tests/fixtures/pii-patronen.json; de sync-test bewaakt dat met de
 * sha256 in src/lib/fixtures/pii-patronen.sha256. Bijwerken: zie README, kopje
 * "Gedeelde PII-fixture".
 *
 * Waar patronen.ts de norm uit de fixture niet haalt, staat dat expliciet in
 * BEKENDE_AFWIJKINGEN; de fixture wordt niet versoepeld.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { detectPatronen } from "./patronen";
import fixtureRaw from "./fixtures/pii-patronen.json?raw";
import hashRaw from "./fixtures/pii-patronen.sha256?raw";

interface Geval {
  id: string;
  categorie: string;
  tekst: string;
  verwacht: string[];
  toelichting: string;
}

// Categorieen uit de fixture die deze implementatie niet kent. Leeg: patronen.ts is een
// directe port van patronen.py en dekt alle categorieen die de fixture nu bevat.
const NIET_ONDERSTEUND = new Set<string>();

// id -> [gevonden waarden na normalisatie, reden]
const BEKENDE_AFWIJKINGEN: Record<string, [string[], string]> = {
  "bsn-08": [
    ["000000000"],
    "de telefoon-regex (0 plus acht tot tien cijfers) pakt de nullenreeks als telefoonnummer; " +
      "de BSN-uitsluiting zelf werkt wel",
  ],
  "bsn-09": [
    [],
    "de BSN-kandidaat eist negen aaneengesloten cijfers; een gespreid geschreven BSN wordt gemist",
  ],
  "iban-04": [
    ["NL03ABNA0123456789"],
    "geen mod-97-controle, alleen een vormcheck (NL + 2 cijfers + 4 letters + 10 cijfers); " +
      "publicatiescan valideert wel",
  ],
};

const GEVALLEN: Geval[] = (JSON.parse(fixtureRaw) as { gevallen: Geval[] }).gevallen;

/** Spaties en koppeltekens weg, zodat "06-12345678" en "06 12345678" gelijk zijn. */
function norm(waarde: string): string {
  return waarde.replace(/[\s-]/g, "");
}

function gevonden(tekst: string): string[] {
  const { entiteiten } = detectPatronen(tekst);
  return [...new Set(entiteiten.map((e) => norm(e.tekst)))].sort();
}

describe("gedeelde fixture: sync met anonimizer-local", () => {
  it("lokale kopie is byte-identiek aan de vastgelegde sha256", () => {
    const verwacht = hashRaw.trim().split(/\s+/)[0];
    const werkelijk = createHash("sha256").update(fixtureRaw, "utf8").digest("hex");
    expect(
      werkelijk,
      "src/lib/fixtures/pii-patronen.json wijkt af van de vastgelegde hash. Canoniek is " +
        "anonimizer-local/tests/fixtures/pii-patronen.json: kopieer die hierheen en werk " +
        "pii-patronen.sha256 bij (zie README).",
    ).toBe(verwacht);
  });

  it("BEKENDE_AFWIJKINGEN verwijst alleen naar bestaande ids", () => {
    const ids = new Set(GEVALLEN.map((g) => g.id));
    for (const id of Object.keys(BEKENDE_AFWIJKINGEN)) expect(ids.has(id), id).toBe(true);
  });
});

describe("gedeelde fixture: elk geval door patronen.ts", () => {
  for (const geval of GEVALLEN) {
    const naam = `${geval.id}: ${geval.toelichting}`;
    if (NIET_ONDERSTEUND.has(geval.categorie)) {
      it.skip(`${naam} (categorie niet ondersteund)`, () => {});
      continue;
    }
    it(naam, () => {
      const werkelijk = gevonden(geval.tekst);
      const verwacht = [...new Set(geval.verwacht.map(norm))].sort();
      const afwijking = BEKENDE_AFWIJKINGEN[geval.id];
      if (afwijking) {
        const [vastgelegd, reden] = afwijking;
        expect([...vastgelegd].sort(), "afwijking is gelijk aan de norm").not.toEqual(verwacht);
        expect(werkelijk, `bekende afwijking veranderd (${reden})`).toEqual([...vastgelegd].sort());
        return;
      }
      expect(werkelijk, geval.tekst).toEqual(verwacht);
    });
  }
});
