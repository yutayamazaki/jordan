"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/") {
    return [{ label: "ホーム" }];
  }

  if (pathname === "/contacts") {
    return [
      { label: "ホーム", href: "/" },
      { label: "Contacts" }
    ];
  }

  if (pathname.startsWith("/contacts/")) {
    return [
      { label: "ホーム", href: "/" },
      { label: "Contacts", href: "/contacts" },
      { label: "詳細" }
    ];
  }

  if (pathname === "/companies") {
    return [
      { label: "ホーム", href: "/" },
      { label: "Companies" }
    ];
  }

  if (pathname.startsWith("/companies/")) {
    return [
      { label: "ホーム", href: "/" },
      { label: "Companies", href: "/companies" },
      { label: "詳細" }
    ];
  }

  return [{ label: "ホーム", href: "/" }];
}

export function AppHeader() {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <li
                key={`${item.label}-${index}`}
                className="flex items-center gap-1"
              >
                {!isLast && item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-slate-700 hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "font-medium text-slate-700" : ""}
                  >
                    {item.label}
                  </span>
                )}
                {!isLast && <span className="text-slate-400">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
        <span className="font-medium text-slate-700">
          Jordan Lead Intelligence
        </span>
      </div>
    </header>
  );
}
