#!/bin/bash
set -euo pipefail

OUT_DIR="${1:-./tmp/jwt-keys}"
KID="${2:-$(uuidgen | tr 'A-Z' 'a-z')}"

mkdir -p "$OUT_DIR"

PRIVATE_PEM="$OUT_DIR/private.pem"
PUBLIC_PEM="$OUT_DIR/public.pem"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$PRIVATE_PEM" >/dev/null 2>&1
openssl rsa -in "$PRIVATE_PEM" -pubout -out "$PUBLIC_PEM" >/dev/null 2>&1

PRIVATE_PEM_ESCAPED=$(awk '{printf "%s\\n", $0}' "$PRIVATE_PEM")
PUBLIC_PEM_ESCAPED=$(awk '{printf "%s\\n", $0}' "$PUBLIC_PEM")

echo "Generated keys at: $OUT_DIR"
echo ""
echo "JWT_KEY_0_KID=$KID"
echo "JWT_KEY_0_PRIVATE_KEY=$PRIVATE_PEM_ESCAPED"
echo "JWT_KEY_0_PUBLIC_KEY=$PUBLIC_PEM_ESCAPED"
echo "JWT_KEY_0_ACTIVE=true"
