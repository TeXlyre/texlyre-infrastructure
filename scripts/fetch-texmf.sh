#!/bin/sh
set -eu

TARGET=/texmf
STRIP="${TEXMF_STRIP:-1}"

if [ -d "$TARGET/tex" ]; then
	echo "fetch-texmf: $TARGET is already populated"
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
	*)
		echo "fetch-texmf: unsupported archive type for $TEXMF_URL" >&2
		exit 1
		;;
esac

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

echo "fetch-texmf: downloading $TEXMF_URL"
mkdir -p "$TARGET"
curl -fsSL "$TEXMF_URL" | $decompress | tar -x --strip-components="$STRIP" -C "$TARGET"

if [ ! -d "$TARGET/tex" ]; then
	echo "fetch-texmf: no tex/ directory after extraction, check TEXMF_URL and TEXMF_STRIP" >&2
	rm -rf "${TARGET:?}"/*
	exit 1
fi

echo "fetch-texmf: populated $TARGET"
