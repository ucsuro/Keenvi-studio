# Keenvi Studio

Keenvi Studio portfolio site. The current production site is `keenvi.art`; the
portfolio is planned to move to `studio.keenvi.art` when the new Keenvi service
replaces the apex domain.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS
- Supabase for public content and email/password authentication
- Express and Sharp for local API and image processing
- Cloudflare R2 for uploaded media
- Netlify for the frontend deployment

## Local setup

Node.js 24 LTS is recommended. The minimum supported version is Node 22.12.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open <http://localhost:3000>.

Public browser configuration belongs in `VITE_*` variables. R2 access keys are
server-only secrets and must stay in `.env.local` or the deployment secret
store. Never commit `.env.local`.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```

## Authentication

Admin login uses Supabase email/password authentication. Protected Express API
routes require the Supabase access token. Every environment also requires
`ADMIN_EMAILS`, a comma-separated allowlist of administrator email addresses.
After sign-in, the client verifies the account through `/api/admin/me`; accounts
outside the allowlist are signed out and never receive the admin interface.

Direct browser writes are protected by the migration in `supabase/migrations`.
Apply it and add the existing Auth user's UUID to `public.admin_users` using the
instructions in `supabase/README.md` before production deployment.

## Image uploads

Uploads accept JPEG, PNG, WebP, GIF, and AVIF images up to 25 MB. Remote
thumbnail generation only accepts HTTPS images from the configured R2 and
Supabase hosts, ArtStation's image CDNs, and optional hosts listed in
`THUMBNAIL_ALLOWED_HOSTS`. Remote downloads are limited to 15 MB and 10 seconds.

## Deployment note

`public/_redirects` still proxies `/api/*` and `/uploads/*` to the legacy Google
AI Studio Cloud Run service. The updated `server.ts` must be deployed to a
backend first; publishing only the Netlify frontend would leave the production
API on the old authentication and upload code. Add and verify
`studio.keenvi.art` on the current Netlify site before moving `keenvi.art` to a
new service deployment.

Legacy AI Studio project:
<https://ai.studio/apps/4d41f249-6595-4437-bd65-40e2f6c6a666>
