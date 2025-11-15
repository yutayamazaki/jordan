import { EmailPatternDetector } from "../application/ports";
import { EmailPattern } from "../domain/entities/emailPattern";
import { detectEmailPattern } from "../application/detectEmailPattern";

export class LlmEmailPatternDetector implements EmailPatternDetector {
  async detect(domain: string): Promise<EmailPattern | null> {
    return detectEmailPattern(domain);
  }
}
