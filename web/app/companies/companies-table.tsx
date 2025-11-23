"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiExternalLink, FiCopy } from "react-icons/fi";
import type {
  CompanyListItem,
  CompanySortKey,
  SortOrder,
} from "@/lib/companies";

const formatDate = (value: number | null) =>
  value ? new Date(value).toLocaleDateString("ja-JP") : "-";

type CompanyDetail = {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
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
  industries?: string[];
  initialSelectedId?: string | null;
};

export function CompaniesTable({
  companies,
  sortKey,
  sortOrder,
  domainQuery,
  industries,
  initialSelectedId,
}: CompaniesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [rowLogoErrors, setRowLogoErrors] = useState<Record<string, boolean>>({});
  const selectedCompany =
    companies.find((company) => company.id === selectedId) ?? null;
  const exportDomain =
    detail?.domains?.[0]?.domain ?? selectedCompany?.domain ?? null;
  const exportHref = exportDomain
    ? `/api/contacts/export?domain=${encodeURIComponent(exportDomain)}`
    : null;

  useEffect(() => {
    setSelectedId(initialSelectedId ?? null);
  }, [initialSelectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const existsInList = companies.some((c) => c.id === selectedId);

    // When the side peek is opened via URL (initialSelectedId), keep it open
    // even if the selected company is not part of the current page of results.
    if (existsInList || initialSelectedId) return;

    setSelectedId(null);
    setDetail(null);
    setError(null);
  }, [companies, selectedId, initialSelectedId]);

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

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(email);
      setTimeout(() => {
        setCopiedEmail((prev) => (prev === email ? null : prev));
      }, 1500);
    });
  };

  const handleSort = (nextKey: CompanySortKey) => {
    const nextOrder: SortOrder =
      sortKey === nextKey && sortOrder === "asc" ? "desc" : "asc";

    const params = new URLSearchParams(searchParams.toString());
    if (domainQuery) {
      params.set("domain", domainQuery);
    } else {
      params.delete("domain");
    }
    params.delete("industries");
    if (industries && industries.length > 0) {
      industries.forEach((ind) => params.append("industries", ind));
    }
    params.set("sort", nextKey);
    params.set("order", nextOrder);
    params.delete("page");

    const basePath = selectedId ? `/companies/${selectedId}` : "/companies";
    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
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

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    const queryString = searchParams.toString();
    const basePath = id ? `/companies/${id}` : "/companies";
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  useEffect(() => {
    setLogoError(false);
  }, [selectedId, detail?.logoUrl]);

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
                onClick={() => handleSort("industry")}
                className="flex items-center gap-1"
              >
                <span>業種</span>
                {renderSortIndicator("industry")}
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
                <span>メール数</span>
                {renderSortIndicator("contactCount")}
              </button>
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              <button
                type="button"
                onClick={() => handleSort("updatedAt")}
                className="flex items-center gap-1"
              >
                <span>更新日</span>
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
              onClick={() => handleSelect(co.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelect(co.id);
                }
              }}
            >
              <td className="px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {co.logoUrl && !rowLogoErrors[co.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={co.logoUrl}
                      alt={`${co.name} logo`}
                      className="h-8 w-8 rounded-md bg-white object-contain ring-1 ring-slate-200"
                      onError={() =>
                        setRowLogoErrors((prev) => ({ ...prev, [co.id]: true }))
                      }
                    />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-200 text-xs font-semibold uppercase text-slate-600">
                      {co.name.slice(0, 1)}
                    </span>
                  )}
                  <span>{co.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-sm text-slate-600">
                {co.domain}
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">
                {co.industry ?? "-"}
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
                {formatDate(co.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {selectedId && (
        <div className="fixed inset-y-0 right-0 z-30 w-[560px] max-w-full border-l border-slate-200 bg-white/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Company Info</h3>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              閉じる
            </button>
          </div>
          <div className="flex h-[calc(100%-56px)] flex-col px-4 py-3 text-sm">
                {loading ? (
                  <p className="text-slate-500">読み込み中...</p>
                ) : error ? (
                  <p className="text-rose-600">{error}</p>
                ) : detail ? (
                  <>
                    <div className="space-y-3">
                      <section className="flex items-start gap-3">
                    {detail.logoUrl && !logoError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detail.logoUrl}
                        alt={`${detail.name} logo`}
                        className="h-12 w-12 rounded-md bg-white object-contain ring-1 ring-slate-200"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-200 text-sm font-semibold uppercase text-slate-600">
                        {detail.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1">
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
                  </section>
                  <section className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                    <div className="col-span-2">
                      <p className="font-semibold text-slate-600">Webサイト</p>
                      {detail.websiteUrl ? (
                        <a
                          href={detail.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-slate-800 hover:underline"
                        >
                          <span>{detail.websiteUrl}</span>
                          <FiExternalLink aria-hidden="true" className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="text-slate-400">-</p>
                      )}
                      <div className="mt-3">
                        <p className="font-semibold text-slate-600">業種</p>
                        <p className="text-slate-800">{detail.industry ?? "-"}</p>
                      </div>
                      {exportHref && (
                        <div className="mt-4">
                          <a
                            href={exportHref}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                          >
                            CSVエクスポート
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="font-semibold text-slate-600">想定されるメールアドレスの形式</p>
                      {detail.domains.length === 0 ? (
                        <p className="text-slate-400">-</p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-sm">
                          {detail.domains.map((d) => (
                            <li
                              key={d.id}
                              className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1"
                            >
                              <span className="text-slate-800">
                                {d.pattern ? `${d.pattern}@${d.domain}` : "-"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </div>

                <section className="mt-4 flex-1 overflow-hidden rounded-md border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Emails
                    </p>
                    <span className="text-[11px] text-slate-500">
                      {detail.emails.length}件
                    </span>
                  </div>
                  <div className="max-h-full space-y-2 overflow-y-auto px-3 py-3">
                    {detail.emails.length === 0 ? (
                      <p className="text-sm text-slate-500">なし</p>
                    ) : (
                      detail.emails.map((e) => (
                        <div
                          key={e.id}
                          className="rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-800"
                        >
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                            {e.contactName && <span>{e.contactName}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{e.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(e.email)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                                aria-label={`${e.email} をコピー`}
                              >
                                <FiCopy className="h-3 w-3" aria-hidden />
                              </button>
                            </div>
                          <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-500 ring-1 ring-green-500">
                            {e.status}
                          </span>
                        </div>
                        {copiedEmail === e.email && (
                          <p className="mt-1 text-xs text-emerald-600">Copied!</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          {e.contactPosition && (
                            <span className="text-slate-500">
                              {e.contactPosition}
                            </span>
                          )}
                          {e.domain && <span className="font-mono">{e.domain}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </section>
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
