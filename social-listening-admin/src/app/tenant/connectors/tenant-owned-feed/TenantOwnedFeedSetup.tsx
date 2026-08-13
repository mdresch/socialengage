'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Activation {
  connectorActivationId: string;
  txtRecordHost: string;
  txtRecordValue: string;
  expiresAt: string;
  feedUrl: string;
}

/**
 * Story 6.12 (ADR-0050) — the real, two-step connect flow: submit
 * domain/feedUrl, publish the returned DNS TXT record at the tenant's own
 * registrar, then re-click "Verify now" until the backend confirms it.
 *
 * `activationId` (not `activation`) is the state that must drive whether the
 * pending "Verify now" branch renders — see this component's own SKILL.md
 * "Load-bearing constraints." `activation` (the full TXT-instruction object)
 * is only ever populated by a fresh connect response and is genuinely lost
 * on reload; `activationId` alone survives via the `?activationId=` URL
 * param a returning tenant's page load carries back in.
 */
export function TenantOwnedFeedSetup({ initialActivationId }: { initialActivationId: string | null }) {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [activation, setActivation] = useState<Activation | null>(null);
  const [activationId, setActivationId] = useState<string | null>(initialActivationId);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectError(null);

    const response = await fetch('/api/connectors/tenant-owned-feed/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, feedUrl }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 201) {
      setActivation(body as Activation);
      setActivationId(body.connectorActivationId);
      router.replace(`?activationId=${encodeURIComponent(body.connectorActivationId)}`);
      return;
    }
    setConnectError(body.error ?? 'Something went wrong while connecting this feed. Please check the domain and feed URL and try again.');
  }

  async function handleVerify() {
    if (!activationId) return;
    setVerifyMessage(null);

    const response = await fetch('/api/connectors/tenant-owned-feed/verify-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectorActivationId: activationId }),
    });
    const body = await response.json().catch(() => ({}));

    if (body.status === 'verified') {
      setVerified(true);
      return;
    }
    setVerifyMessage('Not yet verified — DNS propagation can take a while, try again shortly.');
  }

  if (verified) {
    return <p role="status">Domain verified — this feed is now connected and active.</p>;
  }

  if (activationId) {
    return (
      <section>
        {activation && (
          <>
            <p>Publish this TXT record at your DNS registrar, then return here to verify:</p>
            <dl>
              <dt>Host</dt>
              <dd>{activation.txtRecordHost}</dd>
              <dt>Value</dt>
              <dd>{activation.txtRecordValue}</dd>
              <dt>Expires</dt>
              <dd>{activation.expiresAt}</dd>
            </dl>
            <p>
              DNS propagation can take anywhere from a few minutes to 72 hours — this is normal, not an error or a stuck
              state.
            </p>
          </>
        )}
        <button type="button" onClick={handleVerify}>
          Verify now
        </button>
        {verifyMessage && <p role="status">{verifyMessage}</p>}
      </section>
    );
  }

  return (
    <form onSubmit={handleConnect}>
      <label>
        Domain
        <input type="text" required value={domain} onChange={(event) => setDomain(event.target.value)} />
      </label>
      <label>
        Feed URL
        <input type="text" required value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} />
      </label>
      <button type="submit">Connect</button>
      {connectError && <p role="alert">{connectError}</p>}
    </form>
  );
}
