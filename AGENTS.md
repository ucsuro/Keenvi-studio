# Repository guidance

## Project purpose

This repository is the Keenvi Studio portfolio. Preserve its visual identity and
content while preparing it to run at `studio.keenvi.art`. A future service at
`keenvi.art` should live in a separate repository and deployment.

## Required workflow

- Use Node.js 24 LTS; do not support versions below 22.12.
- Install with `npm ci` when validating the lockfile.
- Run `npm run lint` and `npm run build` after code changes.
- Keep `.env.local`, credentials, access tokens, and service keys out of Git.
- Do not push, deploy, or change DNS unless the user explicitly requests it.

## Architecture

- `src/`: React client.
- `server.ts`: Express development/production server and R2 image operations.
- `src/lib/supabase.ts`: public Supabase browser client.
- `src/lib/api.ts`: authenticated calls from the client to Express routes.
- `public/_redirects`: Netlify SPA fallback and legacy Cloud Run proxy.

## Security

- Admin access must use Supabase sessions; never add fallback or hardcoded
  passwords.
- Mutating server routes and all R2 operations must use `requireAdmin`.
- Treat `VITE_*` values as public browser configuration.
- Treat R2 secret keys and any Supabase service-role key as server-only secrets.
- Consider both Express authorization and Supabase Row Level Security when
  changing admin features.

## Deployment direction

- Current portfolio: existing repository and Netlify site, eventually
  `studio.keenvi.art`.
- Future Keenvi service: separate repository and Netlify site at `keenvi.art`.
- Keep the apex domain on the portfolio until the new service is ready and the
  studio subdomain has been verified.
