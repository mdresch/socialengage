# postgres:17 (Debian-based, not -alpine) + pg_cron (Story 4.4, ADR-0022) —
# AuthorTopicSignal's hourly refresh needs a real pg_cron extension, and
# pg_cron has no Alpine package. The official postgres image's Debian base
# already has the PGDG apt repo configured (it's how the image gets its own
# postgresql-17 package), so installing postgresql-17-cron needs no extra
# repo setup. See ../../.claude/skills/derived-data-caching-and-refresh/SKILL.md.
FROM postgres:17

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-cron \
  && rm -rf /var/lib/apt/lists/*
