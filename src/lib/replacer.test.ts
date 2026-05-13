import { describe, expect, it } from "vitest";
import { apply, buildMapping, heeftWordGrens } from "./replacer";

describe("heeftWordGrens", () => {
  it("true voor key die op woord-karakters begint en eindigt", () => {
    expect(heeftWordGrens("Leiden")).toBe(true);
    expect(heeftWordGrens("a")).toBe(true);
    expect(heeftWordGrens("foo_bar")).toBe(true);
  });

  it("false voor key die op non-woord-karakter begint of eindigt", () => {
    expect(heeftWordGrens("(C)ISO")).toBe(false);
    expect(heeftWordGrens("IB-")).toBe(false);
    expect(heeftWordGrens("-foo")).toBe(false);
  });

  it("false voor lege string", () => {
    expect(heeftWordGrens("")).toBe(false);
  });
});

describe("buildMapping", () => {
  it("converteert lijst van entiteiten naar {tekst: suggestie}", () => {
    const m = buildMapping([
      { tekst: "Jan", suggestie: "PERSOON_A", categorie: "persoon" },
      { tekst: "Piet", suggestie: "PERSOON_B", categorie: "persoon" },
    ]);
    expect(m).toEqual({ Jan: "PERSOON_A", Piet: "PERSOON_B" });
  });

  it("filtert entiteiten zonder tekst", () => {
    const m = buildMapping([{ tekst: "", suggestie: "X", categorie: "overig" }]);
    expect(m).toEqual({});
  });
});

describe("apply — basis", () => {
  it("vervangt een eenvoudige key", () => {
    const r = apply("Hallo Jan, dag Jan.", { Jan: "PERSOON_A" });
    expect(r).toBe("Hallo PERSOON_A, dag PERSOON_A.");
  });

  it("doet niets als mapping leeg is", () => {
    const r = apply("Tekst zonder vervangingen.", {});
    expect(r).toBe("Tekst zonder vervangingen.");
  });

  it("is case-insensitive", () => {
    const r = apply("Leiden en leiden zijn hetzelfde", { Leiden: "GEMEENTE_X" });
    expect(r).toBe("GEMEENTE_X en GEMEENTE_X zijn hetzelfde");
  });
});

describe("apply — word-boundary", () => {
  it("matcht 'beveiliging' NIET binnen 'informatiebeveiliging'", () => {
    const r = apply("De informatiebeveiliging is op orde", {
      beveiliging: "X",
    });
    expect(r).toBe("De informatiebeveiliging is op orde");
  });

  it("matcht 'Leiden' NIET binnen 'begeleiden'", () => {
    const r = apply("Het begeleiden van projecten", { Leiden: "X" });
    expect(r).toBe("Het begeleiden van projecten");
  });

  it("matcht 'Leiden' WEL als losse woord", () => {
    const r = apply("In de gemeente Leiden gebeurt veel", { Leiden: "VOORBEELDGEMEENTE" });
    expect(r).toBe("In de gemeente VOORBEELDGEMEENTE gebeurt veel");
  });

  it("geen word-boundary voor keys met non-woord randen", () => {
    // '(C)ISO' begint met '(' — geen \b-wrapping; gewone match.
    const r = apply("De (C)ISO is bezig", { "(C)ISO": "ROL" });
    expect(r).toBe("De ROL is bezig");
  });
});

describe("apply — langste eerst", () => {
  it("vervangt langere keys voor kortere om partial replacement te voorkomen", () => {
    const r = apply("Jan Jansen werkt hier", {
      Jan: "PERSOON_A",
      "Jan Jansen": "PERSOON_B",
    });
    expect(r).toBe("PERSOON_B werkt hier");
  });
});

describe("apply — lidwoord-collapse", () => {
  it("collapst 'de de' naar 'de'", () => {
    const r = apply("Dit is de de CISO van de organisatie", { CISO: "CISO" });
    expect(r).toBe("Dit is de CISO van de organisatie");
  });

  it("collapst 'het het' naar 'het'", () => {
    const r = apply("Bij het het project gebeurt iets", {});
    expect(r).toBe("Bij het project gebeurt iets");
  });

  it("collapst case-insensitive 'De de' naar 'De'", () => {
    const r = apply("De de directeur loopt rond", {});
    expect(r).toBe("De directeur loopt rond");
  });
});

describe("apply — placeholder-lijst-collapse", () => {
  it("collapst meerdere VOORBEELDGEMEENTE in lijst", () => {
    const r = apply(
      "Samenwerking tussen VOORBEELDGEMEENTE, VOORBEELDGEMEENTE en VOORBEELDGEMEENTE.",
      {},
    );
    expect(r).toBe("Samenwerking tussen de betrokken gemeenten.");
  });

  it("collapst niet als er maar één placeholder is", () => {
    const r = apply("Alleen VOORBEELDGEMEENTE in deze zin.", {});
    expect(r).toBe("Alleen VOORBEELDGEMEENTE in deze zin.");
  });
});

describe("apply — geen dollar-interpretation", () => {
  it("verwerkt vervangingen met $ als literal", () => {
    const r = apply("Hallo Jan", { Jan: "$1$2" });
    expect(r).toBe("Hallo $1$2");
  });
});
