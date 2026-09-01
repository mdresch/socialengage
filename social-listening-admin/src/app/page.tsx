import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { getRoleShell, getTenantShellActions, isResolvedIdentity } from '@/lib/role-routing';
import styles from './page.module.css';

const tenantFeatures = [
  {
    title: 'Watchlists',
    description:
      'Define the topics, keywords, and sources you want to monitor. Use boolean queries and provider filters to refine what matters.',
    href: '/tenant/watchlists',
  },
  {
    title: 'Connectors',
    description:
      'Link GNews, Newswire, Wikipedia, Facebook Pages, and your own RSS feeds so posts start flowing into your tenant.',
    href: '/tenant/connectors',
  },
  {
    title: 'Post Feed',
    description:
      'Browse every post that matches your watchlists, search across the corpus, and trigger AI enrichment on demand.',
    href: '/tenant/posts',
  },
  {
    title: 'Analytics',
    description:
      'Explore sources, sentiment, languages, conversations, and trends over time to understand the conversation landscape.',
    href: '/tenant/analytics',
  },
  {
    title: 'Connector Status',
    description:
      'Keep an eye on platform health, ingestion progress, and any connection issues that need attention.',
    href: '/tenant/connectors/status',
  },
  {
    title: 'Settings',
    description: 'Manage your tenant profile, invitations, and members. Only tenant admins can access this area.',
    href: '/tenant/settings',
    adminOnly: true,
  },
];

export default async function HomePage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;
  const shell = getRoleShell(identity);

  if (session && shell === 'platform-admin') {
    redirect('/platform-admin');
  }

  if (session && shell === null) {
    redirect('/sign-in');
  }

  const isAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';
  const tenantActions = getTenantShellActions(identity);
  const features = tenantFeatures.filter((feature) => !feature.adminOnly || isAdmin);

  return (
    <main>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroContent}>
          <h1 id="home-title" className={styles.heroTitle}>
            Welcome to SocialEngage Admin
          </h1>
          <p className={styles.heroSubtitle}>
            The social listening and insights workspace for your organization. Track topics, connect sources,
            enrich posts with AI, and explore analytics — all in one place.
          </p>
          <p data-testid="signed-in-state" className={styles.signedInState}>
            Signed in.
          </p>
          <div className={styles.heroCtas}>
            <a href="/tenant" className={`${styles.btn} ${styles.btnPrimary}`}>
              Open tenant shell
            </a>
            <a href="/tenant/connectors/status" className={`${styles.btn} ${styles.btnSecondary}`}>
              View connector status
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="features-title">
        <h2 id="features-title" className={styles.sectionTitle}>
          What you can do
        </h2>
        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <a key={feature.title} href={feature.href} className={styles.featureCard}>
              <h3 className={styles.featureCardTitle}>{feature.title}</h3>
              <p className={styles.featureCardDesc}>{feature.description}</p>
              <span className={styles.featureCardArrow}>Explore →</span>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="tenant-shell-title">
        <h2 id="tenant-shell-title" className={styles.sectionTitle}>
          Tenant shell
        </h2>
        <p className={styles.sectionLead}>Quick actions enabled for your account:</p>
        <ul className={styles.actionList}>
          {tenantActions.map((action) => (
            <li key={action} className={styles.actionPill}>
              {action}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
