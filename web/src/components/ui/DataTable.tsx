import type { ReactNode } from "react";

export function DataTable({ headers, children, testid }: { headers: string[]; children: ReactNode; testid?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-bilinc-border">
      <table className="w-full text-sm" data-testid={testid}>
        <thead className="bg-bilinc-surface-secondary text-bilinc-text-tertiary text-xs uppercase tracking-wide">
          <tr>{headers.map((h) => <th key={h} className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-bilinc-border">{children}</tbody>
      </table>
    </div>
  );
}
