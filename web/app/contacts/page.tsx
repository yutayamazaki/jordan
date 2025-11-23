import Link from "next/link";
import {
  listContacts,
  countContacts,
  type ContactSortField,
  type SortDirection,
  type DeliverableEmailsFilter
} from "@/lib/contacts";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ContactsView } from "./contacts-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export type ContactsPageProps = {
  searchParams?: {
    page?: string;
    sort?: string;
    direction?: string;
    domain?: string;
    emails?: string;
  };
  initialSelectedId?: string | null;
};

export function ContactsPageContent({
  searchParams,
  initialSelectedId
}: ContactsPageProps) {
  const pageSize = 20;

  const sortParam = searchParams?.sort;
  const directionParam = searchParams?.direction;
  const domainParam = searchParams?.domain;
  const emailsParam = searchParams?.emails;

  const sortField: ContactSortField =
    sortParam === "companyName" ||
    sortParam === "companyDomain" ||
    sortParam === "name" ||
    sortParam === "position" ||
    sortParam === "department" ||
    sortParam === "createdAt" ||
    sortParam === "updatedAt"
      ? sortParam
      : "companyDomain";

  const sortDirection: SortDirection =
    directionParam === "desc" ? "desc" : "asc";

  const domainQuery =
    domainParam && domainParam.trim().length > 0 ? domainParam.trim() : undefined;

  const emailsFilter: DeliverableEmailsFilter =
    emailsParam === "with" || emailsParam === "without" ? emailsParam : "with";

  const totalCount = countContacts(domainQuery, emailsFilter);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  let page = Number(searchParams?.page ?? "1");
  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }
  if (page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;

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

  const contacts = listContacts(
    pageSize,
    offset,
    sortField,
    sortDirection,
    domainQuery,
    emailsFilter
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Contacts"
        description=""
        actions={
          <Button asChild variant="secondary">
            <Link
              href={`/api/contacts/export?sort=${sortField}&direction=${sortDirection}${
                domainQuery ? `&domain=${encodeURIComponent(domainQuery)}` : ""
              }&emails=${emailsFilter}`}
              prefetch={false}
            >
              CSVエクスポート
            </Link>
          </Button>
        }
      />
      {contacts.length === 0 ? (
        <EmptyState
          title="Contacts データがありません"
          description="まずは CLI から collect / score を実行して、担当者情報を収集してください。"
        />
      ) : (
        <>
          <ContactsView
            contacts={contacts}
            sortField={sortField}
            sortDirection={sortDirection}
            domainQuery={domainQuery}
            emailsFilter={emailsFilter}
            initialSelectedId={initialSelectedId}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
            <span>
              {totalCount === 0
                ? "0件"
                : `${offset + 1}-${offset + contacts.length} / ${totalCount}件`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                asChild
                disabled={page <= 1}
              >
                <Link
                  href={
                    page <= 1
                      ? `/contacts?sort=${sortField}&direction=${sortDirection}${
                          domainQuery
                            ? `&domain=${encodeURIComponent(domainQuery)}`
                            : ""
                        }&emails=${emailsFilter}`
                      : `/contacts?page=${page - 1}&sort=${sortField}&direction=${sortDirection}${
                          domainQuery
                            ? `&domain=${encodeURIComponent(domainQuery)}`
                            : ""
                        }&emails=${emailsFilter}`
                  }
                >
                  前へ
                </Link>
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
                      const href =
                        `/contacts?page=${targetPage}` +
                        `&sort=${sortField}&direction=${sortDirection}` +
                        (domainQuery
                          ? `&domain=${encodeURIComponent(domainQuery)}`
                          : "") +
                        `&emails=${emailsFilter}`;

                      return (
                        <Button
                          key={targetPage}
                          variant={isCurrent ? "primary" : "secondary"}
                          asChild
                          disabled={isCurrent}
                        >
                          <Link href={href}>{targetPage}</Link>
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
                <Link
                  href={
                    page >= totalPages
                      ? `/contacts?page=${totalPages}&sort=${sortField}&direction=${sortDirection}${
                          domainQuery
                            ? `&domain=${encodeURIComponent(domainQuery)}`
                            : ""
                        }&emails=${emailsFilter}`
                      : `/contacts?page=${page + 1}&sort=${sortField}&direction=${sortDirection}${
                          domainQuery
                            ? `&domain=${encodeURIComponent(domainQuery)}`
                            : ""
                        }&emails=${emailsFilter}`
                  }
                >
                  次へ
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ContactsPage(props: ContactsPageProps) {
  return <ContactsPageContent {...props} />;
}
