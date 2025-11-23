"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

type CompanyOption = {
  id: string;
  name: string;
  domain: string | null;
};

type CompanySearchSelectProps = {
  name?: string;
  initialCompanyId?: string;
  onChange?: (companyId: string | null) => void;
};

export function CompanySearchSelect({
  name = "companyId",
  initialCompanyId,
  onChange
}: CompanySearchSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentValue, setCurrentValue] = useState(initialCompanyId ?? "");
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [selected, setSelected] = useState<CompanyOption | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentValue(initialCompanyId ?? "");
    setSelected(null);
    if (!initialCompanyId) {
      setSearchValue("");
    }
  }, [initialCompanyId]);

  useEffect(() => {
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();

      if (searchTerm.trim().length > 0) {
        params.set("query", searchTerm.trim());
      }

      if (selected?.id) {
        params.set("companyId", selected.id);
      } else if (initialCompanyId) {
        params.set("companyId", initialCompanyId);
      }

      params.set("limit", "20");

      setLoading(true);
      setError(null);

      fetch(`/api/companies?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Failed to fetch companies");
          }
          return res.json() as Promise<{ companies: CompanyOption[] }>;
        })
        .then((data) => {
          setOptions(data.companies ?? []);

          if (
            !selected &&
            initialCompanyId &&
            searchTerm.trim().length === 0
          ) {
            const found = data.companies?.find((c) => c.id === initialCompanyId);
            if (found) {
              setSelected(found);
              setSearchValue(found.name);
              setSearchTerm(found.name);
              setCurrentValue(found.id);
            }
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Failed to fetch companies");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [searchTerm, initialCompanyId, selected?.id]);

  const handleSelect = (option: CompanyOption) => {
    setSelected(option);
    setSearchValue(option.name);
    setSearchTerm(option.name);
    setCurrentValue(option.id);
    onChange?.(option.id);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setSearchValue("");
    setSearchTerm("");
    setCurrentValue("");
    onChange?.(null);
    setOpen(false);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative" onBlur={handleBlur} onFocus={handleFocus}>
      <input
        type="search"
        value={searchValue}
        onChange={(event) => {
          setSearchValue(event.target.value);
          setSearchTerm(event.target.value);
          setSelected(null);
          setCurrentValue("");
          setOpen(true);
        }}
        placeholder="会社名を検索・選択"
        className="h-8 w-72 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        autoComplete="off"
      />
      {currentValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-2 my-auto inline-flex h-6 items-center justify-center rounded-md px-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          クリア
        </button>
      ) : null}
      <input
        type="hidden"
        name={name}
        value={currentValue}
      />
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>会社名を検索</span>
            {loading && <Spinner size="sm" />}
          </div>
          {error ? (
            <p className="px-3 py-2 text-xs text-rose-600">{error}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              一致する会社がありません
            </p>
          ) : (
            <ul className="py-1">
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(option)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <span className="text-slate-900">{option.name}</span>
                    <span className="text-xs text-slate-500">
                      {option.domain ?? "ドメイン未登録"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
