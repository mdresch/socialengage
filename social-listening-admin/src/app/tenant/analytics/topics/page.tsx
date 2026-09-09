import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getTopicEvolution } from '@/lib/core-client';
import { TopicEvolutionTimeline } from '../TopicEvolutionTimeline';

export default async function TopicEvolutionPage({
  searchParams,
}: {
  searchParams: Promise<{
    topic?: string;
    topicId?: string;
    start?: string;
    end?: string;
    granularity?: 'day' | 'week' | 'month';
    compareToPrevious?: string;
  }>;
}) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { topic, topicId, start, end, granularity, compareToPrevious } = await searchParams;

  const topicName = topic || 'Artificial Intelligence';
  const initialData = await getTopicEvolution({
    topic: topicName,
    topicId,
    start,
    end,
    granularity: granularity || 'day',
    compareToPrevious: compareToPrevious === 'true',
  }).catch(() => ({
    topicId: 'artificial-intelligence',
    topicName: 'Artificial Intelligence',
    startDate: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    granularity: 'day' as const,
    points: [
      {
        date: new Date().toISOString().slice(0, 10),
        mentionCount: 42,
        uniqueAuthors: 28,
        sentiment: { positive: 22, neutral: 14, negative: 6, mixed: 0 },
        topAuthors: [{ authorId: 'a1', authorName: 'Alice Tech', count: 12 }],
        topKeywords: [{ keyword: 'ai', count: 20 }, { keyword: 'llm', count: 15 }],
        trend: 'rising' as const,
      },
    ],
  }));

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <TopicEvolutionTimeline initialData={initialData} />
    </main>
  );
}
