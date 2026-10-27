# Directus signed-files endpoint

This local Directus endpoint extension issues short-lived, HMAC-signed URLs for
files that the authenticated user is allowed to read. It is used by
SillyTavern Character Manager to share or download original files without
exposing a long-lived access token.

## Configuration

The extension reads these environment variables:

- `SIGNED_FILES_SECRET` — required signing secret of at least 32 characters
- `SIGNED_FILES_DEFAULT_TTL_SECONDS` — default link lifetime; defaults to 300
- `SIGNED_FILES_MAX_TTL_SECONDS` — maximum link lifetime; defaults to 900
- `PUBLIC_URL` — public Directus URL used when returning signed links

Build and validate it with:

```bash
npm ci
npm run build
npm run validate
```

This extension is part of the main project and is not published separately to
the Directus Marketplace.
