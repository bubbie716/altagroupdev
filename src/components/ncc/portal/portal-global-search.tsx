"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { fetchPortalSearch } from "@/lib/ncc/ncc-portal.functions";
import type { PortalSearchResult } from "@/lib/ncc/portal-types";

export function PortalGlobalSearch() {
  const search = useServerFn(fetchPortalSearch);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PortalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      void search({ data: { q } })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [q, search]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <label className="sr-only" htmlFor={listId}>
        Search institution portal
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#9ca3af]" />
        <input
          id={listId}
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search settlements, routing, members…"
          className="h-9 w-full rounded-sm border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-[13px] text-[#111827] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#0c4d32]/40 focus:bg-white"
          autoComplete="off"
        />
      </div>
      {open && q.trim().length >= 2 ? (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-sm border border-[#e5e7eb] bg-white py-1 shadow-md"
        >
          {loading ? (
            <div className="px-3 py-4 text-[12px] text-[#6b7280]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-[#6b7280]">No matches</div>
          ) : (
            results.map((result) => (
              <Link
                key={`${result.kind}-${result.id}`}
                to={result.href as "/portal"}
                role="option"
                className="block px-3 py-2 hover:bg-[#f9fafb]"
                onClick={() => setOpen(false)}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af]">
                  {result.kind}
                </div>
                <div className="text-[13px] font-medium text-[#111827]">{result.title}</div>
                <div className="text-[11px] text-[#6b7280]">{result.subtitle}</div>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
