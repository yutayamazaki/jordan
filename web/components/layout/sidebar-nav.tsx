"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiUsers, FiBriefcase, FiLayout } from "react-icons/fi";

function navLinkClass(base: string, active: boolean): string {
  if (active) {
    return `${base} bg-slate-200 text-slate-900 hover:bg-slate-200`;
  }

  return `${base} text-slate-900 hover:bg-slate-100 hover:text-slate-900`;
}

export function SidebarNav() {
  const pathname = usePathname();

  const baseLinkClass = "rounded-md px-3 py-3 flex items-center gap-2";

  const isDashboard = pathname === "/";
  const isContacts = pathname.startsWith("/contacts");
  const isCompanies = pathname.startsWith("/companies");

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-56 flex-col border-r bg-white px-4 py-4">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="rounded-md bg-slate-900 w-full px-3 py-3 font-semibold text-white">
          Jordan
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        <Link
          href="/"
          className={navLinkClass(baseLinkClass, isDashboard)}
        >
          <FiLayout className="h-4 w-4" aria-hidden />
          ダッシュボード
        </Link>
        <Link
          href="/contacts"
          className={navLinkClass(baseLinkClass, isContacts)}
        >
          <FiUsers className="h-4 w-4" aria-hidden />
          コンタクト
        </Link>
        <Link
          href="/companies"
          className={navLinkClass(baseLinkClass, isCompanies)}
        >
          <FiBriefcase className="h-4 w-4" aria-hidden />
          会社
        </Link>
      </nav>
    </aside>
  );
}
