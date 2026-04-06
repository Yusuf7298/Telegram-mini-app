description: "Polish a frontend page or section with intentional design and concise verification"
name: "Polish Frontend UI"
argument-hint: "Describe the page/section to improve and your visual direction"
agent: "agent"
---
Polish a frontend page or section in this workspace with production-quality edits.

Target: ${input:Which page/component should be improved?}
Visual direction: ${input:What look and feel do you want (professional, playful, editorial, etc.)?}
Acceptance criteria: ${input:What must be true when done?}
Constraints: ${input:Any constraints (brand colors, copy, keep structure, no dependency changes, etc.)?}

Requirements:
1. Confirm understanding in 1-2 lines before making edits.
2. Inspect relevant files and existing patterns before changing code.
3. Keep UX intentional: clear hierarchy, confident typography, strong spacing rhythm, and responsive behavior.
4. Avoid generic UI defaults; choose a distinct visual direction while respecting existing project patterns.
5. Make the smallest correct change set that delivers the requested polish.
6. Run relevant frontend checks when possible.
7. If a check cannot run, state why and what remains unverified.
8. Return results in this format:

## Outcome
- Implemented: <yes/no>
- Summary: <short description>

## Files Changed
- <path>: <what changed and why>

## Verification
- Commands run:
  - <command>
- Result:
  - <pass/fail + important details>

## Notes
- Risks/assumptions: <if any>
- Follow-up options: <optional, concise>

Use project-specific guidance from [frontend/AGENTS.md](../../frontend/AGENTS.md) when working in frontend code.
