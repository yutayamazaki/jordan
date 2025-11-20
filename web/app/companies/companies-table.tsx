"use client";

import { useRouter } from "next/navigation";
import { FiExternalLink } from "react-icons/fi";
import type { CompanyListItem } from "@/lib/companies";

type CompaniesTableProps = {
  companies: CompanyListItem[];
};

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const router = useRouter();

  const handleRowClick = (domain: string) => {
    router.push(`/contacts?domain=${encodeURIComponent(domain)}`);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-sm text-slate-900">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              会社名
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              ドメイン
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              Webサイト
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contacts 数
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              作成日時
            </th>
            <th className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
              更新日時
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((co) => (
            <tr
              key={co.id}
              className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/60"
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(co.domain)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleRowClick(co.domain);
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
  );
}
