import { readFileSync } from "fs";
import { EmailVerificationResult } from "../application/ports";

export function loadEmailHippoCsv(
  path: string,
): Map<string, EmailVerificationResult> {
  const content = readFileSync(path, "utf8");

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return new Map();
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const header = headerLine.split(delimiter).map((col) => col.trim());

  const checkedEmailIndex = header.indexOf("CheckedEmailAddress");
  const statusIndex = header.indexOf("Status");
  const additionalStatusInfoIndex = header.indexOf("AdditionalStatusInfo");
  const domainCountryCodeIndex = header.indexOf("DomainCountryCode");
  const mailServerCountryCodeIndex = header.indexOf("MailServerCountryCode");

  if (checkedEmailIndex === -1 || statusIndex === -1) {
    throw new Error(
      'EmailHippo CSV must include "CheckedEmailAddress" and "Status" columns',
    );
  }

  const map = new Map<string, EmailVerificationResult>();

  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter);
    if (cols.length <= Math.max(checkedEmailIndex, statusIndex)) {
      continue;
    }

    const checkedEmailAddress = cols[checkedEmailIndex].trim();
    const status = cols[statusIndex].trim();

    if (!checkedEmailAddress) {
      continue;
    }

    const additionalStatusInfo =
      additionalStatusInfoIndex >= 0
        ? cols[additionalStatusInfoIndex]?.trim() || undefined
        : undefined;
    const domainCountryCode =
      domainCountryCodeIndex >= 0
        ? cols[domainCountryCodeIndex]?.trim() || undefined
        : undefined;
    const mailServerCountryCode =
      mailServerCountryCodeIndex >= 0
        ? cols[mailServerCountryCodeIndex]?.trim() || undefined
        : undefined;

    const isDeliverable = status === "Ok";

    const reasonParts = [`EmailHippo Status=${status}`];
    if (additionalStatusInfo) {
      reasonParts.push(`Info=${additionalStatusInfo}`);
    }

    const result: EmailVerificationResult = {
      email: checkedEmailAddress,
      isDeliverable,
      hasMxRecords: true,
      reason: reasonParts.join(", "),
      source: "email_hippo",
      status,
      additionalStatusInfo,
      domainCountryCode,
      mailServerCountryCode,
    };

    map.set(checkedEmailAddress, result);
  }

  return map;
}

