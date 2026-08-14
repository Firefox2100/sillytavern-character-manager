# SillyTavern Character Manager

SillyTavern Character Manager is a self-hosted web library for browsing and
sharing SillyTavern resources. The React frontend presents content stored in a
Directus backend, while Nginx serves the application and exposes Directus under
the same origin at `/api`.

The application supports:

- Character card browsing, search, and author/tag filtering
- Included and excluded tag filters
- Character versions, fork relationships, source links, and version notes
- Inspection of character data embedded in PNG cards
- Card downloads and time-limited signed download links
- Database template and world book browsing
- Directus authentication, including one-time passwords
- English and Chinese interfaces

## Architecture

The deployment contains two services:

- `app` — the React production build served by Nginx from
  `ghcr.io/firefox2100/sillytavern-character-manager:latest`
- `directus` — Directus 12 with a persistent SQLite database, uploads, and
  locally built extensions

Only the application is published to the host. Requests to `/api` are reverse
proxied by Nginx to Directus over the private Compose network.

Persistent state is stored in:

- `data/database` — the Directus SQLite database
- `data/uploads` — uploaded character cards and other files

The data model is defined by `directus-snapshot.json`, and Directus extensions
live under `extensions/`.

## Installation

### Requirements

- Linux or another environment capable of running the included Bash script
- Docker Engine
- Docker Compose v2 (`docker compose`)
- Access to the project's GitHub Container Registry image

The startup script uses Docker as the current user when possible. If the Docker
daemon requires elevated privileges, it falls back to `sudo` and prompts for a
password.

### 1. Clone the repository

```bash
git clone https://github.com/Firefox2100/sillytavern-character-manager.git
cd sillytavern-character-manager
```

### 2. Configure Directus

Before the first start, edit `docker-compose.yml` and replace these placeholder
values:

- `SECRET`
- `SIGNED_FILES_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Use different, randomly generated values of at least 32 characters for the two
secrets. The admin credentials are used to create the initial Directus
administrator when the database is first bootstrapped.

If the site will be accessed through a hostname or HTTPS reverse proxy, also
change `PUBLIC_URL` from `http://localhost:8769/api` to its externally reachable
URL, including the `/api` suffix.

### 3. Authenticate with GHCR when necessary

No login is needed when the package is public. For a private package, create a
GitHub personal access token with `read:packages`, then run:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

When Docker requires `sudo` on the host, authenticate using the same Docker
invocation that the startup script will use.

### 4. Start the application

```bash
./start-service.docker.sh
```

The script performs the complete initialization sequence:

1. Verifies that Docker and Docker Compose are usable.
2. Pulls the frontend and Directus images.
3. Pulls `node:22-alpine` and builds every Directus extension containing a
   `package.json`.
4. Bootstraps Directus and applies `directus-snapshot.json`.
5. Starts both services in the background.

Open <http://localhost:8769> after startup. On first use, sign in with the
Directus administrator credentials configured in `docker-compose.yml`.

## Usage

After signing in, use the top navigation to switch between character cards,
database templates, and world books.

- Search character cards by name, author, source URL, or tag.
- Filter cards by author and require or exclude individual tags.
- Open a card to select a version, inspect embedded card fields, follow its
  source or fork relationship, download the PNG, or copy a signed link.
- Filter database templates and world books by author and inspect their stored
  content.
- Use the language selector to switch between English and Chinese.

Content and user accounts are administered through Directus. Its interface is
available through the proxied path at <http://localhost:8769/api/admin>.

### Updating

Pull the latest repository changes and rerun the startup script:

```bash
git pull
./start-service.docker.sh
```

It pulls current images, rebuilds extensions, reapplies the schema snapshot,
and recreates services when required. Existing database and upload data remain
in the bind-mounted `data/` directories.

### Service management

View status and logs:

```bash
docker compose ps
docker compose logs -f
```

Stop the services without deleting persistent data:

```bash
docker compose down
```

Back up both `data/database` and `data/uploads` before upgrades or schema
changes.

## Local frontend development

Install dependencies and start Vite:

```bash
npm ci
npm run dev
```

The development proxy expects Directus at `http://localhost:8055`. The
production deployment instead uses the Nginx `/api` proxy configured in
`nginx.conf`.

Other useful commands:

```bash
npm run build
npm run lint
npm run preview
```
