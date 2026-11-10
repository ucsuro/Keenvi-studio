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

## GitHub deployment gates

The repository includes three workflows:

- `CI`: runs `npm ci`, type-checking, the production build, and a high-severity
  production dependency audit on pull requests and pushes to `main`.
- `Deploy frontend`: runs only after `CI` succeeds for a push to `main`, then
  waits for approval in the GitHub `production` environment before publishing
  the exact validated commit to Netlify.
- `Deploy Cloud Run backend`: is manual-only and also waits for approval in the
  GitHub `production` environment. Google Cloud authentication uses Workload
  Identity Federation instead of a downloadable service-account key.

Create a GitHub environment named `production`, add yourself as a required
reviewer, and configure these repository environment values:

| Type | Name |
| --- | --- |
| Secret | `NETLIFY_AUTH_TOKEN` |
| Variable | `NETLIFY_SITE_ID` |
| Variable | `VITE_SUPABASE_ANON_KEY` |
| Variable | `GCP_WORKLOAD_IDENTITY_PROVIDER` |
| Variable | `GCP_DEPLOY_SERVICE_ACCOUNT` |
| Variable | `VITE_SUPABASE_URL` |
| Variable | `VITE_R2_PUBLIC_URL` |
| Variable | `R2_BUCKET_NAME` |

Create the Google Cloud OIDC provider and minimum source-deployment permissions
before adding the two `GCP_*` variables:

```powershell
.\deploy\setup-github-gcp.ps1
```

The script prints the two non-sensitive identifiers to save in GitHub. The OIDC
provider accepts tokens only from repository ID `1232138087` on `main`, so a
repository rename or a similarly named repository cannot inherit deployment
access.

After the environment values and required reviewer are verified, disable the
Netlify site's built-in Git production deploys. This prevents Netlify from
publishing a commit before GitHub CI passes; production deploys then come only
from `Deploy frontend`. Do not disable built-in deploys before these GitHub
values have been tested.

## Monitoring and budget

Run the idempotent monitoring setup from the repository root:

```powershell
.\deploy\setup-monitoring.ps1
```

It configures a 60-second HTTPS check for `/api/health` and alert policies for
endpoint outages, Cloud Run 5xx responses, and sustained p95 latency above five
seconds. Alerts go to `ucsuro@gmail.com` and `ucsuro@naver.com`; Google Cloud may
send a one-time email verification request for each notification channel.

The billing account already has a monthly **KRW 10,000** budget named
`₩10,000 월 예산 알림`, with thresholds at 50%, 90%, 100%, and 150%. The setup
script links the same operations email channel while preserving the default
billing IAM recipients. This budget covers the entire billing account rather
than only the `keenvi-studio` project.
