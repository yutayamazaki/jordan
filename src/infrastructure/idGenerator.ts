import { randomUUID } from "crypto";
import { IdGenerator } from "../application/ports";

export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

