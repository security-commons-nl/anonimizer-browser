/**
 * HTML → Markdown conversie. Gebruikt de native DOMParser van de browser.
 *
 * In tests draait dit op happy-dom (zie vitest.config.ts) — dezelfde API.
 *
 * Port van anonimizer/converter.py HTMLToMarkdown.
 */

const HEADING_LEVEL: Record<string, string> = {
  h1: "#",
  h2: "##",
  h3: "###",
  h4: "####",
  h5: "#####",
  h6: "######",
};
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "tr",
]);
const SKIP_TAGS = new Set(["script", "style", "nav", "head"]);

function walk(node: Node, out: string[]): void {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    out.push((node as Text).data);
    return;
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (SKIP_TAGS.has(tag)) return;

  if (tag in HEADING_LEVEL) {
    out.push(`\n${HEADING_LEVEL[tag]} `);
    for (const child of Array.from(el.childNodes)) walk(child, out);
    out.push("\n");
    return;
  }

  if (tag === "br") {
    out.push("\n");
    return;
  }

  if (tag === "b" || tag === "strong") {
    out.push("**");
    for (const child of Array.from(el.childNodes)) walk(child, out);
    out.push("**");
    return;
  }

  if (tag === "i" || tag === "em") {
    out.push("_");
    for (const child of Array.from(el.childNodes)) walk(child, out);
    out.push("_");
    return;
  }

  if (tag === "li") {
    out.push("\n- ");
    for (const child of Array.from(el.childNodes)) walk(child, out);
    return;
  }

  if (tag === "pre") {
    out.push("\n```\n");
    for (const child of Array.from(el.childNodes)) walk(child, out);
    out.push("\n```\n");
    return;
  }

  if (BLOCK_TAGS.has(tag)) {
    out.push("\n");
    for (const child of Array.from(el.childNodes)) walk(child, out);
    out.push("\n");
    return;
  }

  // Default: gewoon doorlopen
  for (const child of Array.from(el.childNodes)) walk(child, out);
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  walk(doc.body, out);
  let md = out.join("");
  // Collapse 3+ newlines to 2
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}
