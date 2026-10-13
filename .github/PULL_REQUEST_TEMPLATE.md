## Summary

<!-- What does this PR do, and why? One or two sentences. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Documentation
- [ ] Dependency / tooling

## How it was tested

- [ ] `npm run lint` (0 errors)
- [ ] `npm run typecheck`
- [ ] `npm run format:check`
- [ ] `npm test`
- [ ] Added/updated tests (describe which)

<!-- If relevant, note manual testing steps or E2E scenarios. -->

## Security / correctness notes

<!-- Does this touch auth, money, multi-tenancy, or uploads? If so, describe the
safety measures. If you removed an import/variable, confirm it was genuinely
unused. -->

## Checklist

- [ ] No new unused imports/variables (`no-unused-vars` is an error)
- [ ] No unbounded queries (uses `lib/pagination.ts` for lists)
- [ ] Error responses use the structured `logger` (not raw `console.error`)
- [ ] Secrets / PII not logged or committed
