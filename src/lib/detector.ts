/**
 * Drie-laagse detectie van privacygevoelige en organisatiespecifieke
 * informatie.
 *
 *   1.   standaard.yaml  — org-specifieke always-apply vervangingen
 *   1.5  patronen.ts     — deterministische regex voor gestructureerde IDs
 *   2.   memory.json     — eerder bevestigde vervangingen (browser: leeg)
 *   3.   LLM NER         — namen/organisaties/context via Mistral
 *   3.5  allowlist       — post-filter voor LLM
 *
 * Port van anonimizer/detector.py.
 */
import type { DetectResult, Entiteit, LlmChat, Mapping } from "./types";
import { detectPatronen } from "./patronen";

/**
 * Exacte strings die nooit vervangen mogen worden, ongeacht wat de LLM
 * zegt. Case-insensitive vergelijking.
 */
export const ALLOWLIST = new Set([
  // Rollen/functies als afkorting (niet persoon-specifiek)
  "ciso", "iso", "cio", "fg", "raci",
  // Wetten en standaarden
  "avg", "wpg", "wgbo", "bio", "big", "bsn", "ict", "it", "iban",
  "nta", "nen", "kvk", "wvggz", "ap", "saas", "mdr",
  // Publieke organisaties en diensten
  "ibd", "vng", "ncsc", "autoriteit persoonsgegevens",
  "informatiebeveiligingsdienst",
  "informatiebeveiligingsdienst voor gemeenten",
  "vereniging van nederlandse gemeenten", "rijksoverheid",
  "nationaal cyber security centrum", "agentschap telecom",
  "baseline informatiebeveiliging overheid", "basisregistratie personen",
  // Generieke begrippen / rolcategorieën
  "chief information security officer", "information security officer",
  "functionaris gegevensbescherming",
  "algemene verordening gegevensbescherming",
  "wet op de geneeskundige behandelingsovereenkomst",
  "privacy officer", "data protection officer",
  // Interne calamiteitenteams (algemene termen)
  "ctd", "calamiteitenteam digitaal", "calamiteiten team digitaal",
  // Generieke software/diensten (niet-specifiek)
  "microsoft teams", "outlook", "topdesk", "join", "sharepoint",
  "root cause analysis", "reason for outage", "mermaid",
]);

function inAllowlist(tekst: string): boolean {
  return ALLOWLIST.has(tekst.trim().toLowerCase());
}

export const SYSTEM_PROMPT = `Je bent een expert in het detecteren van privacygevoelige en organisatiespecifieke informatie in Nederlandse documenten van gemeenten en publieke organisaties.

Analyseer de gegeven tekst en identificeer ALLE elementen die vervangen moeten worden voordat het document publiek gedeeld kan worden:

**WEL detecteren:**
- Persoonsnamen — óók losse voornamen (Khalid, Frank), niet-Nederlandse achternamen (Errami, IJzerman), namen met tussenvoegsels (van der Meer, de Vries, 't Hart)
- E-mailadressen, telefoonnummers, postcodes, IP-adressen
- Interne organisatie- en afdelingsnamen, projectcodes
- Externe leveranciers genoemd als klant-partner (bv. "onze MDR-leverancier Arctic Wolf")
- Functietitels gekoppeld aan specifieke personen
- Interne dossier-, zaak- of systeemnummers
- Datums die herleidbaar zijn naar personen of unieke interne events
- Interne URLs en portalen

**NIET detecteren (moeten in het document blijven staan):**
- Formulier- of kolomkoppen zonder concrete waarde: "Naam", "Telefoonnummer", "E-mailadres", "Organisatie", "Geslacht", "Geboortedatum", "Adres"
- Afkortingen uit officiële tabellen: AVG, AP, FG, CISO, ISO, CIO, BIO, BIG, BSN, AVG, Wpg, ICT, RACI, NTA, NEN
- Functietitels in rol-beschrijvingen zónder persoonsnaam ("De CISO is verantwoordelijk voor...")
- Generieke functietitels die al met lidwoord staan ("de directeur", "de griffier", "de leidinggevende", "de budgethouder", "de gemeentearchivaris") — laat staan; niet detecteren
- Artikelverwijzingen binnen het eigen reglement ("artikel 3.1", "artikel 4.2 lid b")
- Publieke normen met hun nummer: NEN 7510, NTA 7516, ISO 27001
- Publieke organisaties/standaarden: IBD, VNG, NCSC, Autoriteit Persoonsgegevens, AP, BIO, BIG, Basisregistratie Personen, Rijksoverheid, Nationaal Cyber Security Centrum
- Generieke software-/methode-namen: Microsoft Teams, Topdesk, JOIN, Sharepoint, Outlook, Root Cause Analysis, Mermaid

**Kritische regel voor suggesties:**
- Je suggestie moet ALTIJD betekenisvol verschillen van het origineel. Als je beste suggestie identiek is aan het origineel (case-insensitive), detecteer het dan NIET.
- Als het origineel al met een lidwoord staat ("de Privacy Officer"), neem dat lidwoord dan NIET opnieuw op in je suggestie.

Geef je antwoord als JSON met deze structuur:
{
  "entiteiten": [
    {
      "tekst": "de exacte tekst zoals die in het document staat",
      "categorie": "persoon|email|telefoon|organisatie|project|locatie|functie|nummer|datum|overig",
      "suggestie": "een neutrale vervangende tekst"
    }
  ]
}

Regels voor suggesties:
- Gebruik de context: "Bas Stevens (CISO)" → suggestie "de CISO"
- Wees consistent: dezelfde entiteit krijgt dezelfde suggestie
- Wees specifiek genoeg: "de afdeling" of "de leverancier" is beter dan "[verwijderd]"
- E-mailadressen → "[e-mailadres verwijderd]"
- Telefoonnummers → "[telefoonnummer verwijderd]"
- Als twijfel tussen persoonsnaam of gewoon woord: als het met hoofdletter staat en grammaticaal als naam functioneert → persoon`;

// Chunk-grootte voor lange documenten. Zorgt dat de LLM niets mist in
// het context-window en dat we niet één gigantische call doen.
export const CHUNK_GROOTTE = 8000;
export const CHUNK_OVERLAP = 400;

export function chunkTekst(
  tekst: string,
  grootte: number = CHUNK_GROOTTE,
  overlap: number = CHUNK_OVERLAP,
): string[] {
  if (tekst.length <= grootte) return [tekst];

  const chunks: string[] = [];
  let start = 0;
  const n = tekst.length;
  while (start < n) {
    let eind = Math.min(start + grootte, n);
    if (eind < n) {
      // Zoek dichtstbijzijnde paragraaf-einde vóór eind
      const laatstePara = tekst.lastIndexOf(
        "\n\n",
        eind,
      );
      if (laatstePara !== -1 && laatstePara >= start + Math.floor(grootte / 2)) {
        eind = laatstePara;
      }
    }
    chunks.push(tekst.slice(start, eind));
    if (eind >= n) break;
    start = Math.max(eind - overlap, start + 1);
  }
  return chunks;
}

async function llmDetectChunk(tekst: string, chat: LlmChat): Promise<Entiteit[]> {
  const response = await chat([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Analyseer deze tekst:\n\n${tekst}` },
  ]);
  try {
    const parsed = JSON.parse(response);
    const entiteiten = parsed?.entiteiten;
    if (!Array.isArray(entiteiten)) return [];
    return entiteiten.filter(
      (e): e is Entiteit =>
        e && typeof e.tekst === "string" && typeof e.suggestie === "string",
    );
  } catch {
    return [];
  }
}

async function llmDetect(tekst: string, chat: LlmChat): Promise<Entiteit[]> {
  const chunks = chunkTekst(tekst);
  const alle: Entiteit[] = [];
  for (const chunk of chunks) {
    const result = await llmDetectChunk(chunk, chat);
    alle.push(...result);
  }

  // Dedupliceer op tekst (eerste vinding wint), filter allowlist.
  const seen = new Set<string>();
  const unique: Entiteit[] = [];
  for (const e of alle) {
    const t = e.tekst.trim();
    if (!t || seen.has(t) || inAllowlist(t)) continue;
    seen.add(t);
    unique.push(e);
  }
  return unique;
}

export interface DetectOpts {
  tekst: string;
  memory?: Entiteit[];
  standaard?: Mapping;
  chat: LlmChat;
}

/**
 * Drie-laagse detectie.
 *
 * Returns:
 *   - autoMapping: {original: replacement} — stille toepassing (laag 1, 1.5, 2)
 *   - newEntities: lijst entiteiten voor interactieve review (laag 3)
 *   - bron: {original: laagnaam} — voor audit/UI-labeling
 */
export async function detect(opts: DetectOpts): Promise<DetectResult> {
  const { tekst, chat, memory = [], standaard = {} } = opts;
  const autoMapping: Mapping = {};
  const bron: Record<string, string> = {};

  // Laag 1: standaard-vervangingen
  for (const [origineel, vervanging] of Object.entries(standaard)) {
    if (tekst.includes(origineel)) {
      autoMapping[origineel] = vervanging;
      bron[origineel] = "standaard";
    }
  }

  // Laag 1.5: deterministische regex-patronen
  const { mapping: patroonMapping } = detectPatronen(tekst);
  for (const [origineel, vervanging] of Object.entries(patroonMapping)) {
    if (!(origineel in autoMapping)) {
      autoMapping[origineel] = vervanging;
      bron[origineel] = "patroon";
    }
  }

  // Laag 2: memory
  for (const item of memory) {
    const t = item.tekst;
    if (t && tekst.includes(t) && !(t in autoMapping)) {
      autoMapping[t] = item.suggestie;
      bron[t] = "geheugen";
    }
  }

  // Laag 3: LLM — alleen als er tekst is
  if (!tekst.trim()) {
    return { autoMapping, newEntities: [], bron };
  }

  const llmEntities = await llmDetect(tekst, chat);
  const known = new Set(Object.keys(autoMapping));
  const newEntities = llmEntities
    .filter((e) => !known.has(e.tekst))
    .map((e) => ({ ...e, bron: "llm" }));

  return { autoMapping, newEntities, bron };
}
