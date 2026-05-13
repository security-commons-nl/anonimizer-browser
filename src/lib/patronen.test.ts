import { describe, expect, it } from "vitest";
import { detectPatronen, isGeldigBsn } from "./patronen";

describe("isGeldigBsn", () => {
  it("accepteert bekende geldige BSN-nummers", () => {
    // Voorbeeld-BSN uit publieke testset (11-proef sluit).
    expect(isGeldigBsn("111222333")).toBe(true);
    expect(isGeldigBsn("123456782")).toBe(true);
  });

  it("weigert getallen die niet 11-proef sluiten", () => {
    expect(isGeldigBsn("123456789")).toBe(false);
  });

  it("weigert all-zeros en korte/lange invoer", () => {
    expect(isGeldigBsn("000000000")).toBe(false);
    expect(isGeldigBsn("12345")).toBe(false);
    expect(isGeldigBsn("1234567890")).toBe(false);
  });

  it("weigert non-digit invoer", () => {
    expect(isGeldigBsn("12345678a")).toBe(false);
  });
});

describe("detectPatronen — email", () => {
  it("vindt e-mailadres", () => {
    const { mapping } = detectPatronen("Mail naar jan@gemeente.nl voor info.");
    expect(mapping["jan@gemeente.nl"]).toBe("[e-mailadres verwijderd]");
  });

  it("vindt meerdere e-mails", () => {
    const { entiteiten } = detectPatronen("a@x.nl en b@y.nl");
    expect(entiteiten.filter((e) => e.categorie === "email")).toHaveLength(2);
  });
});

describe("detectPatronen — telefoon", () => {
  it("vindt 06-nummers", () => {
    const { mapping } = detectPatronen("Bel 06-12345678 voor vragen");
    expect(Object.values(mapping)).toContain("[telefoonnummer verwijderd]");
  });

  it("vindt +31 formaat", () => {
    const { mapping } = detectPatronen("Tel: +31 (0)20 1234567");
    expect(Object.values(mapping)).toContain("[telefoonnummer verwijderd]");
  });

  it("matcht NIET binnen versie-strings", () => {
    const { entiteiten } = detectPatronen("Versie 1.0 0.5 release");
    expect(entiteiten.filter((e) => e.categorie === "telefoon")).toHaveLength(0);
  });
});

describe("detectPatronen — postcode", () => {
  it("vindt NL-postcode met en zonder spatie", () => {
    const r1 = detectPatronen("Adres: 2311 GH Leiden");
    expect(r1.mapping["2311 GH"]).toBe("[postcode verwijderd]");
    const r2 = detectPatronen("Adres: 2311GH Leiden");
    expect(r2.mapping["2311GH"]).toBe("[postcode verwijderd]");
  });

  it("matcht niet als de twee letters lowercase zijn", () => {
    const { entiteiten } = detectPatronen("code 2311 gh");
    expect(entiteiten.filter((e) => e.categorie === "locatie")).toHaveLength(0);
  });
});

describe("detectPatronen — KVK + FG", () => {
  it("vindt KVK-nummer", () => {
    const { mapping } = detectPatronen("KVK 12345678");
    expect(mapping["KVK 12345678"]).toBe("[KVK-nummer verwijderd]");
  });

  it("vindt FG-nummer (6 cijfers, niet 8)", () => {
    const { mapping } = detectPatronen("Aangemeld als FG 123456");
    expect(mapping["FG 123456"]).toBe("[FG-nummer verwijderd]");
  });
});

describe("detectPatronen — IBAN", () => {
  it("vindt NL IBAN", () => {
    const { mapping } = detectPatronen("Stort op NL91 ABNA 0417 1643 00");
    expect(mapping["NL91 ABNA 0417 1643 00"]).toBe("[IBAN verwijderd]");
  });
});

describe("detectPatronen — BSN met 11-proef", () => {
  it("vindt geldig BSN", () => {
    // 111222333 sluit 11-proef
    const { mapping } = detectPatronen("BSN: 111222333 graag controleren");
    expect(mapping["111222333"]).toBe("[BSN verwijderd]");
  });

  it("negeert ongeldige 9-cijfers (11-proef faalt)", () => {
    const { entiteiten } = detectPatronen("Pagina 100200300 van het dossier");
    // 100200300 sluit GEEN 11-proef
    expect(entiteiten.filter((e) => e.categorie === "nummer")).toHaveLength(0);
  });
});

describe("detectPatronen — IPv4", () => {
  it("vindt geldig IP-adres", () => {
    const { mapping } = detectPatronen("Server op 192.168.1.1 bereikbaar");
    expect(mapping["192.168.1.1"]).toBe("[IP-adres verwijderd]");
  });

  it("negeert versie-nummer-achtige reeksen", () => {
    const { entiteiten } = detectPatronen("Spec v14.2.7.1 vereist");
    expect(entiteiten.filter((e) => e.categorie === "nummer")).toHaveLength(0);
  });
});

describe("detectPatronen — overlap-handling", () => {
  it("geeft IBAN voorrang boven telefoon binnen IBAN", () => {
    // IBAN bevat genoeg cijfers dat het als telefoon zou kunnen matchen
    const { entiteiten } = detectPatronen("Iban: NL91 ABNA 0417 1643 00");
    const ibans = entiteiten.filter((e) => e.bron === "patroon:iban");
    const telefoons = entiteiten.filter((e) => e.bron === "patroon:telefoon");
    expect(ibans).toHaveLength(1);
    expect(telefoons).toHaveLength(0);
  });
});

describe("detectPatronen — geen dubbele entries", () => {
  it("dezelfde tekst meermaals = één mapping-entry", () => {
    const { entiteiten } = detectPatronen("a@x.nl en nog eens a@x.nl");
    expect(entiteiten.filter((e) => e.tekst === "a@x.nl")).toHaveLength(1);
  });
});
