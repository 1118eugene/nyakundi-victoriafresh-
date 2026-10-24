# PostgreSQL backup and restore

These commands use the `DATABASE_URL` configured for the backend and require
the PostgreSQL client tools (`pg_dump` and `pg_restore`) on `PATH`. They never
drop, truncate, or reset tables.

## Create a backup

From the repository root, create a custom-format backup:

```powershell
npm --prefix backend run db:backup
```

The default destination is the ignored `backend/backups/` directory. Set
`BACKUP_DIR` to choose another protected location. A successful command prints
the resulting file path, not the connection details.

Database backups contain customer and order personal information. Restrict
access to them, encrypt them using an approved storage mechanism, keep them
outside Git, and follow the owner-confirmed retention schedule. This command
does not encrypt the backup file.

## Restore to an empty database only

First provision a separate, empty PostgreSQL database and set `DATABASE_URL`
to that target for the restore process. Do not use a production database with
existing tables. Then run:

```powershell
npm --prefix backend run db:restore -- "C:\protected-backups\victoria-fresh-<timestamp>.dump" --confirm-empty-target
```

Restore refuses to run unless the target has no user tables and the explicit
confirmation flag is present. It uses `pg_restore` without clean/drop options.
If restore fails partway, the target may contain some restored tables; do not
retry into it. Provision another empty target and investigate the failure.
Verify the restored database and application against the separate target
before considering any production recovery. This document does not authorize
overwriting a live customer, order, or payment database.

## Recovery preparation

Periodically verify that backups are readable with `pg_restore --list` and
conduct restore drills only against isolated, disposable databases. Confirm
the owner-approved retention period, backup storage location, encryption and
access policy, recovery point objective, and recovery time objective before
launch.
