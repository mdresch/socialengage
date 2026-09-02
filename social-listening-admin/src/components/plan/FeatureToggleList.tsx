'use client';

export const FEATURE_KEYS = [
  'ai_assist',
  'analytics_dashboard',
  'multi_user',
  'api_access',
  'webhooks',
  'crisis_templates',
  'compliance_packs',
  'dsr_portal',
  'rag_search',
  'connectors',
  'watchlists',
  'exports',
  'prospecting_crm',
] as const;

export interface FeatureToggleListProps {
  featureGates: Record<string, any>;
  onChange?: (key: string, value: boolean) => void;
  readOnly?: boolean;
}

export function FeatureToggleList({ featureGates, onChange, readOnly }: FeatureToggleListProps) {
  const keys = FEATURE_KEYS;
  return (
    <fieldset>
      <legend>Feature gates</legend>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {keys.map((key) => {
          const enabled = featureGates[key] === true;
          return (
            <li key={key} style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => onChange?.(key, event.target.checked)}
                  disabled={readOnly}
                  aria-label={`Enable ${key}`}
                />
                <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
