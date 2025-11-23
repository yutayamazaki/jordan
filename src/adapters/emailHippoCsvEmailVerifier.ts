import { EmailVerificationResult, EmailVerifier } from "../application/ports";

// EmailHippo API を呼び出さず、事前に用意した CSV の結果を返す簡易 Verifier
export class EmailHippoCsvEmailVerifier implements EmailVerifier {
  private readonly map: Map<string, EmailVerificationResult>;

  constructor(map: Map<string, EmailVerificationResult>) {
    this.map = map;
  }

  async verify(email: string): Promise<EmailVerificationResult> {
    const hit = this.map.get(email);
    if (hit) {
      return hit;
    }

    // CSV に含まれない場合のデフォルト応答。必要に応じて挙動を調整してください。
    return {
      email,
      isDeliverable: false,
      hasMxRecords: false,
      reason: "Not found in EmailHippo CSV",
      source: "email_hippo",
    };
  }
}
