export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-[1180px] mx-auto px-4 sm:px-6 ${className}`.trim()}>{children}</div>;
}
