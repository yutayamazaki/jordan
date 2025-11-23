import { NextResponse } from "next/server";
import {
  listContacts,
  type DeliverableEmailsFilter,
  type DepartmentCategoryFilter
} from "@/lib/contacts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const emailsParam = searchParams.get("emails");
  const domainQuery = searchParams.get("domain") ?? undefined;
  const departmentCategory: DepartmentCategoryFilter =
    searchParams.get("departmentCategory") ?? undefined;

  let limit = 100;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 500);
    }
  }

  const emailsFilter: DeliverableEmailsFilter =
    emailsParam === "with" || emailsParam === "without" ? emailsParam : "with";

  const contacts = listContacts(
    limit,
    0,
    "companyDomain",
    "asc",
    domainQuery ?? undefined,
    emailsFilter,
    departmentCategory
  );

  return NextResponse.json({ contacts });
}
