// hooks/useOutline.ts
import { useMemo } from "react";
import type { Heading } from "../core/outlineParser";
import { parseOutline } from "../core/outlineParser";

export function useOutline(markdown: string): Heading[] {
  return useMemo(() => parseOutline(markdown), [markdown]);
}