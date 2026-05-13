/**
 * Pas goedgekeurde vervangingen toe op een document.
 *
 * Word-boundary logica: elke key waarvan het eerste én laatste teken een
 * woord-karakter is (letter/cijfer/_) krijgt \b-wrapping. Dat voorkomt
 * dat 'beveiliging' matcht binnen 'informatiebeveiliging' of 'Leiden'
 * binnen 'begeleiden'. Keys die beginnen of eindigen op niet-woord-tekens
 * (bv. '(C)ISO', 'IB-') krijgen geen \b omdat dat regex-semantisch niet
 * betrouwbaar is aan de grens.
 *
 * Post-processing: direct op elkaar volgende lidwoorden ("de de", "het
 * het", "een een") worden gecollapsed. Lijsten van 2+ identieke
 * VOORBEELDGEMEENTE-tokens worden teruggebracht naar 'de betrokken
 * gemeenten'.
 *
 * Port van anonimizer/replacer.py.
 */
import type { Entiteit, Mapping } from "./types";

const WOORD_KARAKTER = /^\w$/;

/** True als de key op een woord-karakter begint én eindigt. */
export function heeftWordGrens(key: string): boolean {
  if (!key) return false;
  return WOORD_KARAKTER.test(key[0]) && WOORD_KARAKTER.test(key[key.length - 1]);
}

const DUBBEL_LIDWOORD = /\b(de|het|een)\s+(?:de|het|een)\s+/gi;

function collapseDubbeleLidwoorden(text: string): string {
  return text.replace(DUBBEL_LIDWOORD, (_match, lidwoord) => `${lidwoord} `);
}

const PLACEHOLDER_LIJST =
  /\bVOORBEELDGEMEENTE(?:(?:\s*,\s*|\s+(?:en|of)\s+)VOORBEELDGEMEENTE)+\b/g;

function collapsePlaceholderLijsten(text: string): string {
  return text.replace(PLACEHOLDER_LIJST, "de betrokken gemeenten");
}

/** Escape regex-special characters in a literal string. */
function regexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMapping(approved: Entiteit[]): Mapping {
  const mapping: Mapping = {};
  for (const e of approved) {
    if (e.tekst) mapping[e.tekst] = e.suggestie;
  }
  return mapping;
}

/**
 * Pas alle vervangingen toe op de tekst.
 *
 * - Langere matches eerst, om partiële vervangingen te voorkomen.
 * - Case-insensitive: 'Leidse regio' matcht 'Leidse Regio'.
 * - Word-boundary voor keys die op woord-karakters beginnen én eindigen.
 * - Post-processing collapst dubbele lidwoorden en placeholder-lijsten.
 */
export function apply(text: string, mapping: Mapping): string {
  const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const origineel of keys) {
    const vervanging = mapping[origineel];
    let patroon = regexEscape(origineel);
    if (heeftWordGrens(origineel)) {
      patroon = `\\b${patroon}\\b`;
    }
    const regex = new RegExp(patroon, "gi");
    // Callback voorkomt dat $-references in de vervanging worden geïnterpreteerd.
    text = text.replace(regex, () => vervanging);
  }
  text = collapsePlaceholderLijsten(text);
  text = collapseDubbeleLidwoorden(text);
  return text;
}
