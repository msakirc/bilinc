"use client";

import { useEffect, useRef, type RefObject } from "react";
import { isDismissKey } from "@/lib/dismiss";

/**
 * Dismiss an open overlay on outside pointerdown or Escape.
 * Listeners are attached only while `open` is true and removed on cleanup.
 * `onDismiss` may be an inline callback — it's read via a latest-ref, so the
 * listeners are not re-attached on every render.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
): void {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismissRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isDismissKey(e.key)) onDismissRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, open]);
}
