import { SupabaseClient } from '@supabase/supabase-js';

export const FREE_DAILY_REFLECTION_LIMIT = 3;

export type ReflectionUsageClaim = {
  allowed: boolean;
  claimId: string | null;
  used: number;
  remaining: number | null;
  dailyLimit: number;
  unlimited: boolean;
};

export const getBearerToken = (authorization: unknown): string | null => {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof value !== 'string') return null;

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const claimReflectionUsage = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<ReflectionUsageClaim> => {
  const { data, error } = await supabase.rpc('claim_reflection_usage', {
    p_user_id: userId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== 'boolean') {
    throw new Error('Reflection usage check returned an invalid response.');
  }

  return {
    allowed: row.allowed,
    claimId: row.claim_id || null,
    used: Number(row.used || 0),
    remaining: row.remaining === null || row.remaining === undefined
      ? null
      : Number(row.remaining),
    dailyLimit: Number(row.daily_limit || FREE_DAILY_REFLECTION_LIMIT),
    unlimited: Boolean(row.unlimited),
  };
};

export const refundReflectionUsage = async (
  supabase: SupabaseClient,
  userId: string,
  claimId: string | null,
): Promise<void> => {
  if (!claimId) return;

  const { error } = await supabase
    .from('daily_feature_usage')
    .delete()
    .eq('id', claimId)
    .eq('user_id', userId)
    .eq('feature', 'reflection');

  if (error) {
    console.error(`[Reflection Limit] Could not refund claim ${claimId}: ${error.message}`);
  }
};
