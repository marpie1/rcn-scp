#!/bin/sh
# Seed blank patient pages on first start only (don't overwrite existing data)
PAGES_DIR="${WIKI_DATA_DIR:-/wiki-data}/localhost/pages"
mkdir -p "$PAGES_DIR"

if [ -d /seeds/new-patient ]; then
  for f in /seeds/new-patient/*; do
    slug=$(basename "$f")
    dest="$PAGES_DIR/$slug"
    if [ ! -f "$dest" ]; then
      cp "$f" "$dest"
      echo "Seeded page: $slug"
    fi
  done
fi

exec wiki \
  --port "${WIKI_PORT:-3000}" \
  --data "${WIKI_DATA_DIR:-/wiki-data}" \
  --security_type open
