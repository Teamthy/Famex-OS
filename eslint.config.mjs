// Flat ESLint config for ESLint 9 / Next.js 16.
// Next.js 16 removed `next lint`; run `eslint .` via `npm run lint`.
// eslint-config-next@16 ships a native flat config array, so no FlatCompat needed.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "_backups/**",
      ".history/**",
      "prisma/migrations/**",
      "scripts/**",
      "tests/**",
      "mobile/**",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Match the previous permissive intent (lint never actually ran before).
      // Unused code is debt — treat it as an error. Underscore-prefixed names
      // are the documented "intentionally ignored" convention; everything else
      // must be removed or used.
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      // Obsolete in the App Router.
      "@next/next/no-html-link-for-pages": "off",
      // eslint-plugin-react-hooks v6 (shipped with eslint-config-next@16) added
      // aggressive new rules. They were first surfaced as warnings; after review
      // (see below) they stay warnings BY DESIGN, not by omission.
      //
      // Why not errors:
      //   - set-state-in-effect (64 hits): flags the standard "load data in a
      //     useEffect" and "hydrate state from localStorage" patterns used across
      //     ~60 portal pages. Those are legitimate React patterns; forcing them to
      //     errors would push the code into worse shapes for no correctness gain.
      //   - immutability (4): false positives such as `window.location.href = x`.
      //   - purity (1): Date.now() in render inside a client component — no
      //     hydration concern.
      //   - use-memo (2): the intentional `[url, ...deps]` spread in the shared
      //     useApi/useOffline hooks, already covered by an inline eslint-disable.
      //   - exhaustive-deps (2): both on correct dependency arrays.
      // Keeping these as warnings still surfaces NEW suspicious code in CI output
      // while not demanding refactors of correct code. If a rule's signal improves
      // (or a genuine bug appears), promote it with evidence in the PR.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
