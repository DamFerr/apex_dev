import { Home, Swords, Shield, BarChart3, User, Radio, Settings, type LucideIcon } from "lucide-react";
export interface NavItem { path: string; label: string; icon: LucideIcon }
/** Only screens that exist are listed. */
export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/draft", label: "Draft", icon: Swords },
  { path: "/champions", label: "Champions", icon: Shield },
  { path: "/tierlist", label: "Tier List", icon: BarChart3 },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/live", label: "Live Game", icon: Radio },
];
export const SETTINGS_ITEM: NavItem = { path: "/settings", label: "Settings", icon: Settings };
