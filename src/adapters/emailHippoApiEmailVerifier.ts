import { EmailVerifier, EmailVerificationResult } from "../application/ports";
import { err, ok, Result } from "neverthrow";
import { fetchJson } from "./fetchHelpers";
import { z } from "zod";

const emailHippoApiResponseSchema = z
  .object({
    meta: z
      .object({
        email: z.string().optional(),
      })
      .optional(),
    emailVerification: z
      .object({
        syntaxVerification: z
          .object({
            isSyntaxValid: z.boolean().optional(),
            reason: z.string().optional(),
          })
          .optional(),
        dnsVerification: z
          .object({
            isDomainHasDnsRecord: z.boolean().optional(),
            isDomainHasMxRecords: z.boolean().optional(),
          })
          .optional(),
        mailboxVerification: z
          .object({
            result: z.string().optional(),
            reason: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    infrastructure: z
      .object({
        mail: z
          .object({
            serviceTypeId: z.string().optional(),
            mailServerLocation: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    sendAssess: z
      .object({
        inboxQualityScore: z.number().optional(),
        sendRecommendation: z.string().optional(),
      })
      .optional(),
    spamAssess: z
      .object({
        isDisposableEmailAddress: z.boolean().optional(),
        overallRiskScore: z.number().optional(),
      })
      .optional(),
    spamTrapAssess: z
      .object({
        isSpamTrap: z.boolean().optional(),
      })
      .optional(),
    hippoTrust: z
      .object({
        score: z.number().optional(),
        level: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

type EmailHippoApiResponse = z.infer<typeof emailHippoApiResponseSchema>;

export class EmailHippoApiEmailVerifier implements EmailVerifier {
  private readonly apiKey: string;

  private constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static create(apiKeyFromEnv?: string): Result<EmailHippoApiEmailVerifier, Error> {
    const key = apiKeyFromEnv ?? process.env.EMAIL_HIPPO_API_KEY;
    if (!key) {
      return err(
        new Error(
          "EMAIL_HIPPO_API_KEY is not set. Please configure your EmailHippo API key.",
        ),
      );
    }
    return ok(new EmailHippoApiEmailVerifier(key));
  }

  async verify(email: string): Promise<EmailVerificationResult> {
    const encodedKey = encodeURIComponent(this.apiKey);
    const encodedEmail = encodeURIComponent(email);

    const url = `https://api.hippoapi.com/v3/more/json/${encodedKey}/${encodedEmail}`;
    const fetchResult = await fetchJson<EmailHippoApiResponse>(
      url,
      emailHippoApiResponseSchema,
    );

    if (fetchResult.isErr()) {
      console.error(`EmailHippo API call failed for email ${email}:`, fetchResult.error);
      return {
        email,
        isDeliverable: false,
        hasMxRecords: false,
        reason: `EmailHippo API call failed: ${JSON.stringify(fetchResult.error)}`,
        source: "email_hippo",
      };
    }

    const data = fetchResult.value;

    const metaEmail = data.meta?.email;

    const mailboxResult = data.emailVerification?.mailboxVerification?.result;
    const mailboxReason = data.emailVerification?.mailboxVerification?.reason;

    const syntaxIsValid =
      data.emailVerification?.syntaxVerification?.isSyntaxValid;
    const syntaxReason = data.emailVerification?.syntaxVerification?.reason;

    const domainHasDnsRecord =
      data.emailVerification?.dnsVerification?.isDomainHasDnsRecord;
    const domainHasMxRecords =
      data.emailVerification?.dnsVerification?.isDomainHasMxRecords;

    const inboxQualityScore = data.sendAssess?.inboxQualityScore;
    const sendRecommendation = data.sendAssess?.sendRecommendation;

    const isDisposableEmailAddress =
      data.spamAssess?.isDisposableEmailAddress;
    const overallRiskScore = data.spamAssess?.overallRiskScore;
    const isSpamTrap = data.spamTrapAssess?.isSpamTrap;

    const hippoTrustScore = data.hippoTrust?.score;
    const hippoTrustLevel = data.hippoTrust?.level;

    const mailServerLocation =
      data.infrastructure?.mail?.mailServerLocation;
    const mailServiceTypeId = data.infrastructure?.mail?.serviceTypeId;

    // isDeliverable 判定ロジック
    const normalizedMailboxResult = (mailboxResult ?? "").toString().toLowerCase();
    const isMailboxOk = normalizedMailboxResult === "ok";
    const isDeliverable =
      isMailboxOk &&
      isSpamTrap !== true &&
      isDisposableEmailAddress !== true;

    const hasMxRecords = domainHasMxRecords === true;

    const reasonParts: string[] = [];
    if (mailboxResult) {
      reasonParts.push(`Mailbox=${mailboxResult}`);
    }
    if (mailboxReason) {
      reasonParts.push(`MailboxReason=${mailboxReason}`);
    }
    if (sendRecommendation) {
      reasonParts.push(`SendRecommendation=${sendRecommendation}`);
    }
    if (hippoTrustLevel) {
      reasonParts.push(`TrustLevel=${hippoTrustLevel}`);
    }
    if (overallRiskScore !== undefined) {
      reasonParts.push(`OverallRiskScore=${overallRiskScore}`);
    }

    const reason = reasonParts.length > 0 ? reasonParts.join(", ") : undefined;

    const result: EmailVerificationResult = {
      email: metaEmail ?? email,
      isDeliverable,
      hasMxRecords,
      reason,
      source: "email_hippo",
      mailboxResult,
      mailboxReason,
      syntaxIsValid,
      syntaxReason,
      domainHasDnsRecord,
      domainHasMxRecords,
      inboxQualityScore,
      sendRecommendation,
      isDisposableEmailAddress,
      isSpamTrap,
      overallRiskScore,
      hippoTrustScore,
      hippoTrustLevel,
      mailServerLocation,
      mailServiceTypeId,
    };

    return result;
  }
}
