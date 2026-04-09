#!/bin/bash
# Daily PostgreSQL backup script with 7-day retention and gzip compression
# Usage: ./backup_db.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./db_backups}"
DB_NAME="${DB_NAME:-telegram_mini_app}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS=7
DATE=$(date +"%Y-%m-%d_%H-%M-%S")

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$DATE.sql.gz"

# Dump and compress
PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.sql.gz" -mtime +$((RETENTION_DAYS-1)) -exec rm {} \;

echo "Backup complete: $BACKUP_FILE"
