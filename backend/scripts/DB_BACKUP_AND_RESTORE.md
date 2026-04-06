# Database Backup & Restore Strategy

## Daily Backup
- A daily backup is performed using `scripts/backup_db.sh`.
- Backups are stored in `./db_backups` (configurable via `BACKUP_DIR`).
- Each backup is gzip-compressed and named with a timestamp.
- Only the last 7 days of backups are retained (older backups are deleted automatically).

### Running the Backup Script
```sh
# Set environment variables as needed (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, BACKUP_DIR)
./scripts/backup_db.sh
```

## Restore Process
To restore a backup:

```sh
gunzip -c ./db_backups/telegram_mini_app_YYYY-MM-DD_HH-MM-SS.sql.gz | psql -U <user> -d <database> -h <host> -p <port>
```
- Replace the filename and connection details as needed.
- Ensure the target database is empty or drop/recreate it before restoring if needed.

## Point-in-Time Recovery (PITR)
- For PITR, you must enable PostgreSQL WAL archiving and base backups.
- This is not enabled by default in the above script.
- To enable PITR:
  1. Set `archive_mode = on` and configure `archive_command` in `postgresql.conf`.
  2. Regularly copy WAL files to a safe location.
  3. Take periodic base backups (e.g., with `pg_basebackup`).
- To recover to a specific point:
  1. Restore the latest base backup.
  2. Replay WAL files up to the desired timestamp using `recovery.conf` or `restore_command`.

## Recommendations
- Store backups offsite or in cloud storage for disaster recovery.
- Test restore procedures regularly.
- Monitor backup script execution and retention.
