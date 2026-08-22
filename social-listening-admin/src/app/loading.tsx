import { Skeleton } from '@/components/ui';

export default function RootLoading() {
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <Skeleton width={160} height={20} />
    </main>
  );
}
