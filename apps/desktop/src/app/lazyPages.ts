import { lazy } from "react";
/** Screens load on demand (faster cold start). Hovering or focusing a nav item preloads its chunk. */
const imp = {
  draft: () => import("./Draft"), pickSetup: () => import("./PickSetup"), champions: () => import("./Champions"), champion: () => import("./ChampionPage"),
  profile: () => import("./Profile"), tierlist: () => import("./TierList"), leaderboard: () => import("./Leaderboard"), live: () => import("./LiveGame"), recap: () => import("./Recap"), settings: () => import("./Settings"),
};
export const Draft = lazy(() => imp.draft().then((m) => ({ default: m.Draft })));
export const PickSetupPage = lazy(() => imp.pickSetup().then((m) => ({ default: m.PickSetupPage })));
export const Champions = lazy(() => imp.champions().then((m) => ({ default: m.Champions })));
export const ChampionPage = lazy(() => imp.champion().then((m) => ({ default: m.ChampionPage })));
export const Profile = lazy(() => imp.profile().then((m) => ({ default: m.Profile })));
export const TierList = lazy(() => imp.tierlist().then((m) => ({ default: m.TierList })));
export const Leaderboard = lazy(() => imp.leaderboard().then((m) => ({ default: m.Leaderboard })));
export const LiveGame = lazy(() => imp.live().then((m) => ({ default: m.LiveGame })));
export const Recap = lazy(() => imp.recap().then((m) => ({ default: m.Recap })));
export const Settings = lazy(() => imp.settings().then((m) => ({ default: m.Settings })));
export const preload: Record<string, () => Promise<unknown>> = {
  "/draft": imp.draft, "/champions": () => Promise.all([imp.champions(), imp.champion()]), "/profile": imp.profile, "/tierlist": imp.tierlist, "/leaderboard": imp.leaderboard, "/live": imp.live, "/settings": imp.settings,
};
