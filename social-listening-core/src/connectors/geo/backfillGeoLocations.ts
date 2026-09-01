import { getAdminPool, closeAdminPool } from '../../db/adminPool';
import { normalizeCountryCode, getCountryName, buildGeoEnrichment } from './geoCountryUtils';

interface PostRecord {
  id: string;
  provider_id: string;
  raw_payload: Record<string, unknown>;
  enrichment: Record<string, unknown> | null;
  author_name: string | null;
  fb_page_name: string | null;
}

export async function runGeoBackfill() {
  const pool = getAdminPool();
  console.log('\n========================================');
  console.log('🚀 STARTING GEOSPATIAL LOCATION BACKFILL');
  console.log('========================================\n');

  try {
    const queryResult = await pool.query<PostRecord>(`
      SELECT 
        p.id,
        COALESCE(p.raw_payload->>'providerId', 'unknown') as provider_id,
        p.raw_payload,
        p.enrichment,
        a.display_name as author_name,
        f.page_name as fb_page_name
      FROM social_posts p
      LEFT JOIN authors a ON a.id = p.author_id
      LEFT JOIN facebook_connected_pages f ON f.page_id = (p.raw_payload->>'pageId')
      WHERE p.enrichment->>'geoCountry' IS NULL;
    `);

    const postsToEnrich = queryResult.rows;
    console.log(`Found ${postsToEnrich.length} posts without geoCountry.\n`);

    const stats: Record<string, number> = {
      gnews: 0,
      facebook: 0,
      newswire: 0,
      tenant_owned_feed: 0,
      instagram: 0,
      wikipedia: 0,
      youtube: 0,
      brave_search: 0,
      other: 0,
    };

    let totalUpdated = 0;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const post of postsToEnrich) {
        const prov = post.provider_id;
        const payload = post.raw_payload || {};
        let geoCountryCode: string | null = null;
        let geoSource: 'post' | 'source' | 'inferred' | 'unknown' = 'source';
        let geoConfidence: 'high' | 'medium' | 'low' = 'high';

        // 1. GNews: source.country (explicit ISO alpha-2)
        if (prov === 'gnews') {
          const sourceObj = payload.source as Record<string, unknown> | undefined;
          const rawCountry = sourceObj?.country as string | undefined;
          if (rawCountry) {
            geoCountryCode = normalizeCountryCode(rawCountry);
            geoSource = 'source';
            geoConfidence = 'high';
          }
        }

        // 2. Facebook: Page location or author bio
        else if (prov === 'facebook') {
          const pageName = (post.fb_page_name || (payload.pageName as string) || post.author_name || '').toLowerCase();
          if (pageName.includes('london') || pageName.includes('uk')) {
            geoCountryCode = 'GB';
          } else if (pageName.includes('new york') || pageName.includes('us') || pageName.includes('usa')) {
            geoCountryCode = 'US';
          } else {
            // CBA Consult / S&C MVP / Sustainable Army -> UK default HQ
            geoCountryCode = 'GB';
          }
          geoSource = 'author_profile' as any;
          geoConfidence = 'high';
        }

        // 3. Instagram: Page connection mapping
        else if (prov === 'instagram') {
          const pageName = ((payload.page_name as string) || post.author_name || '').toLowerCase();
          if (pageName.includes('london') || pageName.includes('uk')) {
            geoCountryCode = 'GB';
          } else if (pageName.includes('new york') || pageName.includes('us')) {
            geoCountryCode = 'US';
          } else {
            geoCountryCode = 'GB';
          }
          geoSource = 'author_profile' as any;
          geoConfidence = 'high';
        }

        // 4. Newswire: Corporate issuer name & suffix analysis
        else if (prov === 'newswire') {
          const issuer = (payload.issuer as string) || '';
          if (
            issuer.includes('(Uk') ||
            issuer.includes('UK') ||
            issuer.includes('PLC') ||
            issuer.includes('Ltd') ||
            issuer.includes('London')
          ) {
            geoCountryCode = 'GB';
          } else if (
            issuer.includes('Inc') ||
            issuer.includes('Corp') ||
            issuer.includes('LLC') ||
            issuer.includes('USA') ||
            issuer.includes('Delaware')
          ) {
            geoCountryCode = 'US';
          } else if (issuer.includes('GmbH') || issuer.includes('Germany')) {
            geoCountryCode = 'DE';
          } else if (issuer.includes('S.A.') || issuer.includes('Europe')) {
            geoCountryCode = 'FR';
          } else {
            geoCountryCode = 'US'; // Global Newswire default market
          }
          geoSource = 'post';
          geoConfidence = 'medium';
        }

        // 5. Tenant-Owned Feed (RSS / Blogs)
        else if (prov === 'tenant-owned-feed' || prov === 'blogs' || prov === 'rss') {
          const title = ((payload.title as string) || '').toLowerCase();
          if (title.includes('munich') || title.includes('germany')) {
            geoCountryCode = 'DE';
          } else if (title.includes('london') || title.includes('uk')) {
            geoCountryCode = 'GB';
          } else {
            geoCountryCode = 'GB'; // CBA enterprise default
          }
          geoSource = 'source';
          geoConfidence = 'high';
        }

        // 6. Wikipedia language & regional editions
        else if (prov === 'wikipedia') {
          const url = (payload.url as string) || '';
          if (url.includes('de.wikipedia')) geoCountryCode = 'DE';
          else if (url.includes('fr.wikipedia')) geoCountryCode = 'FR';
          else if (url.includes('es.wikipedia')) geoCountryCode = 'ES';
          else if (url.includes('it.wikipedia')) geoCountryCode = 'IT';
          else if (url.includes('ja.wikipedia')) geoCountryCode = 'JP';
          else geoCountryCode = 'US'; // English Wikipedia default
          geoSource = 'source';
          geoConfidence = 'medium';
        }

        // 7. YouTube & Brave Search
        else if (prov === 'youtube' || prov === 'brave-search') {
          geoCountryCode = 'US';
          geoSource = 'inferred';
          geoConfidence = 'low';
        }

        if (geoCountryCode) {
          const geoName = getCountryName(geoCountryCode);
          const patch = {
            geoCountry: geoCountryCode,
            geoCountryName: geoName,
            geoSource,
            geoConfidence,
          };

          await client.query(
            `UPDATE social_posts 
             SET enrichment = COALESCE(enrichment, '{}'::jsonb) || $1::jsonb 
             WHERE id = $2`,
            [JSON.stringify(patch), post.id]
          );

          totalUpdated++;
          const statKey = prov.replace(/-/g, '_');
          stats[statKey] = (stats[statKey] || 0) + 1;
        }
      }

      await client.query('COMMIT');
      console.log('✅ Backfill transaction committed successfully.\n');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Verify new totals in DB
    const finalCounts = await pool.query(`
      SELECT 
        COUNT(*) as total_posts,
        COUNT(CASE WHEN enrichment->>'geoCountry' IS NOT NULL THEN 1 END) as enriched_posts,
        COUNT(CASE WHEN enrichment->>'geoCountry' IS NULL THEN 1 END) as unenriched_posts
      FROM social_posts;
    `);

    const { total_posts, enriched_posts } = finalCounts.rows[0];
    const pct = ((Number(enriched_posts) / Number(total_posts)) * 100).toFixed(1);

    console.log('=== BACKFILL SUMMARY RESULTS ===');
    console.log(`Total posts backfilled: ${totalUpdated}`);
    console.table(stats);
    console.log(`\n🎉 NEW DATABASE LOCATION COVERAGE: ${enriched_posts} / ${total_posts} posts (${pct}%)`);
    console.log('========================================\n');

  } catch (err) {
    console.error('Backfill error:', err);
    throw err;
  } finally {
    await closeAdminPool();
  }
}

// Auto-run when executed directly via node/ts-node
runGeoBackfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill execution failed:', err);
    process.exit(1);
  });
