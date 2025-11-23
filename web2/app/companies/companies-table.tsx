"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiExternalLink } from "react-icons/fi";
import type {
  CompanyListItem,
  CompanySortKey,
  SortOrder,
} from "@/lib/companies";

type CompanyDetail = {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  employeeRange: string | null;
  domains: {
    id: string;
    domain: string;
    disposable: boolean;
    webmail: boolean;
    acceptAll: boolean;
    pattern: string | null;
  }[];
  emails: {
    id: string;
    email: string;
    kind: string | null;
    status: string;
    isPrimary: boolean;
    source: string | null;
    confidence: number | null;
    contactId: string | null;
    contactName: string | null;
    contactPosition: string | null;
    domain: string | null;
    updatedAt: number | null;
  }[];
};

type CompaniesTableProps = {
  companies: CompanyListItem[];
  sortKey: CompanySortKey;
  sortOrder: SortOrder;
  domainQuery?: string;
};

export function CompaniesTable({
  companies,
  sortKey,
  sortOrder,
  domainQuery,
}: CompaniesTableProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/company?companyId=${encodeURIComponent(selectedId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch company detail");
        }
        return res.json() as Promise<CompanyDetail>;
      })
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSort = (nextKey: CompanySortKey) => {
    const nextOrder: SortOrder =
      sortKey === nextKey && sortOrder === "asc" ? "desc" : "asc";

    const params = new URLSearchParams();
    if (domainQuery) {
      params.set("domain", domainQuery);
    }
    params.set("sort", nextKey);
    params.set("order", nextOrder);

    const queryString = params.toString();
    router.push(queryString ? `/companies?${queryString}` : "/companies");
  };

  const renderSortIndicator = (key: CompanySortKey) => {
    if (sortKey !== key) {
      return <span className="text-slate-400">↕</span>;
    }
    return (
      <span className="text-slate-600">
        {sortOrder === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm text-slate-900">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("name")}
                className="flex items-center gap-1"
              >
                <span>会社名</span>
                {renderSortIndicator("name")}
              </button>
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("domain")}
                className="flex items-center gap-1"
              >
                <span>ドメイン</span>
                {renderSortIndicator("domain")}
              </button>
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("websiteUrl")}
                className="flex items-center gap-1"
              >
                <span>Webサイト</span>
                {renderSortIndicator("websiteUrl")}
              </button>
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("contactCount")}
                className="flex items-center gap-1"
              >
                <span>Contacts 数</span>
                {renderSortIndicator("contactCount")}
              </button>
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("createdAt")}
                className="flex items-center gap-1"
              >
                <span>作成日時</span>
                {renderSortIndicator("createdAt")}
              </button>
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("updatedAt")}
                className="flex items-center gap-1"
              >
                <span>更新日時</span>
                {renderSortIndicator("updatedAt")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((co) => (
            <tr
              key={co.id}
              className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/60 ${
                selectedId === co.id ? "bg-slate-100" : ""
              }`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(co.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(co.id);
                }
              }}
            >
              <td className="px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {co.faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={co.faviconUrl}
                      alt=""
                      className="h-6 w-6 rounded-sm"
                    />
                  ) : (
                    <span className="inline-block h-6 w-6 rounded-sm bg-slate-200" />
                  )}
                  <span>{co.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-sm text-slate-600">
                {co.domain}
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">
                {co.websiteUrl ? (
                  <a
                    href={co.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-slate-700 hover:underline"
                  >
                    <span>{co.websiteUrl}</span>
                    <FiExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">
                {co.contactCount}
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">
                {co.createdAt
                  ? new Date(co.createdAt).toLocaleString("ja-JP")
                  : "-"}
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">
                {co.updatedAt
                  ? new Date(co.updatedAt).toLocaleString("ja-JP")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {selectedId && (
        <div className="fixed inset-y-0 right-0 z-30 w-[420px] max-w-full border-l border-slate-200 bg-white/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Company Info</h3>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              閉じる
            </button>
          </div>
          <div className="h-[calc(100%-56px)] space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {loading ? (
              <p className="text-slate-500">読み込み中...</p>
            ) : error ? (
              <p className="text-rose-600">{error}</p>
            ) : detail ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    会社名
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {detail.name}
                  </p>
                  {detail.description && (
                    <p className="mt-1 text-sm text-slate-700">
                      {detail.description}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <p className="font-semibold text-slate-600">国</p>
                    <p>{detail.country ?? "-"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">都市</p>
                    <p>{detail.city ?? "-"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">業種</p>
                    <p>{detail.industry ?? "-"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-600">従業員規模</p>
                    <p>{detail.employeeRange ?? "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Domains
                  </p>
                  <div className="mt-1 space-y-1">
                    {detail.domains.length === 0 ? (
                      <p className="text-sm text-slate-500">なし</p>
                    ) : (
                      detail.domains.map((d) => (
                        <div
                          key={d.id}
                          className="rounded-md border border-slate-200 px-2 py-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-slate-800">
                              {d.domain}
                            </span>
                            <div className="flex items-center gap-1 text-[11px]">
                              {d.disposable && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                                  disposable
                                </span>
                              )}
                              {d.webmail && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                                  webmail
                                </span>
                              )}
                              {d.acceptAll && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                                  acceptAll
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            pattern: {d.pattern ?? "-"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Emails
                  </p>
                  <div className="mt-1 space-y-2">
                    {detail.emails.length === 0 ? (
                      <p className="text-sm text-slate-500">なし</p>
                    ) : (
                      detail.emails.map((e) => (
                        <div
                          key={e.id}
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-800"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[12px]">{e.email}</span>
                            <span className="text-[11px] text-slate-500">
                              {e.status}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                            {e.contactName && <span>{e.contactName}</span>}
                            {e.contactPosition && (
                              <span className="text-slate-500">
                                / {e.contactPosition}
                              </span>
                            )}
                            {e.domain && <span className="font-mono">{e.domain}</span>}
                            {e.kind && <span>{e.kind}</span>}
                            {e.isPrimary && (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white">
                                primary
                              </span>
                            )}
                            {typeof e.confidence === "number" && (
                              <span>conf: {e.confidence}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">会社を選択してください</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
