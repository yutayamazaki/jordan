import type { CompaniesPageProps } from "../page";
import CompaniesPage from "../page";

export const dynamic = "force-dynamic";

type CompaniesRouteProps = Omit<CompaniesPageProps, "initialSelectedId"> & {
  params: { id: string };
};

export default function CompaniesPageWithId({
  searchParams,
  params
}: CompaniesRouteProps) {
  return <CompaniesPage searchParams={searchParams} initialSelectedId={params.id} />;
}
