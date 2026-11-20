import { useState } from "react";
import type { Role } from "@apex/schema";
import { Chip } from "../components/ui";
import { RoleIcon } from "../components/RoleIcon";
import { LengthPanel } from "./LengthPanel";
import { PatchPanel } from "./PatchPanel";

/**
 * Patch history (left) and win rate by game length (right) of one champion in one panel, sharing one role switch. Below the `xl` width the
 * two stack, so the tables keep room for their columns.
 */
export function HistoryPanel({ id, roles }: { id: string; roles: Role[] }) {
  const [role, setRole] = useState<Role | undefined>(roles[0]);
  return (<section className="glass rounded-lg p-5 relative" aria-label="Champion history">
    {roles.length > 1 && <div className="absolute top-5 right-5 flex flex-wrap items-center justify-end gap-2 z-10">
      {roles.map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}><span className="inline-flex items-center gap-1.5"><RoleIcon role={r} size={16} decorative />{r}</span></Chip>)}
    </div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-0">
      <div className="min-w-0 xl:pr-6"><PatchPanel id={id} role={role} /></div>
      <div className="min-w-0 xl:pl-6 xl:border-l border-line/10"><LengthPanel id={id} role={role} /></div>
    </div>
  </section>);
}
