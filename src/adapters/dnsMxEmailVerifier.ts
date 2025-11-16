import { EmailVerifier, EmailVerificationResult } from "../application/ports";
import dns from "dns/promises";

export class DnsMxEmailVerifier implements EmailVerifier {
  async verify(email: string): Promise<EmailVerificationResult> {
    const atIndex = email.lastIndexOf("@");
    const domain = atIndex >= 0 ? email.slice(atIndex + 1) : "";

    if (!domain) {
      return {
        email,
        isDeliverable: false,
        hasMxRecords: false,
        reason: "Invalid email format",
        source: "dns_mx",
      };
    }

    try {
      const records = await dns.resolveMx(domain);
      const hasMxRecords = records.length > 0;

      return {
        email,
        isDeliverable: hasMxRecords,
        hasMxRecords,
        reason: hasMxRecords
          ? "MX records found for domain"
          : "No MX records found for domain",
        source: "dns_mx",
      };
    } catch (error) {
      return {
        email,
        isDeliverable: false,
        hasMxRecords: false,
        reason:
          error instanceof Error
            ? `MX lookup failed: ${error.message}`
            : "MX lookup failed",
        source: "dns_mx",
      };
    }
  }
}
