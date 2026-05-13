# anonimizer-browser

> Verwijder persoonsgegevens uit documenten — volledig in je browser, geen server.

[![Bijdragen](https://img.shields.io/badge/📝_Bijdragen-238636?style=for-the-badge)](../../issues/new/choose)&nbsp;&nbsp;&nbsp;&nbsp;[![Meepraten](https://img.shields.io/badge/💬_Meepraten-0969da?style=for-the-badge)](../../discussions)

Browser-only versie van de [anonimizer](https://github.com/security-commons-nl/anonimizer). Documenten worden volledig in de browser van de gebruiker verwerkt — geen server, geen upload, geen logging. Alleen de tekst voor entiteit-detectie wordt naar Mistral gestuurd (rechtstreeks vanuit de browser, met de eigen API-key van de gebruiker).

**Online:** https://security-commons-nl.github.io/anonimizer-browser/

---

## Waarom een browser-versie?

De oorspronkelijke `anonimizer-web` is een Flask-app die je lokaal moet draaien (Docker, port forwarding, env-vars). Dat werkt voor CISO's die comfortabel zijn met een terminal, maar verhoogt de drempel voor beleidsmedewerkers die "even één document" willen anonimiseren.

Deze versie:

- Draait volledig in de browser — geen installatie
- Documenten verlaten de browser nooit (behalve naar Mistral voor detectie)
- Geen server, dus geen verwerkersverantwoordelijkheid voor de host
- Open source en hosted op GitHub Pages

---

## Wat het doet

1. Upload een document (PDF, Word, PowerPoint, Excel, Markdown of HTML)
2. Het document wordt in de browser omgezet naar markdown
3. Drie-laagse entiteit-detectie:
   - **Laag 1**: standaard-vervangingen die jij hebt ingesteld (bijv. je gemeentenaam)
   - **Laag 1.5**: regex-patronen voor e-mail / telefoon / BSN / IBAN / IP / postcode / KVK
   - **Laag 2**: jouw eerder bevestigde vervangingen (browser localStorage, optioneel)
   - **Laag 3**: Mistral LLM voor namen / organisaties / context
4. Je bevestigt of past per LLM-detectie de vervanging aan
5. Download het geanonimiseerde document als `.md` + `.html` in een zip

---

## Privacy & veiligheid

| Aspect | Hoe is het opgelost |
|---|---|
| Document-inhoud | Blijft volledig in je browser. Wordt niet geüpload naar enige server (behalve naar Mistral voor de detectie-stap). |
| Mistral API-key | Bewaard in `sessionStorage` van je browser — wordt gewist zodra de tab sluit. Wordt nooit naar onze GitHub Pages host gestuurd; gaat rechtstreeks van je browser naar `api.mistral.ai`. |
| Standaard-vervangingen | Bewaard in `localStorage` zodat ze tussen sessies blijven bestaan. Lokaal bij jou. |
| LLM-host | Mistral EU (Frankrijk). Documenttekst wordt versleuteld over HTTPS verstuurd. |
| Cookies / tracking | Geen. |
| Logging | Onze host (GitHub Pages) ziet alleen page-views, geen documentinhoud. |

---

## Lokaal draaien

```bash
npm install
npm run dev
```

Open http://localhost:5173.

---

## Tests

```bash
npm test          # eenmalig
npm run test:watch
npm run coverage
```

Op het moment van schrijven: **82 tests** dekken patronen, replacer, detector, converters (HTML/PPTX/XLSX) en het YAML-parsertje.

---

## Bouwen voor productie

```bash
npm run build
```

Output staat in `dist/`. Voor GitHub Pages: `GITHUB_PAGES=1 npm run build` zet de basepath goed.

---

## Architectuur

```
src/
  lib/
    types.ts                — gedeelde typen
    patronen.ts             — laag 1.5: regex-detectoren (email, BSN met 11-proef, IBAN, etc.)
    replacer.ts             — word-boundary vervanging + lidwoord-collapse
    detector.ts             — drie-laagse detect-pipeline
    llm.ts                  — Mistral fetch-wrapper
    converter.ts            — dispatcher: bestand → markdown
    converters/
      html.ts               — HTML → markdown via DOMParser
      pdf.ts                — PDF → markdown via pdfjs-dist
      docx.ts               — DOCX → HTML → markdown via mammoth
      pptx.ts               — PPTX → markdown via JSZip + XML traversal
      xlsx.ts               — XLSX → markdown via JSZip + XML traversal
  ui/
    state.ts                — AppState + storage helpers
    standaard.ts            — kleine YAML-parser voor het formulier
    upload.ts               — upload-scherm
    review.ts               — review-loop per entiteit
    download.ts             — zip met md + html bouwen
  main.ts                   — boot + screen-routing
```

De drie kernmodules (`patronen.ts`, `replacer.ts`, `detector.ts`) zijn directe ports van de Python-CLI in [`security-commons-nl/anonimizer`](https://github.com/security-commons-nl/anonimizer). Bij wijzigingen in de Python-versie: zorg dat de TypeScript-versie meegaat.

---

## Bijdragen

Zie [CONTRIBUTING.md](CONTRIBUTING.md) als die er is, anders open gerust een issue of discussion.

---

## Principes

Dit project volgt de [architectuur- en communityprincipes](https://github.com/security-commons-nl/.github/blob/main/PRINCIPLES.md) van security-commons-nl: EU-soevereiniteit, AI altijd adviserend, auditbaarheid by design, least privilege en open source als standaard.

---

## Licentie

EUPL-1.2 — zie [LICENSE](LICENSE).
