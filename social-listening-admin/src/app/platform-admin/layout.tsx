import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity } from '@/lib/role-routing';
import { AppShell } from '@/components/shell';

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  return (
    <AppShell shellType="platform-admin" identity={identity}>
      {children}
    </AppShell>
  );
}
