# Production deployment order

The frontend is hosted by Netlify and the authenticated image API is hosted by
Cloud Run. Deploy in this order so the frontend never points at incompatible API
code.

## 1. Supabase

Apply `supabase/migrations/202609160001_admin_rls.sql`, then register the current
Supabase Auth user as described in `supabase/README.md`. Confirm that anonymous
users can read but cannot insert, update, or delete `gallery_items` and
`site_settings`.

## 2. Google Cloud secrets

Create these Secret Manager secrets in the selected Google Cloud project and
add a current version to each:

- `keenvi-supabase-anon-key`
- `keenvi-admin-emails`
- `keenvi-r2-account-id`
- `keenvi-r2-access-key-id`
- `keenvi-r2-secret-access-key`

The Cloud Run runtime service account needs Secret Manager Secret Accessor on
those secrets. The person deploying also needs Cloud Run, Cloud Build, Artifact
Registry, Service Account User, and Secret Manager permissions.

The deployment uses the dedicated runtime identity
`keenvi-studio-api@keenvi-studio.iam.gserviceaccount.com` rather than the
project-wide default Compute Engine service account.

The local values can be synchronized without printing them by running:

```powershell
.\deploy\sync-cloud-secrets.ps1
```

## 3. Cloud Run backend

Install and authenticate Google Cloud CLI, then run from the repository root:

```powershell
.\deploy\deploy-cloud-run.ps1
```

The script reads the three non-secret deployment values from `.env.local` by
default. They can still be supplied as parameters when needed.

The deployment project is `keenvi-studio` (project number `1046121485048`). The
default region is `asia-east1`, matching the existing AI Studio Cloud Run
service, and the new service name is `keenvi-studio-api`. The existing
AI Studio-managed `ais-dev-*` service in project number `25710283100` is not modified. The script builds from
`Dockerfile`, deploys the new API, and prints its URL. Verify `/api/health`,
unauthenticated 401 responses, authenticated `/api/admin/me`, image upload,
thumbnail generation, and R2 cleanup.

## 4. Netlify frontend

`public/_redirects` points to the verified `keenvi-studio-api` service. Commit
and push the reviewed changes. Netlify can then build from GitHub using
`npm run build` and publish `dist`.

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_R2_PUBLIC_URL` in
Netlify. Do not add R2 credentials or Google Cloud secrets to Netlify's frontend
build environment.
