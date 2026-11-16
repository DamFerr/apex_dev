import { Link } from "react-router-dom";

/** Shown instead of personal data until a Riot ID is set (there is no demo player any more). */
export function NeedRiotId({ what = "your games" }: { what?: string }) {
  return (
    <div className="glass rounded-lg p-6 text-sm max-w-xl" role="status">
      <div className="font-medium mb-1">Set your Riot ID to see {what}.</div>
      <div className="text-muted">Add it in <Link to="/settings" className="focus-ring underline rounded hover:text-text">Settings</Link> (for example Name#EUW). Your region is found automatically. You can also search any Riot ID above.</div>
    </div>);
}
