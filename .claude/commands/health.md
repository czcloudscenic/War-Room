Run a sanity check on Vantus + open the architecture map so the user can see red zones visually. Does NOT deploy.

Steps:

1. Read the agent spec at `~/Desktop/Agent Personas/Vantus Build Companion/CLAUDE.md`.
2. Run `npm run build` and capture output. Report:
   - Build succeeded? (size of `dist/`, warnings, errors)
   - Any import resolution failures?
   - Any obvious React warnings (key props, deprecated APIs)?
3. Grep `src/` for:
   - `console.log` / `console.error` — debug statements to clean up
   - `TODO` / `FIXME` / `XXX`
   - Hardcoded secrets (look for `sk_`, `pk_`, `eyJ`, full URLs containing keys)
4. Check `netlify/functions/` for:
   - Unused exports
   - Missing error handling on async calls
5. Run `git status` and `git log --oneline -5` — report current branch, uncommitted changes, recent commits.
6. Run `npm audit` and report severity counts.
7. Probe the live site:
   - `curl -s -o /dev/null -w "%{http_code}\n" https://usevantus.com`
   - `curl -s -o /dev/null -w "%{http_code}\n" -X POST -d '{}' https://usevantus.com/api/agent-action`
8. **Open the architecture map in the user's browser so they can see red zones visually:**
   - `open architecture-map.html` (or generate fresh via the architecture-map skill if it doesn't exist)
   - Tell user: "Architecture map opened — click the 'Roadmap & bugs' chip to highlight every node with known issues."
9. Report findings in this format:
   - 🟢 SAFE TO PUSH / 🟡 FIX WARNINGS FIRST / 🔴 BLOCK PUSH
   - Specific items to fix in priority order, cross-referenced to map node IDs where relevant
   - Pointer to `docs/architecture-map/known-bugs.md` for the full severity-ranked list
10. Do NOT push, do NOT commit, do NOT delete anything.

One-line summary: build status + critical/warning counts + recommended next step.
End with: "Map is open in browser — close it when done."
