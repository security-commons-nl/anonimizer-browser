export type Categorie =
  | "persoon"
  | "email"
  | "telefoon"
  | "organisatie"
  | "project"
  | "locatie"
  | "functie"
  | "nummer"
  | "datum"
  | "overig";

export interface Entiteit {
  tekst: string;
  categorie: Categorie | string;
  suggestie: string;
  bron?: string;
}

export type Mapping = Record<string, string>;

export interface DetectResult {
  autoMapping: Mapping;
  newEntities: Entiteit[];
  bron: Record<string, string>;
}

export interface LlmChat {
  (messages: { role: "system" | "user"; content: string }[]): Promise<string>;
}
