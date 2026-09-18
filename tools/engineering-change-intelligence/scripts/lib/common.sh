#!/usr/bin/env bash
# common.sh - helpers shared by the ECI scripts. Source it, do not run it.
#
# Works on Linux/macOS bash and on Windows Git Bash with a native Windows Python:
#   - Python always runs with UTF-8 stdio (Windows defaults to cp1252).
#   - Paths handed to Python go through eci_pypath, which turns a Git Bash
#     path like /c/Users/... into C:/Users/... (cygpath -m) when cygpath exists.
#   - Script output is plain ASCII.

export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

eci_die() {
  echo "ERROR: $*" >&2
  exit 1
}

eci_log() {
  echo "$*" >&2
}

# eci_find_python: sets PY to a Python 3.8+ interpreter or exits.
eci_find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 \
      && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
      PY="$candidate"
      return 0
    fi
  done
  eci_die "Python 3.8+ is required (tried python3 and python)."
}

# eci_pypath PATH: print PATH in a form a native Python can open.
eci_pypath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m -- "$1"
  else
    printf '%s' "$1"
  fi
}

# eci_need_value OPTION ARGC: fail when an option that takes a value is last.
eci_need_value() {
  [[ "$2" -ge 2 ]] || eci_die "$1 needs a value"
}
