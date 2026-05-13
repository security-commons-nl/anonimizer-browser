import { describe, expect, it } from "vitest";
import { parseStandaardYaml } from "./standaard";

describe("parseStandaardYaml", () => {
  it("parseert key:value paren onder vervangingen-wrapper", () => {
    const r = parseStandaardYaml(`vervangingen:
  Leiden: VOORBEELDGEMEENTE
  Servicepunt71: VOORBEELDSAMENWERKING`);
    expect(r).toEqual({
      Leiden: "VOORBEELDGEMEENTE",
      Servicepunt71: "VOORBEELDSAMENWERKING",
    });
  });

  it("parseert plat formaat zonder wrapper", () => {
    const r = parseStandaardYaml(`Leiden: VOORBEELDGEMEENTE
Servicepunt71: VOORBEELDSAMENWERKING`);
    expect(r).toEqual({
      Leiden: "VOORBEELDGEMEENTE",
      Servicepunt71: "VOORBEELDSAMENWERKING",
    });
  });

  it("haalt quotes weg", () => {
    const r = parseStandaardYaml(`"Naam met spaties": "Vervanging met spaties"`);
    expect(r).toEqual({ "Naam met spaties": "Vervanging met spaties" });
  });

  it("negeert lege regels en comments", () => {
    const r = parseStandaardYaml(`
# Een comment
Leiden: VOORBEELDGEMEENTE  # ook hier comment

Servicepunt71: VOORBEELDSAMENWERKING
`);
    expect(r).toEqual({
      Leiden: "VOORBEELDGEMEENTE",
      Servicepunt71: "VOORBEELDSAMENWERKING",
    });
  });

  it("retourneert leeg object voor lege input", () => {
    expect(parseStandaardYaml("")).toEqual({});
    expect(parseStandaardYaml("   \n\n  ")).toEqual({});
  });

  it("skipt regels zonder dubbele punt", () => {
    const r = parseStandaardYaml(`gewoon een regel
Leiden: VOORBEELDGEMEENTE`);
    expect(r).toEqual({ Leiden: "VOORBEELDGEMEENTE" });
  });
});
