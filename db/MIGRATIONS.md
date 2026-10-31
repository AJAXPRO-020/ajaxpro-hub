# AjaxPro database migrations

Historical SQL files remain immutable. Duplicate numbers `016`, `027` and `031`
are preserved because renaming them would falsify the existing history.

`035_migration_registry.sql` is a one-time bootstrap. It creates
`schema_migrations` and records the explicitly confirmed production baseline
`034_motm_announcement_delivery.sql` plus its own `bootstrap-035` marker.
Earlier migrations are not silently marked as applied.

Future migrations start at `036`. Run them only with the explicit unpooled Neon
connection and target identity:

```sh
DATABASE_URL_UNPOOLED=... \
MIGRATION_TARGET_DATABASE=neondb \
MIGRATION_TARGET_HOST=... \
npm run db:migrate:future
```

The runner refuses a missing target identity, a host/database mismatch, changed
checksums, and duplicate future numbers. It uses a PostgreSQL advisory lock and
records each successful filename and checksum once. It does not discover or
replay historical migrations.
