import { detect } from "../lib/detector";
import { apply } from "../lib/replacer";
import { toMarkdown } from "../lib/converter";
import { makeChat, LlmError } from "../lib/llm";
import { PROXY_URL } from "../lib/config";
import { parseStandaardYaml } from "./standaard";
import {
  loadApiKey,
  loadStandaard,
  loadUseByok,
  saveApiKey,
  saveStandaard,
  saveUseByok,
  type AppState,
} from "./state";

export interface UploadScreenHandlers {
  onComplete: (state: AppState) => void;
  onError: (msg: string) => void;
}

export function renderUpload(
  root: HTMLElement,
  handlers: UploadScreenHandlers,
  errorMsg?: string,
): void {
  const apiKey = loadApiKey();
  const standaard = loadStandaard();
  const useByok = loadUseByok();

  root.innerHTML = `
    <div class="card">
      ${errorMsg ? `<div class="error">${escapeHtml(errorMsg)}</div>` : ""}
      <form id="upload-form">
        <label for="bestand">Document</label>
        <input id="bestand" name="bestand" type="file"
               accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.html,.htm" required />
        <p class="help">PDF, Word, PowerPoint, Excel, Markdown of HTML. Max 50&nbsp;MB.</p>

        <div class="byok-toggle">
          <label class="inline-toggle">
            <input id="use_byok" type="checkbox" ${useByok ? "checked" : ""} />
            <span>Ik wil mijn eigen Mistral API-key gebruiken</span>
          </label>
          <p class="help" id="byok-help">${byokHelpText(useByok)}</p>
        </div>

        <div id="byok-fields" style="${useByok ? "" : "display:none"}">
          <label for="api_key">Mistral API-sleutel</label>
          <input id="api_key" name="api_key" type="password"
                 value="${escapeAttr(apiKey)}"
                 placeholder="Plak hier je Mistral API-key" autocomplete="off" />
          <p class="help">
            Wordt alleen bewaard in deze browsersessie en gestuurd naar
            <code>api.mistral.ai</code>. Krijg er een op
            <a href="https://console.mistral.ai/" target="_blank" rel="noopener">console.mistral.ai</a>.
          </p>
        </div>

        <label for="standaard">Standaard-vervangingen (optioneel, YAML)</label>
        <textarea id="standaard" name="standaard" rows="4"
                  placeholder="vervangingen:&#10;  Leiden: VOORBEELDGEMEENTE">${escapeHtml(standaard)}</textarea>
        <p class="help">
          Worden altijd automatisch toegepast voordat de LLM begint.
          Opgeslagen in deze browser zodat je ze de volgende keer terug ziet.
        </p>

        <div class="button-row">
          <button type="submit" id="submit-btn">Document verwerken</button>
        </div>
      </form>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>("#upload-form")!;
  const submitBtn = root.querySelector<HTMLButtonElement>("#submit-btn")!;
  const byokCheckbox = root.querySelector<HTMLInputElement>("#use_byok")!;
  const byokFields = root.querySelector<HTMLDivElement>("#byok-fields")!;
  const byokHelp = root.querySelector<HTMLParagraphElement>("#byok-help")!;

  byokCheckbox.addEventListener("change", () => {
    const on = byokCheckbox.checked;
    byokFields.style.display = on ? "" : "none";
    byokHelp.textContent = byokHelpText(on);
    saveUseByok(on);
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fileInput = root.querySelector<HTMLInputElement>("#bestand")!;
    const standaardInput = root.querySelector<HTMLTextAreaElement>("#standaard")!;
    const byok = byokCheckbox.checked;

    const file = fileInput.files?.[0];
    const standaardYaml = standaardInput.value.trim();

    if (!file) {
      handlers.onError("Selecteer een bestand.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      handlers.onError("Bestand is groter dan 50 MB.");
      return;
    }

    let apiKeyVal = "";
    if (byok) {
      const apiKeyInput = root.querySelector<HTMLInputElement>("#api_key")!;
      apiKeyVal = apiKeyInput.value.trim();
      if (!apiKeyVal) {
        handlers.onError("Vul je Mistral API-sleutel in of zet de toggle uit.");
        return;
      }
      saveApiKey(apiKeyVal);
    }
    saveStandaard(standaardYaml);

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span>Bezig met verwerken…`;

    try {
      const buffer = await file.arrayBuffer();
      const tekst = await toMarkdown(file.name, buffer);

      const standaardMap = parseStandaardYaml(standaardYaml);
      const chat = byok
        ? makeChat({ mode: "direct", apiKey: apiKeyVal })
        : makeChat({ mode: "proxy", proxyUrl: PROXY_URL });
      const result = await detect({
        tekst,
        standaard: standaardMap,
        chat,
      });

      const tekstNaAuto = apply(tekst, result.autoMapping);

      handlers.onComplete({
        filename: stripExt(file.name),
        tekst: tekstNaAuto,
        autoMapping: result.autoMapping,
        toReview: result.newEntities,
        confirmed: {},
        totaal: result.newEntities.length,
      });
    } catch (err) {
      let msg = "Er ging iets mis bij het verwerken.";
      if (err instanceof LlmError) {
        if (err.status === 429) {
          msg = byok
            ? `Je eigen Mistral-account is rate-limited (429).`
            : `Te veel verzoeken via de gedeelde proxy. Wacht een minuut, of zet "eigen API-key" aan voor onbeperkte toegang.`;
        } else {
          msg = err.message;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      handlers.onError(msg);
      submitBtn.disabled = false;
      submitBtn.textContent = "Document verwerken";
    }
  });
}

function byokHelpText(useByok: boolean): string {
  if (useByok) {
    return "Je documenten gaan via jouw eigen Mistral-account. Geen rate-limit aan onze kant. Eigen kosten.";
  }
  return "Documenten gaan via onze proxy (security-commons-nl) en daarna naar Mistral. Geen account nodig, max 20 verzoeken per minuut per IP.";
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
