export function StatCounter({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif font-semibold text-2xl text-bilinc-text">{value}</div>
      <div className="text-xs text-bilinc-text-tertiary mt-0.5">{label}</div>
    </div>
  );
}
