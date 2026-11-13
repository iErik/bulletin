#!/bin/sh
# Runs pnpm with the given arguments, so the git hooks
# work wherever the commit is made. Inside the Nix
# shell, pnpm is on the PATH and runs directly.
# Elsewhere (a terminal without direnv, a GUI client),
# the command runs through the repo's dev shell with
# `nix develop -c`. GUI clients often leave the Nix
# profile off the PATH, so nix is also looked for in
# its standard install locations.
#
#   scripts/pnpm-or-nix.sh exec eslint <files>

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm "$@"
fi

root=$(cd "$(dirname "$0")/.." && pwd) || exit 1

nix=$(command -v nix 2>/dev/null)
for candidate in \
  /nix/var/nix/profiles/default/bin/nix \
  "$HOME/.nix-profile/bin/nix"
do
  [ -n "$nix" ] && break
  [ -x "$candidate" ] && nix=$candidate
done

if [ -z "$nix" ]; then
  cat >&2 <<MSG
error: neither pnpm nor nix was found.
  Looked on the PATH, and for nix in
  /nix/var/nix/profiles/default/bin and
  $HOME/.nix-profile/bin.
Install Nix (https://nixos.org/download), or run
this from the dev shell (\`nix develop\`, or direnv).
MSG
  exit 1
fi

exec "$nix" develop "$root" -c pnpm "$@"
