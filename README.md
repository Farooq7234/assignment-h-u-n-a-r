# Candidate Communication Platform

The project contains a Next.js recruiter interface and a JSON API built with standard Django views. Candidate records and each individual email attempt are stored in SQLite. Resend handles email delivery; candidate phone numbers are retained as profile data and are not used for messaging.

## Backend setup

From the repository root in PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
python backend\manage.py migrate
python backend\manage.py runserver
```

The API starts at `http://127.0.0.1:8000/api/`. Candidate management works without provider credentials. Sending messages requires a Resend API key and a verified sender:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Recruiting <recruiting@your-domain.example>
```

Set these values in `backend/.env`. Do not commit that file or share provider credentials.
The Django provider calls the same Resend email endpoint directly. If Resend rejects a send, the backend console logs its HTTP status, error type, and email-redacted provider detail; it never logs the API key or message body.

## Vercel and Neon production setup

SQLite is only the local development fallback. Vercel functions do not provide a durable, shared SQLite file, so production must use PostgreSQL.

1. Create a PostgreSQL project in [Neon](https://neon.tech/). In the Neon dashboard, open **Connect**, select the database, and copy its pooled connection string. Keep it private.
2. In the Vercel project that deploys Django, add these environment variables for Production (and Preview if needed), then redeploy:
   - `DATABASE_URL`: the Neon pooled PostgreSQL connection string. Do not add a `NEXT_PUBLIC_` prefix.
   - `DJANGO_DEBUG`: `false`.
   - `DJANGO_SECRET_KEY`: a newly generated, private Django secret key.
   - `DJANGO_ALLOWED_HOSTS`: the Django deployment hostname(s), comma-separated, without scheme or path (for example `api.example.com`).
   - `FRONTEND_ORIGINS`: the deployed frontend origin(s), comma-separated and including `https://`, without a path, when the frontend and Django API use different origins. If both use the same origin, CORS is not needed for browser requests.
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_WEBHOOK_SECRET` if email sending and webhook verification are enabled.
3. In the Vercel project that builds the frontend, set `NEXT_PUBLIC_API_BASE_URL` to the Django API base URL, including `/api` (for example `https://api.example.com/api`). If frontend and backend share an origin, `/api` is also a valid same-origin base URL. This value is embedded during the frontend build, so redeploy the frontend after changing it.
4. Run migrations against Neon before serving requests. From the repository root in PowerShell:

   ```powershell
   cd backend
   $env:DATABASE_URL = "paste-the-Neon-connection-string-here"
   $env:DJANGO_DEBUG = "true"
   python manage.py migrate
   Remove-Item Env:DATABASE_URL
   Remove-Item Env:DJANGO_DEBUG
   ```

   Setting `DATABASE_URL` explicitly targets Neon for this command; `DJANGO_DEBUG=true` here is only for local management-command settings, not a Vercel setting. The app refuses to start in production without `DATABASE_URL`, `DJANGO_SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS`, rather than silently falling back to SQLite.

### Preserving existing SQLite records

The ignored local `backend/db.sqlite3` in this checkout currently contains 2 candidates, 8 communications, 1 message template, and 22 webhook events. If those records should be copied to Neon, export them from the local SQLite database before importing. Keep the fixture private and out of source control:

```powershell
cd backend
$env:DATABASE_URL = ""
$env:DJANGO_DEBUG = "true"
python manage.py dumpdata communications --indent 2 --output local-data.json

$env:DATABASE_URL = "paste-the-Neon-connection-string-here"
python manage.py migrate
python manage.py loaddata local-data.json
Remove-Item Env:DATABASE_URL
Remove-Item Env:DJANGO_DEBUG
```

The deployed Vercel SQLite data, if any, is separate from this local file and is not reliably persistent or accessible from this checkout. Export it from a still-accessible source before switching databases if it must be preserved; the settings change cannot recover data that was only in an ephemeral function filesystem.

## Frontend setup

In a second PowerShell window:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. `NEXT_PUBLIC_API_BASE_URL` defaults to `http://127.0.0.1:8000/api`.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/candidates/` | List candidates; optional `?search=` filter |
| `POST` | `/api/candidates/` | Create a candidate (`name`, `mobile`, `email`) |
| `GET` | `/api/candidates/{id}/` | Retrieve a candidate |
| `DELETE` | `/api/candidates/{id}/` | Delete a candidate and their history |
| `GET` | `/api/candidates/{id}/history/` | Return newest-first communication history |
| `GET` | `/api/templates/` | List saved message templates |
| `POST` | `/api/templates/` | Create a template with `name` and `body` |
| `PUT` | `/api/templates/{id}/` | Replace a template's `name` and `body` |
| `DELETE` | `/api/templates/{id}/` | Delete a saved template |
| `POST` | `/api/communications/send/` | Send to `candidate_ids` with `message` or `template_id`; optional `scheduled_at` (ISO 8601) schedules delivery |
| `POST` | `/api/communications/{message_id}/retry/` | Retry a failed, retryable email as a new attempt |
| `GET` | `/api/webhooks/resend/` | Confirm the webhook route is reachable |
| `POST` | `/api/webhooks/resend/` | Verify and process Resend delivery events |

Bulk requests deliver independently per candidate and return a result for each attempt. Leave `scheduled_at` out to send immediately; provide a timezone-aware ISO 8601 value to schedule through Resend (at least one minute and no more than 30 days in the future). Scheduled messages appear with `Scheduled` status and transition to `Sent` when Resend reports that delivery has started. Provider failures are recorded as `Failed` with a recruiter-safe explanation and retryability metadata. Resend webhooks are verified with their signing secret and deduplicated by the signed `svix-id` request header. `Read` is based on best-effort email-open tracking and is not a guaranteed read receipt.

Templates may use `{{name}}`, `{{phone}}`, and `{{email}}`. When sending with `template_id`, the backend fills in each recipient's candidate details independently and stores the rendered message in that candidate's communication history, so retries use the same content. Templates are currently shared across the workspace because authentication and user accounts are not configured.

For local webhook development, configure the Resend webhook destination to the publicly reachable `/api/webhooks/resend/` URL and place its signing secret in `RESEND_WEBHOOK_SECRET`. Subscribe to `email.sent`, `email.delivered`, `email.opened`, `email.bounced`, `email.delivery_delayed`, and `email.failed` in the Resend dashboard; subscribing only to `email.sent` will not report delivery or open events. Resend's JSON payload contains `type`, `created_at`, and `data` (including `data.email_id`), while the unique event ID used for deduplication is in the `svix-id` header. Webhook events are acknowledged but ignored safely if they cannot be correlated to a locally recorded provider message.

Troubleshoot webhook delivery by first opening the public `GET` URL and confirming it returns `{"status":"ok"}`. Then inspect the webhook's delivery attempt in Resend: `400` indicates signature verification failed, `5xx` indicates the receiver could not process the request, and a `200` response with `matched: false` means the event's `data.email_id` did not match a locally saved communication. Resend API credentials are separate from webhook signing secrets; verify the API key by checking the application send/API response, and never paste either secret into logs or chat.

## Validation

```powershell
cd backend
python manage.py test
cd ..\frontend
npm run lint
npm run build
```
