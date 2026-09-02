import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getCRMCredential } from '@/lib/core-client';
import { CRMSettingsView } from '../CRMSettingsView';
import { CRM_CONNECTOR_UI } from '../connectorConfig';

interface CRMConnectorSettingsPageProps {
  params: Promise<{ crmConnectorId: string }>;
}

export default async function CRMConnectorSettingsPage({
  params,
}: CRMConnectorSettingsPageProps) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const { crmConnectorId } = await params;
  const connector = CRM_CONNECTOR_UI[crmConnectorId];
  if (!connector) {
    notFound();
  }

  const credential = await getCRMCredential(crmConnectorId).catch(() => ({
    crmConnectorId,
    configured: false,
    config: null,
  }));

  return (
    <main className="p-6">
      <CRMSettingsView initialCredential={credential} connector={connector} />
    </main>
  );
}
