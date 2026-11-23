#!/bin/sh
# Renders the TUI parts headlessly in a throwaway container. The plugin is mounted read-only at /work/plugin;
# OpenTUI, Solid and stubs of @opencode/plugin (which only exists inside OpenCode) are installed here, in test-ui/.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
podman run --rm -v "$here":/work -v "$here/..":/work/plugin:ro -w /work docker.io/oven/bun:1 sh -c '
  bun install >/dev/null
  mkdir -p node_modules/@opencode/plugin && cp stubs/@opencode/plugin/* node_modules/@opencode/plugin/
  if [ "$#" -eq 0 ]; then set -- ./schedule.test.tsx ./editor.test.tsx ./dashboard.test.tsx; fi
  bun test "$@"
' sh "$@"
