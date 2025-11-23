"use client";

import { useState, type MouseEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FiCopy } from "react-icons/fi";
import type {
  ContactListItem,
  ContactSortField,
  SortDirection
} from "@/lib/contacts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const formatDate = (value: number | null) =>
  value ? new Date(value).toLocaleDateString("ja-JP") : "-";

type ContactsTableProps = {
  contacts: ContactListItem[];
  sortField: ContactSortField;
  sortDirection: SortDirection;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ContactsTable({
  contacts,
  sortField,
  sortDirection,
  selectedId,
  onSelect
}: ContactsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [rowLogoErrors, setRowLogoErrors] = useState<Record<string, boolean>>({});

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>, email: string) => {
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

  const handleSort = (field: ContactSortField) => {
    const isSameField = sortField === field;
    const nextDirection: SortDirection =
      isSameField && sortDirection === "asc" ? "desc" : "asc";

    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", field);
    params.set("direction", nextDirection);
    params.set("page", "1");

    router.push(`${pathname}?${params.toString()}`);
  };

  const renderSortIndicator = (field: ContactSortField) => {
    if (sortField !== field) {
      return <span className="text-slate-400">↕</span>;
    }
    return (
      <span className="text-slate-600">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const renderHeader = (label: string, field: ContactSortField) => {
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-500 hover:text-slate-700"
      >
        <span>{label}</span>
        {renderSortIndicator(field)}
      </button>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{renderHeader("氏名", "name")}</TableHead>
          <TableHead>{renderHeader("会社名", "companyName")}</TableHead>
          <TableHead>メール</TableHead>
          <TableHead>{renderHeader("作成日", "createdAt")}</TableHead>
          <TableHead>{renderHeader("更新日", "updatedAt")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((c) => {
          const emails =
            c.deliverableEmails?.split("\n").filter((email) => email.trim().length > 0) ?? [];

          return (
            <TableRow
              key={c.id}
              className={`cursor-pointer ${selectedId === c.id ? "bg-slate-100" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(c.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(c.id);
                }
              }}
            >
              <TableCell>
                {c.name}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {c.companyLogoUrl && !rowLogoErrors[c.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.companyLogoUrl}
                      alt={`${c.companyName} logo`}
                      className="h-7 w-7 rounded-md bg-white object-contain ring-1 ring-slate-200"
                      onError={() =>
                        setRowLogoErrors((prev) => ({ ...prev, [c.id]: true }))
                      }
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-[11px] font-semibold uppercase text-slate-600">
                      {c.companyName.slice(0, 1)}
                    </span>
                  )}
                  <span>{c.companyName}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {emails.length === 0 ? (
                  "-"
                ) : (
                  <div className="flex flex-col gap-1">
                    {emails.map((email) => (
                      <div key={email} className="flex items-center gap-2">
                        <span className="truncate">{email}</span>
                        <button
                          type="button"
                          onClick={(event) => handleCopy(event, email)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="sr-only">メールアドレスをコピー</span>
                          <FiCopy aria-hidden="true" className="h-4 w-4" />
                        </button>
                        {copiedEmail === email && (
                          <span className="text-xs text-emerald-600">Copied</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-600">
                {formatDate(c.createdAt)}
              </TableCell>
              <TableCell className="text-xs text-slate-600">
                {formatDate(c.updatedAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
