/**
 * Deterministische regex-detectie voor gestructureerde identifiers.
 *
 * Laag 1.5 in de detect-pipeline — draait tussen standaard-vervangingen
 * en de LLM. LLMs zijn onbetrouwbaar voor deze patronen; regex geeft
 * 100% recall met nul false positives als de patterns goed verankerd zijn.
 *
 * Port van anonimizer/patronen.py.
 */
import type { Entiteit, Mapping } from "./types";

// E-mail: RFC-5322 light, genoeg voor documenttekst.
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// NL-telefoon: +31 of 0 prefix, gevolgd door 8-10 cijfers met optionele
// spaties of koppeltekens. Negative lookbehind/ahead op \w voorkomt
// matches binnen langere cijferreeksen (IBAN, BSN) en in versie/datum-
// notaties zoals "v1.0 0.5".
const TELEFOON = /(?<!\w)(?:\+31[\s-]?\(?0?\)?|0)(?:[\s-]?\d){8,10}(?!\w)/g;

// NL-postcode: 1234 AB (optionele spatie). Hoofdletters verplicht.
const POSTCODE = /\b[1-9]\d{3}\s?[A-Z]{2}\b/g;

// IPv4: geldige octetten, met extra eis dat minstens één octet ≥100
// om hoofdstuk-/versienummers ("14.2.7.1", "1.2.3.4") uit te filteren.
const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(
  `(?<!\\d\\.)\\b(?=${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\b)` +
    `(?=(?:\\d+\\.){0,3}[12]\\d{2})` +
    `${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\b`,
  "g",
);

// KVK: 8-cijferig, vaak voorafgegaan door "KVK" of "kvk-nummer".
const KVK = /\bKVK[\s:]*(\d{8})\b/gi;

// FG-nummer (AP-register): FG gevolgd door 6 cijfers.
const FG_NUMMER = /\bFG[\s:]*(\d{6})\b/g;

// IBAN NL: NL + 2 cijfers + 4 letters + 10 cijfers (met optionele spaties per 4).
const IBAN_NL = /\bNL\d{2}\s?[A-Z]{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/g;

// BSN-kandidaat: 9 cijfers, niet ingebed in langere cijferreeks.
const BSN_KANDIDAAT = /(?<!\d)(\d{9})(?!\d)/g;

/** 11-proef voor BSN: som van cijfer*gewicht moet deelbaar door 11 zijn. */
export function isGeldigBsn(nummer: string): boolean {
  if (nummer.length !== 9 || !/^\d{9}$/.test(nummer)) return false;
  if (nummer === "000000000") return false;
  const gewichten = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let totaal = 0;
  for (let i = 0; i < 9; i++) {
    totaal += Number.parseInt(nummer[i], 10) * gewichten[i];
  }
  return totaal % 11 === 0;
}

interface PatroonDetector {
  naam: string;
  patroon: RegExp;
  categorie: string;
  vervanging: string;
  /** Wanneer aanwezig: valideert de eerste capture-group (of de hele match). */
  validator?: (matchOrGroup1: string) => boolean;
}

// Volgorde: meest-specifieke patronen eerst om overlap te winnen.
// IBAN vóór telefoon (IBAN-staart zou anders als telefoon matchen).
// Email vóór alles (unieke @-anker).
const PATROON_DETECTORS: PatroonDetector[] = [
  { naam: "email", patroon: EMAIL, categorie: "email", vervanging: "[e-mailadres verwijderd]" },
  { naam: "iban", patroon: IBAN_NL, categorie: "nummer", vervanging: "[IBAN verwijderd]" },
  { naam: "kvk", patroon: KVK, categorie: "nummer", vervanging: "[KVK-nummer verwijderd]" },
  { naam: "fg", patroon: FG_NUMMER, categorie: "nummer", vervanging: "[FG-nummer verwijderd]" },
  {
    naam: "bsn",
    patroon: BSN_KANDIDAAT,
    categorie: "nummer",
    vervanging: "[BSN verwijderd]",
    validator: isGeldigBsn,
  },
  { naam: "postcode", patroon: POSTCODE, categorie: "locatie", vervanging: "[postcode verwijderd]" },
  { naam: "ipv4", patroon: IPV4, categorie: "nummer", vervanging: "[IP-adres verwijderd]" },
  { naam: "telefoon", patroon: TELEFOON, categorie: "telefoon", vervanging: "[telefoonnummer verwijderd]" },
];

export interface DetectPatronenResult {
  mapping: Mapping;
  entiteiten: Entiteit[];
}

/**
 * Vind alle deterministische patronen in tekst.
 *
 * Matches van eerder in PATROON_DETECTORS hebben voorrang — overlappende
 * latere matches (bv. het cijfer-deel van een IBAN dat als telefoon zou
 * kunnen worden herkend) worden genegeerd.
 */
export function detectPatronen(tekst: string): DetectPatronenResult {
  const mapping: Mapping = {};
  const entiteiten: Entiteit[] = [];
  const bezetteRanges: [number, number][] = [];

  const overlapt = (start: number, end: number): boolean =>
    bezetteRanges.some(([s, e]) => start < e && end > s);

  for (const { naam, patroon, categorie, vervanging, validator } of PATROON_DETECTORS) {
    // Reset lastIndex omdat we de regex hergebruiken (global flag).
    patroon.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = patroon.exec(tekst)) !== null) {
      const origineel = match[0];
      const start = match.index;
      const end = start + origineel.length;

      if (overlapt(start, end)) continue;

      if (validator) {
        const target = match[1] ?? origineel;
        if (!validator(target)) continue;
      }

      bezetteRanges.push([start, end]);

      if (origineel in mapping) continue;

      mapping[origineel] = vervanging;
      entiteiten.push({
        tekst: origineel,
        categorie,
        suggestie: vervanging,
        bron: `patroon:${naam}`,
      });
    }
  }

  return { mapping, entiteiten };
}
