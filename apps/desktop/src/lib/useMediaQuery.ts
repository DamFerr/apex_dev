import { useEffect, useState } from "react";

/** True while the window matches the CSS media query; follows resizes. False where `matchMedia` does not exist (tests). */
export function useMediaQuery(query: string): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => supported && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(query), on = () => setMatches(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query, supported]);
  return matches;
}
