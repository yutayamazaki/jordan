import {
  listCompanies,
  countCompanies,
  type CompanySortKey,
  type SortOrder,
  DEFAULT_COMPANY_SORT_KEY,
  DEFAULT_COMPANY_SORT_ORDER,
} from "@/lib/companies";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CompaniesTable } from "./companies-table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export type CompaniesPageProps = {
  searchParams?: {
    page?: string;
    domain?: string;
    sort?: string;
    order?: string;
  };
  initialSelectedId?: string | null;
};

export function CompaniesPageContent({
  searchParams,
  initialSelectedId
}: CompaniesPageProps) {
  const pageSize = 100;

  const domainParam = searchParams?.domain;
  const domainQuery =
    domainParam && domainParam.trim().length > 0 ? domainParam.trim() : undefined;

  const totalCount = countCompanies(domainQuery);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  let page = Number(searchParams?.page ?? "1");
  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }
  if (page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;

  const allowedSortKeys: CompanySortKey[] = [
    "name",
    "domain",
    "websiteUrl",
    "contactCount",
    "createdAt",
    "updatedAt",
  ];

  const sortKey: CompanySortKey = allowedSortKeys.includes(
    (searchParams?.sort as CompanySortKey) ?? DEFAULT_COMPANY_SORT_KEY,
  )
    ? ((searchParams?.sort as CompanySortKey) ?? DEFAULT_COMPANY_SORT_KEY)
    : DEFAULT_COMPANY_SORT_KEY;

  const sortOrder: SortOrder =
    searchParams?.order === "desc" || searchParams?.order === "asc"
      ? searchParams.order
      : DEFAULT_COMPANY_SORT_ORDER;

  const pageItems: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) {
      pageItems.push(p);
    }
  } else {
    const windowSize = 2;
    const start = Math.max(2, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);

    pageItems.push(1);

    if (start > 2) {
      pageItems.push("ellipsis");
    } else if (start === 2) {
      pageItems.push(2);
    }

    for (let p = start; p <= end; p++) {
      if (p !== 1 && p !== totalPages) {
        pageItems.push(p);
      }
    }

    if (end < totalPages - 1) {
      pageItems.push("ellipsis");
    } else if (end === totalPages - 1) {
      pageItems.push(totalPages - 1);
    }

    if (totalPages > 1) {
      pageItems.push(totalPages);
    }
  }

  const companies = listCompanies(pageSize, offset, domainQuery, {
    key: sortKey,
    order: sortOrder,
  });

  const buildQueryString = (params: {
    page?: number;
    domain?: string;
    sortKey?: CompanySortKey;
    sortOrder?: SortOrder;
  }) => {
    const query = new URLSearchParams();

    const nextSortKey = params.sortKey ?? sortKey;
    const nextSortOrder = params.sortOrder ?? sortOrder;

    if (params.page && params.page > 1) {
      query.set("page", String(params.page));
    }
    if (params.domain) {
      query.set("domain", params.domain);
    }
    if (searchParams?.sort || nextSortKey !== DEFAULT_COMPANY_SORT_KEY) {
      query.set("sort", nextSortKey);
    }
    if (searchParams?.order || nextSortOrder !== DEFAULT_COMPANY_SORT_ORDER) {
      query.set("order", nextSortOrder);
    }

    const queryString = query.toString();

    return queryString ? `?${queryString}` : "";
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Companies"
        description=""
      />
      <form
        action="/companies"
        method="get"
        className="flex items-center gap-2"
      >
        <input
          type="text"
          name="domain"
          defaultValue={domainQuery ?? ""}
          placeholder="会社名 または ドメイン"
          className="h-8 w-64 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        />
        <Button type="submit" variant="secondary">検索</Button>
      </form>
      {companies.length === 0 ? (
        <EmptyState
          title="Companies データがありません"
          description="まずは CLI から collect / score を実行して、会社情報を収集してください。"
        />
      ) : (
        <>
          <CompaniesTable
            companies={companies}
            sortKey={sortKey}
            sortOrder={sortOrder}
            domainQuery={domainQuery}
            initialSelectedId={initialSelectedId}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <span>
              {totalCount === 0
                ? "0件"
                : `${offset + 1}-${offset + companies.length} / ${totalCount}件`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                asChild
                disabled={page <= 1}
              >
                <a
                  href={
                    page <= 1
                      ? `/companies${buildQueryString({
                          domain: domainQuery,
                          sortKey,
                          sortOrder,
                        })}`
                      : `/companies${buildQueryString({
                          page: page - 1,
                          domain: domainQuery,
                          sortKey,
                          sortOrder,
                        })}`
                  }
                >
                  前へ
                </a>
              </Button>
              <div className="flex items-center gap-1">
                {pageItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-slate-400">
                      …
                    </span>
                  ) : (
                    (() => {
                      const targetPage = item;
                      const isCurrent = targetPage === page;
                      const href = `/companies${buildQueryString({
                        page: targetPage,
                        domain: domainQuery,
                        sortKey,
                        sortOrder,
                      })}`;

                      return (
                        <Button
                          key={targetPage}
                          variant={isCurrent ? "primary" : "secondary"}
                          asChild
                          disabled={isCurrent}
                        >
                          <a href={href}>{targetPage}</a>
                        </Button>
                      );
                    })()
                  )
                )}
              </div>
              <Button
                variant="secondary"
                asChild
                disabled={page >= totalPages}
              >
                <a
                  href={
                    page >= totalPages
                      ? `/companies${buildQueryString({
                          page: totalPages,
                          domain: domainQuery,
                          sortKey,
                          sortOrder,
                        })}`
                      : `/companies${buildQueryString({
                          page: page + 1,
                          domain: domainQuery,
                          sortKey,
                          sortOrder,
                        })}`
                  }
                >
                  次へ
                </a>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CompaniesPage(props: CompaniesPageProps) {
  return <CompaniesPageContent {...props} />;
}
