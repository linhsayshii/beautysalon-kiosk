#!/bin/sh
set -e

# ./uploads is a bind mount that Docker creates as root on Linux hosts. Hand it to the
# unprivileged app user, then drop root before starting the API.
if [ "$(id -u)" = '0' ]; then
  mkdir -p "${UPLOAD_DIR:-/app/uploads}"
  chown app:app "${UPLOAD_DIR:-/app/uploads}"
  exec su-exec app "$@"
fi

exec "$@"
