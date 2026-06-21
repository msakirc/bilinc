"use client";
export function FilterTabs<T extends string>({ tabs, value, onChange, testid }: {
  tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void; testid?: (key: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-5" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={testid?.(tab.key)}
            onClick={() => onChange(tab.key)}
            className={
              active
                ? "px-3.5 py-1.5 rounded-full text-sm font-medium bg-bilinc-primary text-white"
                : "px-3.5 py-1.5 rounded-full text-sm font-medium text-bilinc-text-secondary hover:text-bilinc-text hover:bg-bilinc-surface-secondary transition"
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
