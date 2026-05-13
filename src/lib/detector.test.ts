import { describe, expect, it, vi } from "vitest";
import { ALLOWLIST, chunkTekst, detect } from "./detector";
import type { Entiteit, LlmChat } from "./types";

function makeChat(entities: Entiteit[]): LlmChat {
  return vi.fn(async () => JSON.stringify({ entiteiten: entities }));
}

function makeMultiChunkChat(perChunk: Entiteit[][]): LlmChat {
  let i = 0;
  return vi.fn(async () => {
    const e = perChunk[i++] ?? [];
    return JSON.stringify({ entiteiten: e });
  });
}

describe("chunkTekst", () => {
  it("retourneert één chunk bij korte tekst", () => {
    expect(chunkTekst("Korte tekst.")).toEqual(["Korte tekst."]);
  });

  it("splits lange tekst op paragraaf-grens", () => {
    const para1 = "A".repeat(4000);
    const para2 = "B".repeat(5000);
    const tekst = `${para1}\n\n${para2}`;
    const chunks = chunkTekst(tekst, 8000, 400);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // De eerste chunk eindigt voor de paragraafgrens
    expect(chunks[0].length).toBeLessThanOrEqual(8000);
  });

  it("dekt de volledige tekst met overlap", () => {
    const tekst = "X".repeat(20000);
    const chunks = chunkTekst(tekst, 8000, 400);
    // Concatenatie zonder overlap >= tekstlengte
    const totaalLengte = chunks.reduce((acc, c) => acc + c.length, 0);
    expect(totaalLengte).toBeGreaterThanOrEqual(tekst.length);
  });
});

describe("ALLOWLIST", () => {
  it("bevat afkortingen als CISO, AVG, BIO", () => {
    expect(ALLOWLIST.has("ciso")).toBe(true);
    expect(ALLOWLIST.has("avg")).toBe(true);
    expect(ALLOWLIST.has("bio")).toBe(true);
  });

  it("bevat publieke organisaties als IBD, VNG", () => {
    expect(ALLOWLIST.has("ibd")).toBe(true);
    expect(ALLOWLIST.has("vng")).toBe(true);
  });
});

describe("detect — laag 1 standaard", () => {
  it("past standaard-vervangingen toe als ze in de tekst staan", async () => {
    const result = await detect({
      tekst: "De gemeente Leiden werkt aan dit project.",
      standaard: { Leiden: "VOORBEELDGEMEENTE" },
      chat: makeChat([]),
    });
    expect(result.autoMapping["Leiden"]).toBe("VOORBEELDGEMEENTE");
    expect(result.bron["Leiden"]).toBe("standaard");
  });

  it("past standaard NIET toe als de tekst hem niet bevat", async () => {
    const result = await detect({
      tekst: "Geen gemeente in deze tekst.",
      standaard: { Leiden: "VOORBEELDGEMEENTE" },
      chat: makeChat([]),
    });
    expect(result.autoMapping["Leiden"]).toBeUndefined();
  });
});

describe("detect — laag 1.5 patronen", () => {
  it("vindt e-mail via patronen-laag", async () => {
    const result = await detect({
      tekst: "Mail naar jan@gemeente.nl",
      chat: makeChat([]),
    });
    expect(result.autoMapping["jan@gemeente.nl"]).toBe("[e-mailadres verwijderd]");
    expect(result.bron["jan@gemeente.nl"]).toBe("patroon");
  });
});

describe("detect — laag 2 memory", () => {
  it("past memory-entries toe als ze in de tekst staan", async () => {
    const memory: Entiteit[] = [
      { tekst: "Bas Stevens", suggestie: "de CISO", categorie: "persoon" },
    ];
    const result = await detect({
      tekst: "Goedgekeurd door Bas Stevens.",
      memory,
      chat: makeChat([]),
    });
    expect(result.autoMapping["Bas Stevens"]).toBe("de CISO");
    expect(result.bron["Bas Stevens"]).toBe("geheugen");
  });
});

describe("detect — laag 3 LLM", () => {
  it("retourneert LLM-entiteiten als newEntities", async () => {
    const result = await detect({
      tekst: "Tekst met Jan Jansen erin.",
      chat: makeChat([
        { tekst: "Jan Jansen", suggestie: "PERSOON_A", categorie: "persoon" },
      ]),
    });
    expect(result.newEntities).toHaveLength(1);
    expect(result.newEntities[0].tekst).toBe("Jan Jansen");
    expect(result.newEntities[0].bron).toBe("llm");
  });

  it("filtert allowlist-items uit de LLM-output", async () => {
    const result = await detect({
      tekst: "De CISO leidt het project.",
      chat: makeChat([
        { tekst: "CISO", suggestie: "rol", categorie: "functie" },
        { tekst: "Jan", suggestie: "PERSOON_A", categorie: "persoon" },
      ]),
    });
    expect(result.newEntities.map((e) => e.tekst)).toEqual(["Jan"]);
  });

  it("dedupliceert LLM-entities op tekst", async () => {
    const result = await detect({
      tekst: "Jan en Jan en nog meer Jan",
      chat: makeChat([
        { tekst: "Jan", suggestie: "PERSOON_A", categorie: "persoon" },
        { tekst: "Jan", suggestie: "PERSOON_A", categorie: "persoon" },
      ]),
    });
    expect(result.newEntities).toHaveLength(1);
  });

  it("filtert LLM-entities die al door eerdere lagen gedekt zijn", async () => {
    const result = await detect({
      tekst: "Bas Stevens en Jan Jansen werkten samen.",
      memory: [
        { tekst: "Bas Stevens", suggestie: "de CISO", categorie: "persoon" },
      ],
      chat: makeChat([
        { tekst: "Bas Stevens", suggestie: "PERSOON_A", categorie: "persoon" },
        { tekst: "Jan Jansen", suggestie: "PERSOON_B", categorie: "persoon" },
      ]),
    });
    expect(result.newEntities.map((e) => e.tekst)).toEqual(["Jan Jansen"]);
  });
});

describe("detect — robuustheid", () => {
  it("retourneert lege newEntities bij lege tekst", async () => {
    const chat = vi.fn();
    const result = await detect({ tekst: "   ", chat });
    expect(result.newEntities).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  it("retourneert lege newEntities bij invalid JSON van de LLM", async () => {
    const chat: LlmChat = async () => "geen valide json {{{";
    const result = await detect({
      tekst: "Iets met inhoud.",
      chat,
    });
    expect(result.newEntities).toEqual([]);
  });

  it("retourneert lege newEntities als de JSON geen entiteiten-array bevat", async () => {
    const chat: LlmChat = async () => JSON.stringify({ andere_key: "x" });
    const result = await detect({ tekst: "Tekst.", chat });
    expect(result.newEntities).toEqual([]);
  });

  it("verzamelt entiteiten over meerdere chunks", async () => {
    const longText = "A".repeat(5000) + "\n\n" + "B".repeat(5000) + "\n\n" + "C".repeat(5000);
    const chat = makeMultiChunkChat([
      [{ tekst: "EersteChunk", suggestie: "X", categorie: "overig" }],
      [{ tekst: "TweedeChunk", suggestie: "Y", categorie: "overig" }],
    ]);
    const result = await detect({ tekst: longText, chat });
    const teksten = result.newEntities.map((e) => e.tekst);
    expect(teksten).toContain("EersteChunk");
    expect(teksten).toContain("TweedeChunk");
  });
});
