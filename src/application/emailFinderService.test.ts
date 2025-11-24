import { describe, it, expect } from "vitest";
import { generateEmailAddresses } from "./emailFinderService";

describe("generateEmailAddresses", () => {
  const baseInput = {
    firstName: "taro",
    lastName: "yamada",
    domain: "example.com",
  };

  it("generates expected email strings for each pattern", () => {
    const result = generateEmailAddresses(baseInput);

    const allEmails = [result.primary, ...result.alternatives];
    const byPattern = new Map(
      allEmails.map((e) => [e.pattern, e.value]),
    );

    expect(byPattern.get("last")).toBe("yamada@example.com");
    expect(byPattern.get("first.last")).toBe("taro.yamada@example.com");
    expect(byPattern.get("last.first")).toBe("yamada.taro@example.com");
    expect(byPattern.get("first-last")).toBe("taro-yamada@example.com");
    expect(byPattern.get("last-first")).toBe("yamada-taro@example.com");
    expect(byPattern.get("first_last")).toBe("taro_yamada@example.com");
    expect(byPattern.get("last_first")).toBe("yamada_taro@example.com");
    expect(byPattern.get("firstlast")).toBe("taroyamada@example.com");
    expect(byPattern.get("lastfirst")).toBe("yamadataro@example.com");
    expect(byPattern.get("f.last")).toBe("t.yamada@example.com");
    expect(byPattern.get("f-last")).toBe("t-yamada@example.com");
    expect(byPattern.get("f_last")).toBe("t_yamada@example.com");
    expect(byPattern.get("flast")).toBe("tyamada@example.com");
  });

  it("uses specified primaryPattern as primary", () => {
    const primaryPattern = "first.last" as const;
    const result = generateEmailAddresses({
      ...baseInput,
      primaryPattern,
    });

    expect(result.primary.pattern).toBe(primaryPattern);
    expect(result.primary.value).toBe("taro.yamada@example.com");

    result.alternatives.forEach((alt) => {
      if (alt.pattern === primaryPattern) {
        throw new Error("primary pattern must not appear in alternatives");
      }
    });
  });

  it("uses DEFAULT_EMAIL_PATTERN when primaryPattern is not specified", () => {
    const result = generateEmailAddresses(baseInput);

    // DEFAULT_EMAIL_PATTERN は "f-last"
    expect(result.primary.pattern).toBe("f-last");
    expect(result.primary.value).toBe("t-yamada@example.com");
  });
});
