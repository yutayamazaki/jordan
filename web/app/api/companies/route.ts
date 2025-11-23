import { NextResponse } from "next/server";
import { getCompanyOption, searchCompanies } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;
  const limitParam = searchParams.get("limit");

  let limit = 20;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 50);
    }
  }

  const companies = searchCompanies(limit, query ?? undefined);

  if (companyId) {
    const selected = getCompanyOption(companyId);
    if (selected && !companies.some((c) => c.id === selected.id)) {
      companies.unshift(selected);
    }
  }

  return NextResponse.json({ companies });
}
