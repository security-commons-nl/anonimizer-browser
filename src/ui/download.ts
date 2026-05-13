import { apply } from "../lib/replacer";
import { zipSync, strToU8 } from "fflate";
import type { AppState } from "./state";

export interface DownloadHandlers {
  onOpnieuw: () => void;
}

export function renderDownload(
  root: HTMLElement,
  state: AppState,
  handlers: DownloadHandlers,
): void {
  const tekstFinaal = apply(state.tekst, state.confirmed);
  const totaalVervangen =
    Object.keys(state.autoMapping).length + Object.keys(state.confirmed).length;

  const filename = state.filename || "document";
  const mdContent = tekstFinaal;
  const htmlContent = buildHtml(filename, tekstFinaal);

  // Bouw zip met fflate (synchrone API, klein)
  const zip = zipSync(
    {
      [`${filename}-anoniem.md`]: strToU8(mdContent),
      [`${filename}-anoniem.html`]: strToU8(htmlContent),
    },
    { level: 6 },
  );
  const blob = new Blob([zip as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);

  root.innerHTML = `
    <div class="card done">
      <h2>Klaar</h2>
      <p>${totaalVervangen} ${totaalVervangen === 1 ? "vervanging" : "vervangingen"} toegepast.</p>
      <div class="button-row" style="justify-content: center;">
        <a id="download-link" href="${url}" download="${escapeAttr(filename)}-anoniem.zip">
          <button type="button">Download ${escapeHtml(filename)}-anoniem.zip</button>
        </a>
        <button id="opnieuw" type="button" class="secondary">Volgend document</button>
      </div>
      <p class="help" style="margin-top: 1rem;">
        Zip bevat <code>${escapeHtml(filename)}-anoniem.md</code> en <code>${escapeHtml(filename)}-anoniem.html</code>.
      </p>
    </div>
  `;

  root.querySelector("#opnieuw")!.addEventListener("click", () => {
    URL.revokeObjectURL(url);
    handlers.onOpnieuw();
  });
}

function buildHtml(filename: string, markdownBody: string): string {
  // Heel simpele markdown → HTML: paragrafen, headers, lists.
  // Geen volwaardige markdown-parser nodig — output is voor lezen, niet
  // voor verdere automatische verwerking.
  const lines = markdownBody.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inPara: string[] = [];

  const flushPara = () => {
    if (inPara.length) {
      out.push(`<p>${escapeHtml(inPara.join(" "))}</p>`);
      inPara = [];
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const level = heading[1].length;
      out.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      flushPara();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeHtml(li[1])}</li>`);
      continue;
    }

    if (!line.trim()) {
      flushPara();
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      continue;
    }

    inPara.push(line);
  }
  flushPara();
  if (inList) out.push("</ul>");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(filename)}-anoniem</title>
<style>
body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 800px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }
h1, h2, h3 { line-height: 1.25; }
ul { padding-left: 1.5em; }
</style>
</head>
<body>
${out.join("\n")}
</body>
</html>`;
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
