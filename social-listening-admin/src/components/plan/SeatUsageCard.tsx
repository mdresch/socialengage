export interface SeatUsageCardProps {
  usedSeats: number;
  maxSeats: number;
}

export function SeatUsageCard({ usedSeats, maxSeats }: SeatUsageCardProps) {
  const atLimit = usedSeats >= maxSeats;
  const percentage = maxSeats > 0 ? Math.min((usedSeats / maxSeats) * 100, 100) : 0;

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '1rem',
        background: atLimit ? '#fef2f2' : '#f9fafb',
      }}
      aria-label="Seat usage"
    >
      <p style={{ margin: 0, fontWeight: 600 }}>
        {usedSeats} of {maxSeats} seats active
      </p>
      <div
        role="progressbar"
        aria-valuenow={usedSeats}
        aria-valuemin={0}
        aria-valuemax={maxSeats}
        style={{
          height: 8,
          width: '100%',
          background: '#e5e7eb',
          borderRadius: 4,
          marginTop: '0.5rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: atLimit ? '#dc2626' : '#2563eb',
          }}
        />
      </div>
      {atLimit && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: 0 }}>
          Seat limit reached. Upgrade the plan or raise max seats to add more users.
        </p>
      )}
    </div>
  );
}
