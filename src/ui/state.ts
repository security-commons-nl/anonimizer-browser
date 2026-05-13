import type { Entiteit, Mapping } from "../lib/types";

export interface AppState {
  filename: string;
  /** Originele tekst na document → markdown conversie. */
  tekst: string;
  /** Auto-toegepaste vervangingen (laag 1, 1.5, 2). */
  autoMapping: Mapping;
  /** Door de LLM gedetecteerde entiteiten die handmatige review vereisen. */
  toReview: Entiteit[];
  /** Door de gebruiker bevestigde of aangepaste vervangingen. */
  confirmed: Mapping;
  /** Totaal voor voortgangsbalk. */
  totaal: number;
}

export function emptyState(): AppState {
  return {
    filename: "",
    tekst: "",
    autoMapping: {},
    toReview: [],
    confirmed: {},
    totaal: 0,
  };
}

const API_KEY_STORAGE_KEY = "anonimizer.apiKey";

/** API-key blijft in sessionStorage — verdwijnt zodra de tab dichtgaat. */
export function loadApiKey(): string {
  try {
    return sessionStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(API_KEY_STORAGE_KEY, key);
    else sessionStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // noop — sessionStorage kan disabled zijn in incognito/strict mode
  }
}

const STANDAARD_STORAGE_KEY = "anonimizer.standaard";

/** Standaard-vervangingen blijven in localStorage zodat ze tussen sessies bewaard blijven. */
export function loadStandaard(): string {
  try {
    return localStorage.getItem(STANDAARD_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveStandaard(yaml: string): void {
  try {
    if (yaml.trim()) localStorage.setItem(STANDAARD_STORAGE_KEY, yaml);
    else localStorage.removeItem(STANDAARD_STORAGE_KEY);
  } catch {
    // noop
  }
}
