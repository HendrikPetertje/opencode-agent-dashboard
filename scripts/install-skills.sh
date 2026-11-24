#!/usr/bin/env bash
# Links every skill in ./skills into the OpenCode skill folder. Safe to run again; never replaces anything it did not create.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
target="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skill"
mkdir -p "$target"

status=0
for skill in "$here"/skills/*/; do
  [ -f "$skill/SKILL.md" ] || continue
  source="${skill%/}"
  link="$target/$(basename "$source")"
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$source" ]; then
    echo "skill $(basename "$source"): already linked"
  elif [ -e "$link" ] || [ -L "$link" ]; then
    echo "skill $(basename "$source"): $link exists and is not a link to $source, leaving it" >&2
    status=1
  else
    ln -s "$source" "$link"
    echo "skill $(basename "$source"): linked $link"
  fi
done
exit "$status"
