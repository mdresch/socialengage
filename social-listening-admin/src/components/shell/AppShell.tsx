import type { ReactElement, ReactNode } from 'react';
import type { ResolvedIdentity } from '@/lib/role-routing';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';

export interface AppShellProps {
  identity?: ResolvedIdentity | null;
  shellType: 'tenant' | 'platform-admin';
  children: ReactNode;
}

/**
 * AppShell (Design Spec §4.1)
 * The universal 2-pane application shell wrapping authenticated pages.
 */
export function AppShell({ identity, shellType, children }: AppShellProps): ReactElement {
  return (
    <div className="app-layout" data-testid="app-shell">
      <AppHeader identity={identity} shellType={shellType} />
      <div className="app-body">
        <AppSidebar identity={identity} shellType={shellType} />
        <div className="app-main-content">{children}</div>
      </div>
    </div>
  );
}
