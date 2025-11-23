import { NextResponse } from "next/server";
import {
  listAllContacts,
  type ContactSortField,
  type SortDirection,
  type DeliverableEmailsFilter
} from "@/lib/contacts";

export const dynamic = "force-dynamic";

function parseSortParams(url: string): {
  sortField: ContactSortField;
  sortDirection: SortDirection;
  emailsFilter: DeliverableEmailsFilter;
} {
  const { searchParams } = new URL(url);
  const sortParam = searchParams.get("sort");
  const directionParam = searchParams.get("direction");

  const sortField: ContactSortField =
    sortParam === "companyName" ||
    sortParam === "companyDomain" ||
    sortParam === "name" ||
    sortParam === "position" ||
    sortParam === "department"
      ? sortParam
      : "companyDomain";

  const sortDirection: SortDirection =
    directionParam === "desc" ? "desc" : "asc";

  const emailsParam = searchParams.get("emails");
  const emailsFilter: DeliverableEmailsFilter =
    emailsParam === "with" || emailsParam === "without" ? emailsParam : "all";

  return { sortField, sortDirection, emailsFilter };
}

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { sortField, sortDirection, emailsFilter } = parseSortParams(
    request.url
  );
  const domainQuery = url.searchParams.get("domain") ?? undefined;

  const contacts = listAllContacts(
    sortField,
    sortDirection,
    domainQuery ?? undefined,
    emailsFilter
  );

  const header = [
    "id",
    "name",
    "position",
    "department",
    "companyName",
    "companyDomain",
    "deliverableEmails"
  ];

  const records: string[][] = [];

  for (const c of contacts) {
    const baseFields = [
      c.id,
      c.name,
      c.position,
      c.department,
      c.companyName,
      c.companyDomain
    ] as const;

    const emailsRaw = c.deliverableEmails;
    const emails =
      emailsRaw && emailsRaw.trim().length > 0
        ? emailsRaw
            .split(/\r?\n/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0)
        : [];

    if (emails.length === 0) {
      records.push([...baseFields, ""]);
    } else {
      for (const email of emails) {
        records.push([...baseFields, email]);
      }
    }
  }

  const lines = [
    header.map(escapeCsvValue).join(","),
    ...records.map((record) =>
      record.map((value) => escapeCsvValue(value)).join(",")
    )
  ];

  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contacts.csv"'
    }
  });
}
