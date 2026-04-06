#!/bin/bash
set -e

# 1. Apply all schema and function migrations (except roles)
echo "Applying all schema/function migrations..."
for dir in prisma/migrations/*/; do
  if [[ "$dir" != *production_roles* ]]; then
    echo "Applying migration: $dir"
    psql "$DATABASE_URL" -f "$dir/migration.sql"
  fi
done

echo "All schema/function migrations applied."

# 2. Apply roles/permissions migration
echo "Applying production roles migration..."
psql "$DATABASE_URL" -f prisma/migrations/20260331220000_production_roles/migration.sql
echo "All migrations and roles applied successfully."
