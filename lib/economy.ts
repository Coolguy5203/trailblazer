// Currency: Credits. Earned from distance driven + jumps landed.
// IMPORTANT: this formula must stay in sync with the server-side award in the
// tb_bump_stats() RPC (see migration trailblazer_add_credits).
export const CREDIT_SYMBOL = "🪙";

export function creditsEarned(distanceM: number, jumps: number): number {
  return Math.floor(distanceM / 10) + jumps * 15;
}

export function formatCredits(n: number): string {
  return Math.round(n).toLocaleString();
}
