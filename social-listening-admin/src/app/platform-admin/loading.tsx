import { Skeleton } from '@/components/ui';

export default function PlatformAdminLoading() {
  return (
    <main>
      <Skeleton width={240} height={28} style={{ marginBottom: 12 }} />
      <Skeleton width={420} height={14} style={{ marginBottom: 24 }} />
      {[1, 2, 3, 4].map((i) => (
        <section key={i} style={{ marginBottom: 32 }}>
          <Skeleton width={180} height={20} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={120} style={{ borderRadius: 'var(--radius)' }} />
        </section>
      ))}
    </main>
  );
}
