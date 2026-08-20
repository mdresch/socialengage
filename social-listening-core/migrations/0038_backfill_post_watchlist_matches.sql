-- Story 3.12 (ADR-0063 2026-08-20 Amendment Log) -- Retroactively backfills
-- match pairs into post_watchlist_matches for historical posts ingested
-- prior to Story 3.11 / migration 0036.
-- Matches keyword and hashtag terms against body_markdown and raw_payload text fields.
INSERT INTO post_watchlist_matches (post_id, watchlist_id, tenant_id)
SELECT DISTINCT sp.id AS post_id, w.id AS watchlist_id, sp.tenant_id
FROM social_posts sp
JOIN watchlists w ON w.tenant_id = sp.tenant_id
CROSS JOIN LATERAL unnest(COALESCE(w.terms, ARRAY[]::text[])) term
WHERE (
  (w.match_type = 'keyword' AND (
    LOWER(COALESCE(sp.body_markdown, '')) LIKE '%' || LOWER(term) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'title', '')) LIKE '%' || LOWER(term) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'description', '')) LIKE '%' || LOWER(term) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'text', '')) LIKE '%' || LOWER(term) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'message', '')) LIKE '%' || LOWER(term) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'story', '')) LIKE '%' || LOWER(term) || '%'
  ))
  OR
  (w.match_type = 'hashtag' AND (
    LOWER(COALESCE(sp.body_markdown, '')) LIKE '%#' || LOWER(REPLACE(term, '#', '')) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'title', '')) LIKE '%#' || LOWER(REPLACE(term, '#', '')) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'description', '')) LIKE '%#' || LOWER(REPLACE(term, '#', '')) || '%'
    OR LOWER(COALESCE(sp.raw_payload->>'text', '')) LIKE '%#' || LOWER(REPLACE(term, '#', '')) || '%'
  ))
)
ON CONFLICT (post_id, watchlist_id) DO NOTHING;
