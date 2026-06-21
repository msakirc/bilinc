/** True when a keydown event's key should dismiss an open overlay. */
export function isDismissKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}
