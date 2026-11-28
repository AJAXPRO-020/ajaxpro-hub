# AjaxPro Hub development source

This checkout is the canonical local source for AjaxPro Hub development and deployments.

- Repository: `https://github.com/AJAXPRO-020/ajaxpro-hub.git`
- Branch: `main`
- Local path: `/Users/zag/Documents/ajaxpro-hub`
- Current release baseline: `459b7ea`
- Production alias: `https://ajaxpro.fans`
- Public build: `node scripts/build-public.mjs`
- Typecheck: `npm run typecheck`
- Full test command: `npm test`

The Shirt Battle production logic lives in `assets/shirt-battle/battle-logic.js` and its direct regression test is `tests/shirt-battle-logic.test.js`.

The full `tsx --test` runner currently requires an IPC pipe that is blocked by this managed execution environment. TypeScript checking, the public build, direct Shirt Battle regression tests, and dependency auditing remain runnable from this checkout.
