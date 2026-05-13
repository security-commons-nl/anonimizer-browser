import type { AppState } from "./state";

export interface ReviewHandlers {
  /** Bevestig de huidige entiteit met optioneel aangepaste vervanging. */
  onBevestig: (vervanging: string) => void;
  /** Sla deze entiteit over — niets vervangen. */
  onOverslaan: () => void;
  /** Stop met reviewen, ga direct naar download. */
  onStop: () => void;
}

const CONTEXT_RADIUS = 120;

export function renderReview(
  root: HTMLElement,
  state: AppState,
  handlers: ReviewHandlers,
): void {
  if (state.toReview.length === 0) {
    handlers.onStop();
    return;
  }

  const huidige = state.toReview[0];
  const index = state.totaal - state.toReview.length + 1;
  const autoCount = Object.keys(state.autoMapping).length;

  root.innerHTML = `
    <div class="card">
      ${
        autoCount > 0
          ? `<div class="auto-summary">${autoCount} ${autoCount === 1 ? "match" : "matches"} automatisch toegepast (laag 1, 1.5 of geheugen).</div>`
          : ""
      }
      <div class="review-header">
        <span class="entity-categorie">${escapeHtml(huidige.categorie)}</span>
        <span class="review-progress">${index} van ${state.totaal}</span>
      </div>
      <div class="entity-tekst">${escapeHtml(huidige.tekst)}</div>
      <div class="context">${renderContext(state.tekst, huidige.tekst)}</div>

      <label for="vervanging">Vervangen door</label>
      <input id="vervanging" type="text" value="${escapeAttr(huidige.suggestie)}" />

      <div class="button-row">
        <button id="btn-bevestig" type="button">Vervang</button>
        <button id="btn-overslaan" type="button" class="secondary">Overslaan</button>
        <button id="btn-stop" type="button" class="danger">Stop &amp; download</button>
      </div>
    </div>
  `;

  const vervangingInput = root.querySelector<HTMLInputElement>("#vervanging")!;
  vervangingInput.focus();
  vervangingInput.select();

  root.querySelector("#btn-bevestig")!.addEventListener("click", () => {
    handlers.onBevestig(vervangingInput.value.trim() || huidige.suggestie);
  });
  root.querySelector("#btn-overslaan")!.addEventListener("click", handlers.onOverslaan);
  root.querySelector("#btn-stop")!.addEventListener("click", handlers.onStop);

  vervangingInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      handlers.onBevestig(vervangingInput.value.trim() || huidige.suggestie);
    }
  });
}

function renderContext(tekst: string, target: string): string {
  const idx = tekst.indexOf(target);
  if (idx === -1) {
    // Niet gevonden — toon de eerste 240 karakters als fallback context.
    return escapeHtml(tekst.slice(0, 240)) + (tekst.length > 240 ? "…" : "");
  }
  const start = Math.max(0, idx - CONTEXT_RADIUS);
  const end = Math.min(tekst.length, idx + target.length + CONTEXT_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < tekst.length ? "…" : "";
  const before = escapeHtml(tekst.slice(start, idx));
  const match = escapeHtml(tekst.slice(idx, idx + target.length));
  const after = escapeHtml(tekst.slice(idx + target.length, end));
  return `${prefix}${before}<mark>${match}</mark>${after}${suffix}`;
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
