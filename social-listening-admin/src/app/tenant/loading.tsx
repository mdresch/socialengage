import { Skeleton } from '@/components/ui';

export default function TenantLoading() {
  return (
    <main>
      <div
        className="page-header"
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <Skeleton width={180} height={24} style={{ marginBottom: 8 }} />
          <Skeleton width={280} height={14} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Skeleton width={110} height={32} />
          <Skeleton width={130} height={32} />
        </div>
      </div>

      <div className="overview-cards-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="overview-card" style={{ minHeight: 148 }}>
            <div className="overview-card-header">
              <Skeleton width={100} height={12} />
              <Skeleton width={36} height={36} circle />
            </div>
            <div className="overview-card-body">
              <Skeleton width={80} height={40} style={{ marginBottom: 8 }} />
              <Skeleton width={140} height={14} />
            </div>
            <Skeleton width={120} height={12} />
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        <div className="card">
          <div
            className="card-header"
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <div>
              <Skeleton width={160} height={18} style={{ marginBottom: 4 }} />
              <Skeleton width={220} height={14} />
            </div>
            <Skeleton width={70} height={14} />
          </div>
          <div
            style={{
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <Skeleton width={80} height={14} />
                  <Skeleton width={60} height={12} />
                </div>
                <Skeleton
                  width="100%"
                  height={16}
                  style={{ marginBottom: 8 }}
                />
                <Skeleton width="80%" height={14} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header">
              <Skeleton width={120} height={18} />
            </div>
            <div
              className="card-body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Skeleton width={100} height={14} />
                  <Skeleton width={60} height={20} />
                </div>
              ))}
            </div>
          </div>
          <div className="card card-body">
            <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="80%" height={14} />
          </div>
        </div>
      </div>
    </main>
  );
}
