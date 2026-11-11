#!/usr/bin/env bash
# PreToolUse guard for the reviewer subagent: only read-only git commands plus lint/build.
# Exit 2 blocks the call and sends stderr back to the agent.
cmd=$(jq -r '.tool_input.command // ""')

# Reject chaining, redirection and substitution so one allowed prefix can't smuggle another command.
if [[ "$cmd" =~ [\;\&\|\>\<\`] || "$cmd" == *'$('* ]]; then
  echo "Blocked: reviewer may not chain, redirect or substitute commands. Run one command at a time." >&2
  exit 2
fi

case "$cmd" in
  "git status"*|"git diff"*|"git log"*|"git show"*|"git ls-files"*) exit 0 ;;
  "pnpm lint"|"pnpm build") exit 0 ;;
esac

echo "Blocked: reviewer may only run git status/diff/log/show/ls-files, pnpm lint and pnpm build. Report other checks as pending for the implementer." >&2
exit 2
