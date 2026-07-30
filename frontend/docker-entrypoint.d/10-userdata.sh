#!/bin/sh
set -eu

ROOT=/usr/share/nginx/html
OVERRIDES=/etc/texlyre/overrides
WORK=/tmp/texlyre-userdata
SUBST='${BASE_DOMAIN} ${PRODUCTION_DOMAIN} ${HTTP_PORT} ${HTTPS_PORT}'
EXTRA=recipes.json
AVAILABLE_SERVICES='frontend portainer filepizza ywebrtc peerjs texlive texlive2026 proxy redis'
USERDATA_SERVICES='filepizza ywebrtc texlive texlive2026 proxy'

rm -f "$ROOT/userdata.json" "$ROOT/userdata.mobile.json"

VARIANT="${TEXLYRE_USERDATA_VARIANT:-}"
INLINE="${TEXLYRE_USERDATA:-}"
INLINE_MOBILE="${TEXLYRE_USERDATA_MOBILE:-$INLINE}"

select_services() {
	raw="$(printf '%s' "${SERVICES:-all}" | tr ',\t\r\n' '    ')"
	set -- $raw

	if [ "$#" -eq 0 ]; then
		set -- all
	fi

	selected=''

	for service in "$@"; do
		case "$service" in
			all)
				selected="$AVAILABLE_SERVICES"
				;;
			none)
				if [ "$#" -ne 1 ]; then
					echo "10-userdata.sh: 'none' cannot be combined with other SERVICES values" >&2
					exit 1
				fi
				selected=''
				;;
			*)
				case " $AVAILABLE_SERVICES " in
					*" $service "*)
						case " $selected " in
							*" $service "*) ;;
							*) selected="${selected:+$selected }$service" ;;
						esac
						;;
					*)
						echo "10-userdata.sh: unknown service '$service' in SERVICES" >&2
						exit 1
						;;
				esac
				;;
		esac
	done

	printf '%s' "$selected"
}

SELECTED_SERVICES="$(select_services)"

service_enabled() {
	case " $SELECTED_SERVICES " in
		*" $1 "*) return 0 ;;
		*) return 1 ;;
	esac
}

if [ -z "$VARIANT" ] && [ -z "$INLINE" ] && [ ! -f "$OVERRIDES/$EXTRA" ]; then
	echo "10-userdata.sh: no override configured, serving image defaults"
	exit 0
fi

if [ -n "$VARIANT" ] && [ ! -f "$OVERRIDES/$VARIANT.json" ]; then
	echo "10-userdata.sh: unknown TEXLYRE_USERDATA_VARIANT '$VARIANT'" >&2
	exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK"

prepare_inline() {
	name="$1"
	value="$2"

	if [ -z "$value" ]; then
		return 0
	fi

	printf '%s' "$value" > "$WORK/$name"

	if ! jq -e 'type == "object"' "$WORK/$name" > /dev/null 2>&1; then
		echo "10-userdata.sh: $name must be a JSON object" >&2
		return 1
	fi
}

prepare_inline inline.json "$INLINE"
prepare_inline inline.mobile.json "$INLINE_MOBILE"

overlay() {
	suffix="$1"

	if [ -z "$VARIANT" ] || [ ! -f "$OVERRIDES/$VARIANT$suffix" ]; then
		return 0
	fi

	envsubst "$SUBST" < "$OVERRIDES/$VARIANT$suffix" > "$WORK/overlay$suffix"
	printf '%s\n' "$WORK/overlay$suffix"
}

service_overlays() {
	if [ -z "$VARIANT" ]; then
		return 0
	fi

	for service in $USERDATA_SERVICES; do
		if ! service_enabled "$service"; then
			continue
		fi

		source="$OVERRIDES/$VARIANT.$service.json"
		staged="$WORK/service.$service.json"

		if [ ! -f "$source" ]; then
			continue
		fi

		envsubst "$SUBST" < "$source" > "$staged"
		printf '%s\n' "$staged"
	done
}

extra() {
	if [ ! -f "$OVERRIDES/$EXTRA" ]; then
		return 0
	fi

	envsubst "$SUBST" < "$OVERRIDES/$EXTRA" > "$WORK/$EXTRA"
	printf '%s\n' "$WORK/$EXTRA"
}

staged() {
	if [ -f "$WORK/$1" ]; then
		printf '%s\n' "$WORK/$1"
	fi
}

build() {
	base="$1"
	mobile_suffix="$2"
	inline_name="$3"
	out="$4"

	if [ ! -f "$base" ]; then
		echo "10-userdata.sh: $base missing, skipped" >&2
		return 0
	fi

	set -- "$base"
	set -- "$@" $(overlay .json)

	if [ -n "$mobile_suffix" ]; then
		set -- "$@" $(overlay "$mobile_suffix")
	fi

	set -- "$@" $(service_overlays)
	set -- "$@" $(extra)
	set -- "$@" $(staged "$inline_name")

	jq -s 'reduce .[] as $doc ({}; . * $doc)' "$@" > "$out"
	echo "10-userdata.sh: wrote $(basename "$out") from $# layer(s); services=${SELECTED_SERVICES:-none}"
}

build "$ROOT/userdata.local.json" "" inline.json "$ROOT/userdata.json"
build "$ROOT/userdata.local.mobile.json" ".mobile.json" inline.mobile.json "$ROOT/userdata.mobile.json"

rm -rf "$WORK"
