import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactDetail } from "@/lib/contacts";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { EmailCandidatesTable } from "../email-candidates-table";

type ContactDetailPageProps = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export default function ContactDetailPage({ params }: ContactDetailPageProps) {
  const detail = getContactDetail(params.id);

  if (!detail) {
    notFound();
  }

  const { contact, emailCandidates } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={contact.name}
        description={`${contact.companyName} (${contact.companyDomain}) の担当者詳細`}
        actions={
          <Button variant="secondary" asChild>
            <Link href="/contacts">Contacts 一覧に戻る</Link>
          </Button>
        }
      />

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">担当者情報</h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">氏名</dt>
              <dd>{contact.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">ローマ字</dt>
              <dd>
                {contact.firstName} {contact.lastName}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">役職</dt>
              <dd>{contact.position}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">部署</dt>
              <dd>{contact.department}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">部署カテゴリ</dt>
              <dd>{contact.departmentCategory}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">作成日時</dt>
              <dd className="text-xs text-slate-600">
                {contact.createdAt
                  ? new Date(contact.createdAt).toLocaleString("ja-JP")
                  : "-"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">更新日時</dt>
              <dd className="text-xs text-slate-600">
                {contact.updatedAt
                  ? new Date(contact.updatedAt).toLocaleString("ja-JP")
                  : "-"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">会社情報</h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">会社名</dt>
              <dd>{contact.companyName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">ドメイン</dt>
              <dd className="font-mono text-[11px] text-slate-600">
                {contact.companyDomain}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          メールアドレスの候補一覧
        </h2>
        {emailCandidates.length === 0 ? (
          <EmptyState
            title="Email candidates がありません"
            description="score フェーズがまだ実行されていない可能性があります。CLI から score を実行してください。"
          />
        ) : (
          <EmailCandidatesTable emailCandidates={emailCandidates} />
        )}
      </section>
    </div>
  );
}
