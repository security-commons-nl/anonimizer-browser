/**
 * Mistral chat-API wrapper. Browser-only — gebruikt fetch.
 *
 * De API-key wordt per call meegegeven, nooit in module-state opgeslagen.
 */
import type { LlmChat } from "./types";

export interface MistralChatOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class LlmError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

/**
 * Maak een chat-functie die naar Mistral praat.
 * Forceert JSON-output via response_format.
 */
export function makeMistralChat(opts: MistralChatOptions): LlmChat {
  const baseUrl = opts.baseUrl ?? "https://api.mistral.ai";
  const model = opts.model ?? "mistral-large-latest";

  return async (messages) => {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new LlmError(
        `Mistral API gaf ${resp.status}: ${text.slice(0, 200)}`,
        resp.status,
      );
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LlmError("Mistral-respons mist message.content");
    }
    return content;
  };
}
