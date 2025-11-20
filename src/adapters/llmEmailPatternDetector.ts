import { EmailPatternDetector } from "../application/ports";
import { detectEmailPattern } from "../application/detectEmailPattern";
import { EmailPattern } from "../domain/entities/emailPattern";
import { Result } from "neverthrow";

export class LlmEmailPatternDetector implements EmailPatternDetector {
  async detect(domain: string): Promise<Result<EmailPattern | null, Error>> {
    return detectEmailPattern(domain);
  }
}
