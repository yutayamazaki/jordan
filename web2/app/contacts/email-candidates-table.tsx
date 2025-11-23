"use client";

import { useState } from "react";
import { FiCopy } from "react-icons/fi";
import type { EmailCandidateListItem } from "@/lib/contacts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type EmailCandidatesTableProps = {
  emailCandidates: EmailCandidateListItem[];
};

export function EmailCandidatesTable({
  emailCandidates
}: EmailCandidatesTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1500);
    } catch (error) {
      console.error("Failed to copy email to clipboard", error);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>メール</TableHead>
            <TableHead>Email Hippo</TableHead>
            <TableHead>信頼性</TableHead>
            <TableHead>判定理由</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emailCandidates.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-sm text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="truncate">{e.email}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(e.id, e.email)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-transparent p-0 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="sr-only">メールアドレスをコピー</span>
                    <FiCopy aria-hidden="true" className="h-4 w-4" />
                  </button>
                  {copiedId === e.id && (
                    <span className="text-xs text-emerald-600">Copied</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {e.isDeliverable == null ? (
                  "-"
                ) : (
                  <Badge variant={e.isDeliverable ? "success" : "destructive"}>
                    {e.isDeliverable ? "送信可能" : "送信不可"}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {e.confidence.toFixed(2)}
              </TableCell>
              <TableCell className="text-sm">
                {e.verificationReason ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
