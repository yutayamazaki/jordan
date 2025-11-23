"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ContactListItem,
  ContactSortField,
  SortDirection,
  DeliverableEmailsFilter,
  ContactDetail
} from "@/lib/contacts";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "./contacts-table";
import { EmailCandidatesTable } from "./email-candidates-table";

type ContactsViewProps = {
  contacts: ContactListItem[];
  sortField: ContactSortField;
  sortDirection: SortDirection;
  domainQuery?: string;
  emailsFilter: DeliverableEmailsFilter;
  initialSelectedId?: string | null;
};

export function ContactsView({
  contacts,
  sortField,
  sortDirection,
  domainQuery,
  emailsFilter,
  initialSelectedId
}: ContactsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null
  );
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setSelectedId(initialSelectedId ?? null);
  }, [initialSelectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const existsInList = contacts.some((c) => c.id === selectedId);

    // When opened via URL (initialSelectedId), keep the side peek open even if
    // the contact is not part of the current page of results.
    if (existsInList || initialSelectedId) return;

    setSelectedId(null);
    setDetail(null);
    setError(null);
  }, [contacts, selectedId, initialSelectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/contact?contactId=${encodeURIComponent(selectedId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch contact detail");
        }
        return res.json() as Promise<ContactDetail>;
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

  const formatDate = (value: number | null) =>
    value ? new Date(value).toLocaleDateString("ja-JP") : "-";

  const handleSelect = (id: string | null) => {
    setSelectedId(id);

    const queryString = searchParams.toString();
    const basePath = id ? `/contacts/${id}` : "/contacts";
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  useEffect(() => {
    setLogoError(false);
  }, [selectedId, detail?.contact.companyLogoUrl]);

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
            <option value="with">送信可能メール: あり</option>
            <option value="without">送信可能メール: なし</option>
          </select>
          <input type="hidden" name="sort" value={sortField} />
          <input type="hidden" name="direction" value={sortDirection} />
          <Button type="submit" variant="secondary">
            検索
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <ContactsTable
          contacts={contacts}
          sortField={sortField}
          sortDirection={sortDirection}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
      {selectedId && (
        <div className="fixed inset-y-0 right-0 z-30 w-[560px] max-w-full border-l border-slate-200 bg-white/95 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Contact Info</h3>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              閉じる
            </button>
          </div>
          <div className="flex h-[calc(100%-56px)] flex-col overflow-y-auto px-4 py-3 text-sm">
            {loading ? (
              <p className="text-slate-500">読み込み中...</p>
            ) : error ? (
              <p className="text-rose-600">{error}</p>
                ) : detail ? (
                  <>
                    <section className="space-y-2">
                      <div className="flex items-start gap-3">
                    {detail.contact.companyLogoUrl && !logoError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detail.contact.companyLogoUrl}
                        alt={`${detail.contact.companyName} logo`}
                        className="h-12 w-12 rounded-md bg-white object-contain ring-1 ring-slate-200"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-200 text-sm font-semibold uppercase text-slate-600">
                        {detail.contact.companyName.slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500">氏名</p>
                      <p className="text-base font-semibold text-slate-900">
                        {detail.contact.name}
                      </p>
                      <p className="text-[13px] text-slate-600">
                        {detail.contact.companyName}
                        {detail.contact.companyDomain && (
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            {detail.contact.companyDomain}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        役職
                      </p>
                      <p>{detail.contact.position ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        部署
                      </p>
                      <p>{detail.contact.department ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        作成日
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatDate(detail.contact.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        更新日
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatDate(detail.contact.updatedAt)}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      メール候補
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {detail.emailCandidates.length}件
                    </span>
                  </div>
                  {detail.emailCandidates.length === 0 ? (
                    <p className="text-sm text-slate-500">メール候補がありません</p>
                  ) : (
                    <EmailCandidatesTable emailCandidates={detail.emailCandidates} />
                  )}
                </section>
              </>
            ) : (
              <p className="text-sm text-slate-500">担当者を選択してください</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
