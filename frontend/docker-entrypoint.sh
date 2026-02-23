#!/bin/sh
set -e

# Substitute environment variables into the nginx config template
# Uses __PLACEHOLDER__ syntax to avoid conflicting with nginx's own $ variables
BACKEND_URL="${BACKEND_URL:-https://farm-management-tracker-production-9c7d.up.railway.app}"
BACKEND_HOST=$(echo "$BACKEND_URL" | sed 's|https\?://||' | sed 's|/.*||')
PORT="${PORT:-80}"

sed \
  -e "s|__BACKEND_URL__|${BACKEND_URL}|g" \
  -e "s|__BACKEND_HOST__|${BACKEND_HOST}|g" \
  -e "s|__PORT__|${PORT}|g" \
  /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
