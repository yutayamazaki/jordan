import { NextResponse } from "next/server";
import {
  listContacts,
  type DepartmentCategoryFilter,
  type PositionCategoryFilter
} from "@/lib/contacts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const departmentCategory: DepartmentCategoryFilter =
    searchParams.get("departmentCategory") ?? undefined;
  const positionCategory: PositionCategoryFilter =
    searchParams.get("positionCategory") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;

  let limit = 100;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 500);
    }
  }

  const contacts = listContacts(
    limit,
    0,
    "companyDomain",
    "asc",
    departmentCategory,
    positionCategory,
    companyId ?? undefined
  );

  return NextResponse.json({ contacts });
}
