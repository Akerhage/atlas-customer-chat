# Atlas Kundchatt

> LEGACY WORKTREE - DO NOT BUILD PROD FROM HERE
>
> Current source-of-truth for production customer chat builds is:
> `C:\Atlas\tests\kundchatt_runtime_logo_worktree`
>
> This directory is kept only for history/comparison. Do not run production
> `npm run build` from this worktree unless Patrik explicitly asks for a
> migration and runtime tenant branding (`/api/tenant-name` +
> `company_logo_url`) has been re-verified first.

This repository contains the source for the Atlas customer chat at
`/kundchatt/`. The built bundle is copied into the main Atlas repository under
`C:\Atlas\kundchatt`.

## Critical Tenant Rules

The customer chat is shared code for all Atlas boxes. Do not create separate git
branches for individual boxes such as `atlas`, `atlas-htig`, `atlas-base`, or a
future customer. Tenant identity must come from same-origin runtime APIs on the
box that serves the widget.

Required runtime sources:

- `GET /api/tenant-name`
- `GET /api/public/config`
- `GET /api/public/offices`
- `GET /api/public/templates/kundchatt`

The production bundle must not hardcode a customer logo, customer name, support
name, website, office list, or customer-specific questions. In particular, do not
import or render `mda-logga.png` or any future customer logo in React code. The
chat header and welcome UI must use `company_logo_url` and `company_name` from
`/api/tenant-name`, with Atlas as the only allowed fallback.

Relative logo URLs from `/api/tenant-name`, for example
`/api/public/tenant-assets/...`, must resolve against the current origin. This
keeps the same bundle safe on `atlas-support.se`, `htig.atlas-support.se`,
`base.atlas-support.se`, and future boxes.

## Build And Verify

Before a customer chat deploy:

```powershell
cd C:\Atlas\tests\kundchatt_runtime_logo_worktree
git status -sb
npm run build
rg -n "mda-logga|mydriving|Hållbara Trafikskolan|ATLAS BASPRODUKT" dist\assets\*.js
rg -n "tenant-name|company_logo_url" dist\assets\*.js
```

Expected result:

- The first `rg` returns no matches in built JS.
- The second `rg` confirms that runtime tenant branding is used.
- Visual smoke is run on every affected live box, not only local code.

## Git And Deploy Practice

Commit source changes in this repository. Commit the built `kundchatt/` output in
the main Atlas repository only after the source build is verified.

Do not commit tenant data in either repo. The following are box-specific and must
remain VPS-only:

- `.env`
- `atlas.db`
- `knowledge/`
- `config.json`
- `utils/booking-links.json`
- `uploads/`
- `public/tenant-assets/`

When deploying, copy a consistent `kundchatt/index.html` plus the referenced JS
and CSS assets together. Never leave a new JS file in `kundchatt/assets/` while
`index.html` still points to an older bundle.

Recommended commit shape:

```powershell
# Source repo
git add src package.json package-lock.json README.md
git commit -m "fix(customer-chat): runtime tenant branding"
git push origin codex/customer-chat-runtime-logo

# Main Atlas repo, after copying dist to C:\Atlas\kundchatt
git -C C:\Atlas add kundchatt
git -C C:\Atlas commit -m "build(customer-chat): update runtime tenant branding bundle"
```

## Local Development

```powershell
npm i
npm run dev
```

## Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
