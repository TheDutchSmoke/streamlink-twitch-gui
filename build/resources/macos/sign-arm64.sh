#!/usr/bin/env bash
set -euo pipefail

app="${1:-}"
entitlements="${2:-}"
identity="${MACOS_SIGN_IDENTITY:--}"

fail() {
	echo >&2 "$@"
	exit 1
}

[ "$(uname -s)" = "Darwin" ] || fail "macOS arm64 bundles must be signed on macOS"
[ -d "$app" ] || fail "Application bundle does not exist: $app"
[ -f "$entitlements" ] || fail "Entitlements file does not exist: $entitlements"
command -v codesign >/dev/null || fail "codesign is required"

app="$(cd "$(dirname "$app")" && pwd)/$(basename "$app")"
entitlements="$(cd "$(dirname "$entitlements")" && pwd)/$(basename "$entitlements")"

plain_args=( --force --sign "$identity" )
process_args=( --force --sign "$identity" --entitlements "$entitlements" )

# Developer-ID signing can opt into the hardened runtime while local/CI builds
# use ad-hoc signatures. Timestamping is only valid for non-ad-hoc identities.
if [ "$identity" != "-" ]; then
	plain_args+=( --options runtime --timestamp )
	process_args+=( --options runtime --timestamp )
fi

sign_plain() {
	codesign "${plain_args[@]}" "$1"
}

sign_process() {
	codesign "${process_args[@]}" "$1"
}

# The NW.js builder modifies the downloaded app bundle, helper names and plist
# files. Apple Silicon requires valid signatures for all executable code, so
# replace the stale upstream signatures after every build mutation.
while IFS= read -r file_path; do
	file_info="$(file "$file_path")"
	case "$file_info" in
		*"Mach-O"*"executable"*)
			sign_process "$file_path"
			;;
		*"Mach-O"*)
			sign_plain "$file_path"
			;;
	esac
done < <(find "$app" -type f -print)

# Sign nested process bundles before their containing framework and the outer
# application bundle. This keeps the final code-resource seals valid.
while IFS= read -r nested_app; do
	sign_process "$nested_app"
done < <(find "$app/Contents/Frameworks" -type d \( -name '*.app' -o -name '*.xpc' \) -print)

while IFS= read -r framework; do
	sign_plain "$framework"
done < <(find "$app/Contents/Frameworks" -type d -name '*.framework' -print)

sign_process "$app"

codesign --verify --deep --strict --verbose=2 "$app"
