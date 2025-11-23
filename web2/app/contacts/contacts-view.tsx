"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { FiCopy } from "react-icons/fi";
import type {
  ContactListItem,
  ContactSortField,
  SortDirection,
  DeliverableEmailsFilter
} from "@/lib/contacts";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "./contacts-table";

type ContactsViewProps = {
  contacts: ContactListItem[];
  sortField: ContactSortField;
  sortDirection: SortDirection;
  domainQuery?: string;
  emailsFilter: DeliverableEmailsFilter;
};

type ViewMode = "table" | "card";

export function ContactsView({
  contacts,
  sortField,
  sortDirection,
  domainQuery,
  emailsFilter
}: ContactsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopy = async (
    event: MouseEvent<HTMLButtonElement>,
    email: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      window.setTimeout(() => {
        setCopiedEmail((current) => (current === email ? null : current));
      }, 1500);
    } catch (error) {
      console.error("Failed to copy email to clipboard", error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 justify-between md:flex-row md:items-center">
        <form
          action="/contacts"
          method="get"
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            name="domain"
            defaultValue={domainQuery ?? ""}
            placeholder="会社名・ドメイン・役職・部署"
            className="h-8 w-64 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          <select
            name="emails"
            defaultValue={emailsFilter}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <option value="all">送信可能メール: すべて</option>
            <option value="with">送信可能メール: あり</option>
            <option value="without">送信可能メール: なし</option>
          </select>
          <input type="hidden" name="sort" value={sortField} />
          <input type="hidden" name="direction" value={sortDirection} />
          <Button type="submit" variant="secondary">
            検索
          </Button>
        </form>

        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-slate-500">表示形式</span>
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <Button
              type="button"
              variant={viewMode === "table" ? "primary" : "ghost"}
              className="h-7 px-3 py-0 text-xs"
              onClick={() => setViewMode("table")}
            >
              テーブル
            </Button>
            <Button
              type="button"
              variant={viewMode === "card" ? "primary" : "ghost"}
              className="h-7 px-3 py-0 text-xs"
              onClick={() => setViewMode("card")}
            >
              カード
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {viewMode === "table" ? (
          <ContactsTable
            contacts={contacts}
            sortField={sortField}
            sortDirection={sortDirection}
          />
        ) : (
          <div className="p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((c) => {
              const emails =
                c.deliverableEmails
                  ?.split("\n")
                  .map((email) => email.trim())
                  .filter((email) => email.length > 0) ?? [];

              return (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      {c.companyFaviconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.companyFaviconUrl}
                          alt=""
                          className="h-6 w-6 rounded-sm"
                        />
                      ) : (
                        <span className="inline-block h-6 w-6 rounded-sm bg-slate-200" />
                      )}
                      <div className="text-xs font-semibold tracking-wide text-slate-500">
                        {c.companyName}
                      </div>
                    </div>
                    <div className="font-mono text-xs text-slate-600">
                      {c.companyDomain}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="text-sm font-medium text-slate-900">
                      {c.name}
                    </div>
                    <div className="text-xs text-slate-600">{c.position}</div>
                    <div className="text-xs text-slate-600">{c.department}</div>
                  </div>
                  <div className="mb-2 space-y-0.5 text-[11px] text-slate-500">
                    <div>
                      <span className="inline-block w-14">作成</span>
                      <span>
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleString("ja-JP")
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-14">更新</span>
                      <span>
                        {c.updatedAt
                          ? new Date(c.updatedAt).toLocaleString("ja-JP")
                          : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto pt-2 text-xs text-slate-600">
                    <div className="mb-1 font-semibold text-slate-700">
                      送信可能メール
                    </div>
                    {emails.length === 0 ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {emails.map((email) => (
                          <li
                            key={email}
                            className="flex items-center gap-2 font-mono text-[11px]"
                          >
                            <span className="truncate">{email}</span>
                            <button
                              type="button"
                              onClick={(event) => handleCopy(event, email)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-transparent p-0 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="sr-only">
                                メールアドレスをコピー
                              </span>
                              <FiCopy
                                aria-hidden="true"
                                className="h-3 w-3"
                              />
                            </button>
                            {copiedEmail === email && (
                              <span className="text-[11px] text-emerald-600">
                                Copied
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
