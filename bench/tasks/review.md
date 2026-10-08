You are a blind senior reviewer (Astro 7 + Svelte 5 runes + Tailwind 4 + TypeScript). Several independent
implementations of the same feature are in `{BLIND_DIR}` as `<label>.diff`. The spec is `{TASK_FILE}`. The base
repo, for existing code style, is `{REPO}`. It is read-only: do not modify anything anywhere.

The implementations already went through the same automated checks, so focus on code quality. For each diff,
score 1-10 on:

1. Correctness and edge cases (input normalization, plurals, URL parsing and invalid values, Svelte 5 reactivity
   pitfalls, SSR and hydration).
2. Clarity and structure, including the split into pure utilities.
3. Consistency with the conventions of the existing repo.
4. Accessibility and UX.
5. Performance and payload (data shipped twice, bundle size).

List the 2-4 most significant concrete issues per diff with file:line references. Give an overall score out of
10 per diff. Do not guess which tool, style or person wrote which diff.

End with one CSV line per diff, and nothing after them: `<label>,<overall score>`
