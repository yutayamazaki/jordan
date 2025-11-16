import { describe, it, expect } from "vitest";
import {
  adjustEmailConfidence,
  createContactAndEmailCandidates,
  decideEmailPattern,
} from "./companyScanDomain";
import type { IdGenerator, EmailVerificationResult } from "./ports";
import type { EmailPattern } from "../domain/entities/emailPattern";
import type { ContactResponse } from "../domain/entities/contact";

const fakeIdGenerator: IdGenerator = {
  // z.uuid() に通る固定値
  generate: () => "00000000-0000-0000-0000-000000000000",
};

describe("decideEmailPattern", () => {
  it("prefers learned pattern when available", () => {
    const companyId = "00000000-0000-0000-0000-000000000000";
    const learnedPattern: { pattern: EmailPattern["pattern"]; reason: string } =
      {
        pattern: "first.last",
        reason: "Learned from past successful sends",
      };

    const result = decideEmailPattern(
      companyId,
      {
        detectedEmailPattern: {
          pattern: "f-last",
          reason: "Detected from web search",
          found: true,
          sources: [],
        },
        learnedPattern,
      },
      fakeIdGenerator,
    );

    expect(result.pattern).toBe("first.last");
    expect(result.record).toHaveLength(1);
    expect(result.record[0].companyId).toBe(companyId);
    expect(result.record[0].pattern).toBe("first.last");
    expect(result.record[0].reason).toBe(learnedPattern.reason);
    expect(result.logMessages.join(" ")).toContain(
      "Using learned email pattern from past results:",
    );
  });

  it("uses detected pattern when no learned pattern exists", () => {
    const companyId = "00000000-0000-0000-0000-000000000000";
    const detectedPattern: {
      pattern: EmailPattern["pattern"];
      reason: string;
      found: boolean;
      sources: [];
    } = {
      pattern: "f_last",
      reason: "Detected from public email address",
      found: true,
      sources: [],
    };

    const result = decideEmailPattern(
      companyId,
      {
        detectedEmailPattern: detectedPattern,
        learnedPattern: null,
      },
      fakeIdGenerator,
    );

    expect(result.pattern).toBe("f_last");
    expect(result.record).toHaveLength(1);
    expect(result.record[0].companyId).toBe(companyId);
    expect(result.record[0].pattern).toBe("f_last");
    expect(result.record[0].reason).toBe(detectedPattern.reason);
    expect(result.logMessages.join(" ")).toContain("Detected email pattern:");
  });

  it("falls back to default pattern when neither learned nor detected pattern is available", () => {
    const companyId = "00000000-0000-0000-0000-000000000000";

    const result = decideEmailPattern(
      companyId,
      {
        detectedEmailPattern: null,
        learnedPattern: null,
      },
      fakeIdGenerator,
    );

    expect(result.pattern).toBe("f-last");
    expect(result.record).toHaveLength(0);
    expect(result.logMessages.join(" ")).toContain("Using default pattern");
  });
});

describe("createContactAndEmailCandidates", () => {
  it("creates contact and email candidates using primary pattern", () => {
    const contacts: ContactResponse[] = [
      {
        name: "Taro Yamada",
        position: "CIO",
        department: "情報システム部",
        firstName: "taro",
        lastName: "yamada",
        sources: [],
      },
    ];

    const domain = "example.com";
    const primaryPattern: EmailPattern["pattern"] = "first.last";

    const result = createContactAndEmailCandidates(
      contacts,
      domain,
      primaryPattern,
    );

    expect(result).toHaveLength(1);
    const entry = result[0];

    expect(entry.contact.name).toBe("Taro Yamada");
    expect(entry.contact.position).toBe("CIO");
    expect(entry.contact.department).toBe("情報システム部");
    expect(entry.contact.firstName).toBe("taro");
    expect(entry.contact.lastName).toBe("yamada");

    expect(entry.primaryEmail.value).toBe("taro.yamada@example.com");
    expect(entry.primaryEmail.confidence).toBeGreaterThan(0);

    // alternatives should not be empty and should not include the primary email itself
    expect(entry.alternativeEmails.length).toBeGreaterThan(0);
    const alternativeValues = entry.alternativeEmails.map((e) => e.value);
    expect(alternativeValues).not.toContain(entry.primaryEmail.value);
  });
});

describe("adjustEmailConfidence", () => {
  it("returns base confidence when verification is missing", () => {
    const base = 0.5;
    const adjusted = adjustEmailConfidence(base);
    expect(adjusted).toBe(base);
  });

  it("returns 1 when EmailHippo marks address as deliverable", () => {
    const base = 0.6;
    const verification: EmailVerificationResult = {
      email: "user@example.com",
      isDeliverable: true,
      hasMxRecords: true,
      source: "email_hippo",
    };

    const adjusted = adjustEmailConfidence(base, verification);
    expect(adjusted).toBe(1);
  });

  it("caps confidence at 0.1 when EmailHippo marks address as undeliverable", () => {
    const base = 0.9;
    const verification: EmailVerificationResult = {
      email: "user@example.com",
      isDeliverable: false,
      hasMxRecords: true,
      source: "email_hippo",
    };

    const adjusted = adjustEmailConfidence(base, verification);
    expect(adjusted).toBeLessThanOrEqual(0.1);
    expect(adjusted).toBeGreaterThan(0);
  });

  it("increases confidence when MX records exist for non EmailHippo sources", () => {
    const base = 0.7;
    const verification: EmailVerificationResult = {
      email: "user@example.com",
      isDeliverable: true,
      hasMxRecords: true,
      source: "dns_mx",
    };

    const adjusted = adjustEmailConfidence(base, verification);
    expect(adjusted).toBeCloseTo(0.8, 5);
  });

  it("decreases confidence when MX records do not exist", () => {
    const base = 0.5;
    const verification: EmailVerificationResult = {
      email: "user@example.com",
      isDeliverable: false,
      hasMxRecords: false,
      source: "dns_mx",
    };

    const adjusted = adjustEmailConfidence(base, verification);
    expect(adjusted).toBeCloseTo(0.2, 5);
  });
}
);
