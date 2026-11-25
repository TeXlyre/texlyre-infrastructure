#!/bin/sh
set -eu
set -o pipefail

TARGET=/texmf
STRIP="${TEXMF_STRIP:-1}"
COMPLETE="$TARGET/.texmf-initialized"
PENDING="$TARGET/.texmf-initializing"

valid_tree() {
	[ -f "$TARGET/tex/latex/base/article.cls" ] && [ -d "$TARGET/fonts" ]
}

fail() {
	echo "fetch-texmf: $*" >&2
	exit 1
}

if [ -n "${TEXMF_EXTERNAL:-}" ]; then
	valid_tree || fail "$TARGET does not contain a valid texmf-dist tree; check TEXMF_ROOT"
	echo "fetch-texmf: using existing $TARGET"
	exit 0
fi

fingerprint=$(printf '%s\n' "${TEXMF_URL:-}" "$STRIP" | sha256sum | cut -d ' ' -f 1)

if [ -f "$COMPLETE" ]; then
	valid_tree || fail "$TARGET is incomplete; restore the volume or select a new one"
	[ "$(cat "$COMPLETE")" = "$fingerprint" ] || fail "archive configuration changed; select a new volume or migrate the existing tree"
	rm -f "$PENDING"
	echo "fetch-texmf: $TARGET is already populated"
	exit 0
fi

if [ ! -f "$PENDING" ] && valid_tree; then
	echo "fetch-texmf: using existing $TARGET (archive version not recorded)"
	exit 0
fi

if [ -z "${TEXMF_URL:-}" ]; then
	cat >&2 << 'MSG'
fetch-texmf: /texmf is empty and TEXMF_URL is not set.

The TeXLive 2026 server serves a texmf-dist tree that this repository does not
ship. Set one of these in .env:

  TEXMF_URL   URL of a tar archive containing a texmf-dist tree
  TEXMF_ROOT  absolute path to an existing texmf-dist tree on the host

Build the tree with `make build/texlive-full.txt` in texlyre-busytex-build, or
extract it from the TeX Live 2026 ISO.
MSG
	exit 1
fi

case "$TEXMF_URL" in
	*.tar.zst | *.tzst) decompress="zstd -d" ;;
	*.tar.xz | *.txz) decompress="xz -d" ;;
	*.tar.gz | *.tgz) decompress="gzip -d" ;;
	*.tar) decompress="cat" ;;
	*) fail "unsupported archive type for $TEXMF_URL" ;;
esac

mkdir -p "$TARGET"
if [ ! -f "$PENDING" ] && [ -n "$(ls -A "$TARGET")" ]; then
	fail "$TARGET is not empty; inspect the existing tree before replacing it"
fi

apk add --no-cache curl tar xz zstd > /dev/null

if ! curl -fsIL "$TEXMF_URL" -o /dev/null; then
	cat >&2 << MSG
fetch-texmf: cannot reach $TEXMF_URL

If this is the default URL, the release may not have been published yet. Run the
build-texlive-full workflow in texlyre-busytex-build, or set TEXMF_ROOT in .env to
an existing texmf-dist tree on the host.
MSG
	exit 1
fi

if [ -f "$PENDING" ]; then
	echo "fetch-texmf: recovering interrupted initialization"
	find "$TARGET" -mindepth 1 -maxdepth 1 ! -name '.texmf-initializing' -exec rm -rf -- {} +
else
	: > "$PENDING"
fi

echo "fetch-texmf: downloading $TEXMF_URL"
curl -fsSL "$TEXMF_URL" | $decompress | tar -x --strip-components="$STRIP" -C "$TARGET"

valid_tree || fail "invalid texmf-dist tree after extraction; check TEXMF_URL and TEXMF_STRIP"
printf '%s\n' "$fingerprint" > "$COMPLETE.tmp"
mv "$COMPLETE.tmp" "$COMPLETE"
rm -f "$PENDING"
echo "fetch-texmf: populated $TARGET"
