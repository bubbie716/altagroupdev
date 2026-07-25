"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchTerminalSymbols } from "@/lib/terminal/terminal.functions";
import type { SecuritySummary } from "@/lib/terminal/types";

/** Debounced Terminal symbol search shared by header search and Quick Trade. */
export function useSymbolSearch(debounceMs = 180) {
  const searchFn = useServerFn(searchTerminalSymbols);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SecuritySummary[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchFn({ data: query })
        .then((rows) => setResults(rows.slice(0, 8)))
        .catch(() => setResults([]));
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [query, searchFn, debounceMs]);

  function clear() {
    setQuery("");
    setResults([]);
  }

  return { query, setQuery, results, clear };
}
