import { findDueDigestSubscriptions, updateLastSentAt } from './digestPreferenceStore';
import { buildDailyDigest } from './dailyDigestBuilder';
import { renderDailyDigest } from './dailyDigestRenderer';

export interface DigestSchedulerResult {
  processedCount: number;
  errors: Array<{ userId: string; error: string }>;
}

export async function runHourlyDigestBatch(): Promise<DigestSchedulerResult> {
  const dueSubscriptions = await findDueDigestSubscriptions(20);
  const errors: Array<{ userId: string; error: string }> = [];
  let processedCount = 0;

  for (const sub of dueSubscriptions) {
    try {
      // Build digest data according to user's personalized preferences
      const digestData = await buildDailyDigest(sub.tenantId, sub.userId, sub);
      const rendered = renderDailyDigest(digestData);

      // In production, ACS Email or SMTP delivery would be invoked here.
      // For testing and core runtime, we log and mark as sent.

      // Update cooldown guard
      await updateLastSentAt(sub.id, new Date());
      processedCount++;
    } catch (err: any) {
      errors.push({
        userId: sub.userId,
        error: err.message || 'Unknown digest error',
      });
    }
  }

  return {
    processedCount,
    errors,
  };
}
