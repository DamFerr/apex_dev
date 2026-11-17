/**
 * The one win-rate colour scale for every screen: below 48% is "bad", above 52% is "good", in between "neutral" (the 4 points around 50% are noise
 * for almost every sample). Pass the ADJUSTED (shrunk) win rate as a fraction. The number must always be shown next to the colour (never colour alone).
 * Hand-set cut-offs; to be tuned on real data.
 */
export type WinRateBand = "bad" | "neutral" | "good";
export const WIN_RATE_BAD_BELOW = 0.48;
export const WIN_RATE_GOOD_ABOVE = 0.52;
export const winRateBand = (adjusted: number): WinRateBand => (adjusted < WIN_RATE_BAD_BELOW ? "bad" : adjusted > WIN_RATE_GOOD_ABOVE ? "good" : "neutral");
