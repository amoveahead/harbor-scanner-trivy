#!/usr/bin/env bash
# gen-env.sh writes .env for compose.yaml from .env.example.
#
# It generates SCANNER_V2_AUTH_TOKEN and MONGO_PASSWORD, and asks for the
# registry the scanner reads images from and its robot account. Everything
# else keeps the value in .env.example (edit .env afterwards to change it).
#
#   ./gen-env.sh          ask for the registry, write .env (refuses to overwrite)
#   ./gen-env.sh -f       overwrite an existing .env; the old one is kept as .env.bak
#
# Without prompts (for scripts), set the answers in the environment:
#   REGISTRY_URL=https://harbor.example.internal REGISTRY_USERNAME='robot$scanner' \
#   REGISTRY_PASSWORD=... ./gen-env.sh
#
# Secrets are never printed. .env is written with mode 600.
set -euo pipefail

cd "$(dirname "$0")"

force=false
if [[ "${1:-}" == "-f" ]]; then
  force=true
elif [[ -n "${1:-}" ]]; then
  echo "usage: $0 [-f]" >&2
  exit 2
fi

if [[ ! -f .env.example ]]; then
  echo "gen-env: .env.example not found next to this script" >&2
  exit 1
fi
if [[ -e .env && "$force" != true ]]; then
  echo "gen-env: .env already exists; run with -f to replace it (the old one is kept as .env.bak)" >&2
  exit 1
fi
if ! command -v openssl >/dev/null; then
  echo "gen-env: openssl is needed to generate the token and the password" >&2
  exit 1
fi

# The registry: from the environment, or asked for.
registry_url="${REGISTRY_URL:-}"
registry_username="${REGISTRY_USERNAME:-}"
registry_password="${REGISTRY_PASSWORD:-}"
if [[ -z "$registry_url" ]]; then
  read -r -p "Registry URL (for example https://harbor.example.internal): " registry_url
fi
if [[ -z "$registry_username" ]]; then
  read -r -p "Robot account name (for example robot\$scanner): " registry_username
fi
if [[ -z "$registry_password" ]]; then
  read -r -s -p "Robot account password (not shown): " registry_password
  echo
fi
if [[ -z "$registry_url" || -z "$registry_username" || -z "$registry_password" ]]; then
  echo "gen-env: the registry URL, robot name and password are all needed" >&2
  exit 1
fi
if [[ "$registry_url" != http://* && "$registry_url" != https://* ]]; then
  echo "gen-env: the registry URL must start with http:// or https://" >&2
  exit 1
fi

# Hex only: the MongoDB password goes into the MongoDB URI as it is.
token="$(openssl rand -hex 32)"
mongo_password="$(openssl rand -hex 24)"

# Compose reads $ in .env as a variable: write it as $$.
escape() {
  printf '%s' "${1//\$/\$\$}"
}

umask 077
tmp="$(mktemp .env.XXXXXX)"
trap 'rm -f "$tmp"' EXIT

# Replace the value of each KEY=... line; the values come through the
# environment so awk does not interpret them.
SET_SCANNER_V2_AUTH_TOKEN="$token" \
SET_MONGO_PASSWORD="$mongo_password" \
SET_SCANNER_REGISTRY_URL="$(escape "$registry_url")" \
SET_SCANNER_REGISTRY_USERNAME="$(escape "$registry_username")" \
SET_SCANNER_REGISTRY_PASSWORD="$(escape "$registry_password")" \
awk '
  /^[A-Z0-9_]+=/ {
    key = substr($0, 1, index($0, "=") - 1)
    if (("SET_" key) in ENVIRON) {
      print key "=" ENVIRON["SET_" key]
      next
    }
  }
  { print }
' .env.example >"$tmp"

# The first line of .env.example says "Copy to .env"; say where this one came from.
sed -i "1s|.*|# Written by gen-env.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Never commit .env.|" "$tmp"

if [[ -e .env ]]; then
  cp -p .env .env.bak
  chmod 600 .env.bak
fi
mv "$tmp" .env
chmod 600 .env
trap - EXIT

echo "gen-env: wrote $(pwd)/.env (mode 600)"
echo "  SCANNER_V2_AUTH_TOKEN      generated (64 hex characters; it is the admin panel's sign-in)"
echo "  MONGO_PASSWORD             generated"
echo "  SCANNER_REGISTRY_URL       $registry_url"
echo "  SCANNER_REGISTRY_USERNAME  $registry_username"
echo "  SCANNER_REGISTRY_PASSWORD  set"
echo "The rest is as in .env.example (DB mirrors, workers, ports). Then: docker compose up -d"
echo "Note: MONGO_PASSWORD only takes effect on a new mongo-data volume."
