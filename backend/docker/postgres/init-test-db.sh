#!/bin/sh
set -eu
case "$TEST_DB_NAME" in
  ''|*[!A-Za-z0-9_]*)
    echo "TEST_DB_NAME must contain only letters, numbers, and underscores." >&2
    exit 1
    ;;
esac
if [ "$TEST_DB_NAME" = "$POSTGRES_DB" ]; then
  echo "TEST_DB_NAME must be different from POSTGRES_DB." >&2
  exit 1
fi
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --command="CREATE DATABASE \"$TEST_DB_NAME\" OWNER \"$POSTGRES_USER\";"
