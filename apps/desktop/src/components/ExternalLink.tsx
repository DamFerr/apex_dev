import { Copy, ExternalLink as ExternalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "../lib/toast";

/**
 * A link to a page outside Apex. It opens in a new tab with `noopener noreferrer`, says so in its tooltip and for screen readers, and has a
 * "Copy link" button next to it: a desktop webview may not hand a new-tab request to the system browser, and copying always works.
 */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  const copy = async () => { try { await navigator.clipboard.writeText(href); toast("Link copied"); } catch { toast("Could not copy the link", "error"); } };
  return (<span className="inline-flex items-center gap-1 align-middle">
    <a href={href} target="_blank" rel="noopener noreferrer" title={`Opens ${host} in your browser`} className="focus-ring inline-flex items-center gap-1 rounded underline hover:text-text">
      {children}<ExternalIcon size={12} aria-hidden /><span className="sr-only"> (opens {host} in your browser)</span></a>
    <button type="button" onClick={copy} title="Copy link" aria-label={`Copy link to ${host}`} className="focus-ring rounded p-1 text-muted hover:text-text"><Copy size={12} aria-hidden /></button>
  </span>);
}
