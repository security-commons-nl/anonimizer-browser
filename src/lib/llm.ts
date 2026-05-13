/**
 * Mistral chat-API wrapper. Browser-only — gebruikt fetch.
 *
 * Twee paden:
 *   - DIRECT mode: gebruiker brengt eigen Mistral API-key mee (BYOK).
 *     Forward gaat rechtstreeks naar api.mistral.ai.
 *   - PROXY mode: gebruiker heeft geen key. We praten met anonimizer-proxy,
 *     die op zijn beurt naar Mistral praat met een gedeelde key.
 *
 * In PROXY mode stuurt de browser GEEN Authorization-header — de proxy
 * voegt die zelf toe. Dat houdt de gedeelde key bij ons en buiten beeld
 * van de gebruiker.
 */
import type { LlmChat } from "./types";

export type ChatMode =
  | { mode: "direct"; apiKey: string; baseUrl?: string; model?: string }
  | { mode: "proxy"; proxyUrl: string };

export class LlmError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

const DEFAULT_DIRECT_BASE = "https://api.mistral.ai";
const DEFAULT_MODEL = "mistral-large-latest";

export function makeChat(opts: ChatMode): LlmChat {
  return async (messages) => {
    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: Record<string, unknown>;

    if (opts.mode === "direct") {
      const base = opts.baseUrl ?? DEFAULT_DIRECT_BASE;
      url = `${base}/v1/chat/completions`;
      headers["Authorization"] = `Bearer ${opts.apiKey}`;
      body = {
        model: opts.model ?? DEFAULT_MODEL,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
      };
    } else {
      // Proxy mode: alleen messages doorzetten, proxy bepaalt model + auth.
      url = `${opts.proxyUrl}/v1/chat/completions`;
      body = { messages };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      let parsed: { error?: string } | null = null;
      try {
        parsed = JSON.parse(text);
      } catch { /* keep raw */ }
      const detail = parsed?.error ?? text.slice(0, 200);
      throw new LlmError(
        `LLM gaf ${resp.status}${detail ? ": " + detail : ""}`,
        resp.status,
      );
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LlmError("LLM-respons mist message.content");
    }
    return content;
  };
}
