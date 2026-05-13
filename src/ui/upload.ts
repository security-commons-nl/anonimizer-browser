import { detect } from "../lib/detector";
import { apply } from "../lib/replacer";
import { toMarkdown } from "../lib/converter";
import { makeMistralChat, LlmError } from "../lib/llm";
import { parseStandaardYaml } from "./standaard";
import {
  loadApiKey,
  loadStandaard,
  saveApiKey,
  saveStandaard,
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

  root.innerHTML = `
    <div class="card">
      ${errorMsg ? `<div class="error">${escapeHtml(errorMsg)}</div>` : ""}
      <form id="upload-form">
        <label for="bestand">Document</label>
        <input id="bestand" name="bestand" type="file"
               accept=".pdf,.docx,.pptx,.xlsx,.md,.txt,.html,.htm" required />
        <p class="help">PDF, Word, PowerPoint, Excel, Markdown of HTML. Max 50&nbsp;MB.</p>

        <label for="api_key">Mistral API-sleutel</label>
        <input id="api_key" name="api_key" type="password"
               value="${escapeAttr(apiKey)}"
               placeholder="Plak hier je Mistral API-key" autocomplete="off" required />
        <p class="help">
          Wordt alleen bewaard in deze browsersessie en gestuurd naar
          api.mistral.ai. Krijg er een op
          <a href="https://console.mistral.ai/" target="_blank" rel="noopener">console.mistral.ai</a>.
        </p>

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

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fileInput = root.querySelector<HTMLInputElement>("#bestand")!;
    const apiKeyInput = root.querySelector<HTMLInputElement>("#api_key")!;
    const standaardInput = root.querySelector<HTMLTextAreaElement>("#standaard")!;

    const file = fileInput.files?.[0];
    const apiKeyVal = apiKeyInput.value.trim();
    const standaardYaml = standaardInput.value.trim();

    if (!file || !apiKeyVal) {
      handlers.onError("Selecteer een bestand en vul je API-sleutel in.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      handlers.onError("Bestand is groter dan 50 MB.");
      return;
    }

    saveApiKey(apiKeyVal);
    saveStandaard(standaardYaml);

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span>Bezig met verwerken…`;

    try {
      const buffer = await file.arrayBuffer();
      const tekst = await toMarkdown(file.name, buffer);

      const standaardMap = parseStandaardYaml(standaardYaml);
      const chat = makeMistralChat({ apiKey: apiKeyVal });
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
        msg = `Mistral API: ${err.message}`;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      handlers.onError(msg);
      submitBtn.disabled = false;
      submitBtn.textContent = "Document verwerken";
    }
  });
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
