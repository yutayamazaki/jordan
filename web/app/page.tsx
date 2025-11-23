import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jordan Lead Intelligence"
        description="Jordan が収集したリード・担当者情報をブラウザから閲覧・検索するための社内向け UI です。"
      />
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-black">
        <Image
          src="/dashboard-hero.jpg"
          alt="営業チームのモチベーションイメージ"
          width={1852}
          height={768}
          priority
          className="h-auto w-full object-cover"
        />
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">All Companies</h2>
          </div>
          <div className="mt-4">
            <Button asChild variant="primary" className="h-8 px-3 text-xs">
              <Link href="/companies">会社一覧を見る</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
            <p className="text-xs text-slate-600">
              担当者情報や送信可能メールアドレスを確認し、アプローチ候補を素早く見つけられます。
            </p>
          </div>
          <div className="mt-4">
            <Button asChild variant="primary" className="h-8 px-3 text-xs">
              <Link href="/contacts">コンタクト一覧を見る</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
