# Vercel function budget

AjaxPro deliberately permits at most 10 function entrypoints under `api/`, leaving two slots below the Vercel Hobby limit of 12. URL routes do not require separate functions: keep implementation modules in `api-impl/` and dispatch them through existing routers with rewrites.

The public homepage remains static. `/api/home`, `/api/auth/session-status` and `/api/navigation-status` are preserved through the Club portal router; their handlers retain their own session checks and response headers. The homepage handler explicitly includes `index.html` in its function bundle.

The FFmpeg card-video function stays independent because it needs its own binary assets and timeout. Do not consolidate it into the portal router.

`node scripts/check-function-limit.mjs` lists entrypoints and fails above 10. The public build, tests and GitHub Actions run this check. When adding a supported runtime or changing deployment tooling, update the entrypoint detection and inspect the generated `.vercel/output/functions` as well.
