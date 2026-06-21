"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface SearchBarProps {
  placeholder?: string;
  defaultValue?: string;
  onSearch: (query: string) => void;
  suggestions?: { id: string; name: string; subtitle?: string }[];
  onSuggestionClick?: (id: string) => void;
  debounceMs?: number;
  size?: "md" | "lg";
}

export function SearchBar({ placeholder, defaultValue = "", onSearch, suggestions, onSuggestionClick, debounceMs = 300, size = "md" }: SearchBarProps) {
  const { t } = useTranslation("common");
  const resolvedPlaceholder = placeholder ?? `${t("actions.search")}...`;
  const [query, setQuery] = useState(defaultValue);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(query), debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, debounceMs, onSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const sizeClasses = size === "lg" ? "px-5 py-4 text-lg" : "px-4 py-2.5 text-sm";

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bilinc-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={resolvedPlaceholder}
          className={`w-full ${sizeClasses} pl-10 bg-bilinc-input text-bilinc-text placeholder:text-bilinc-text-tertiary rounded-xl border border-bilinc-border focus:outline-none focus:ring-2 focus:ring-bilinc-primary/30 focus:border-bilinc-primary transition`}
        />
      </div>
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-bilinc-surface border border-bilinc-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => { onSuggestionClick?.(s.id); setShowSuggestions(false); }}
              className="w-full px-4 py-3 text-left hover:bg-bilinc-surface-secondary transition flex flex-col"
            >
              <span className="text-sm font-medium text-bilinc-text">{s.name}</span>
              {s.subtitle && <span className="text-xs text-bilinc-text-tertiary">{s.subtitle}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
