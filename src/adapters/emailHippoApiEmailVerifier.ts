import {
  EmailVerifier,
  EmailVerificationResult,
} from "../application/ports";
import https from "https";

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        if (!statusCode || statusCode < 200 || statusCode >= 300) {
          res.resume(); // drain
          reject(new Error(`Request failed with status code ${statusCode}`));
          return;
        }

        let rawData = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve(parsed);
          } catch (error) {
            reject(
              error instanceof Error
                ? error
                : new Error("Failed to parse EmailHippo API response as JSON"),
            );
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

type EmailHippoApiResponse = {
  meta?: {
    email?: string;
  };
  emailVerification?: {
    syntaxVerification?: {
      isSyntaxValid?: boolean;
      reason?: string;
    };
    dnsVerification?: {
      isDomainHasDnsRecord?: boolean;
      isDomainHasMxRecords?: boolean;
    };
    mailboxVerification?: {
      result?: string;
      reason?: string;
    };
  };
  infrastructure?: {
    mail?: {
      serviceTypeId?: string;
      mailServerLocation?: string;
    };
  };
  sendAssess?: {
    inboxQualityScore?: number;
    sendRecommendation?: string;
  };
  spamAssess?: {
    isDisposableEmailAddress?: boolean;
    overallRiskScore?: number;
  };
  spamTrapAssess?: {
    isSpamTrap?: boolean;
  };
  hippoTrust?: {
    score?: number;
    level?: string;
  };
};

export class EmailHippoApiEmailVerifier implements EmailVerifier {
  private readonly apiKey: string;

  constructor(apiKeyFromEnv?: string) {
    const key = apiKeyFromEnv ?? process.env.EMAIL_HIPPO_API_KEY;
    if (!key) {
      throw new Error(
        "EMAIL_HIPPO_API_KEY is not set. Please configure your EmailHippo API key.",
      );
    }
    this.apiKey = key;
  }

  async verify(email: string): Promise<EmailVerificationResult> {
    const encodedKey = encodeURIComponent(this.apiKey);
    const encodedEmail = encodeURIComponent(email);

    const url = `https://api.hippoapi.com/v3/more/json/${encodedKey}/${encodedEmail}`;

    let data: EmailHippoApiResponse;
    try {
      const raw = await fetchJson(url);
      data = raw as EmailHippoApiResponse;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown EmailHippo API error";
      return {
        email,
        isDeliverable: false,
        hasMxRecords: false,
        reason: `EmailHippo API call failed: ${message}`,
        source: "email_hippo",
      };
    }

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

