# Dhanesh AI Job Tool — server-backed upgrade

This project **preserves the uploaded original website** at `/` and adds `/automation.html`, Netlify Functions, a 6-hour scheduled discovery run, a persistent Netlify Blobs tracker, a verification queue, and a **conditional** auto-submission integration. It is **not** an all-platform form-filling bot. The original browser-only tracker stays in your browser and does not merge automatically with the new server-side tracker.

## Important: what works out of the box

- Scheduled and on-demand search of the **public Greenhouse and Lever company boards you configure**. These are not all jobs on the internet, nor LinkedIn/Naukri/Indeed.
- A live, server-side job tracker and actual submission-confirmation log.
- Auto-submit of **reviewed, eligible jobs only if you independently set up an authorized submission adapter** as described below. There is no adapter in this package, so zero automatic applications are expected until it is configured. Public Greenhouse/Lever read endpoints do **not** confer application-submit authorization.
- The existing website's resume tailoring creates **text excerpts only**; this package does not generate/upload a complete DOCX or PDF. Do not mark `resumeVerified` until your authorized adapter already has a complete accurate resume and the correct screening answers.

## Candidate preferences

Notice period: 90 days. Current CTC: ₹12 LPA. Expected CTC: ₹17 LPA. Hard minimum: ₹15 LPA *verified annual guaranteed salary*. Preferred location: any country. Work authorization/sponsorship: **unverified for each country**. Your two unspecific Yes/No answers were not used to assert country-specific visa or screening eligibility. Verify these per posting. A salary with no credible evidence does not meet the automatic-application filter.

## Deploy — use Git-based Netlify build, NOT drag-and-drop

1. Create a **private** GitHub repository containing the **contents** of this folder. Do not publish resume files, contact data, API tokens, or tracker exports in the repo.
2. In Netlify choose **Add new project → Import an existing project**, select that repository, set build command `npm run build` and publish directory `public` (also provided by `netlify.toml`). Netlify will install dependencies and deploy functions and the schedule.
3. Configure **Project configuration → Environment variables** for the production deploy:
   - `ADMIN_TOKEN`: a new random 32+ character secret. Do not hard-code this in the site, repo, or screenshot.
   - `GREENHOUSE_BOARDS`: comma-separated **company-specific board tokens**, e.g. `examplecompany1,examplecompany2`; only boards with those exact tokens are queried.
   - `LEVER_SITES`: comma-separated **company-specific Lever site tokens**.
   - For automatic submission only: `APPLICATION_ADAPTER_URL` and `APPLICATION_ADAPTER_TOKEN`, described below.
4. Trigger **Deploy project**. Open `https://<your-site>/automation.html`, paste `ADMIN_TOKEN`, then click **Search configured company boards now**. Check the Netlify Functions list: `jobs` and `scheduled` should appear. Netlify scheduled function deployment and Blobs require project/plan support; check the deploy log if a feature is unavailable.
5. You may connect your existing site's custom domain to the **new** Git-deployed project after testing. A new deployment **does not** automatically replace your original Netlify Drop project. Avoid sharing your admin token or sending it in a public URL.

## Automatic submission: integration contract (not included)

`APPLICATION_ADAPTER_URL` must be an HTTPS API **that you operate or have explicit authorization to use** and which actually submits applications to that particular employer's supported system. `APPLICATION_ADAPTER_TOKEN` is its bearer secret. The scheduled function POSTs to that endpoint only for jobs marked **Ready** after all verification checks pass. It sends the source, external job ID, job URL, candidate name, notice period, current / expected / minimum salary, and an idempotency key. It deliberately does **not** include your complete resume, phone, email, visas, or employer-specific questionnaire answers; the adapter must securely own and validate those separately. The adapter must refuse unsupported job sources and must not claim application submission when it merely opened a job URL. It must return HTTP 2xx JSON such as:

```json
{"status":"submitted","confirmationId":"real-employer-confirmation-123"}
```

**Only a confirmed response** moves a job to Applied. Errors or ambiguous timeouts are logged as unconfirmed and marked Needs review, rather than blindly re-submitted. The API should implement idempotency keyed by the job ID to prevent duplicate applications if a response is lost. The adapter must handle any user-required approvals, CAPTCHA, consent, and applicant-account constraints lawfully and truthfully; where a portal lacks an authorized API, use its employer page to submit manually.

## Troubleshooting

- **No functions on Netlify**: you redeployed just `public/` or used Netlify Drop. Import the entire repo with `package.json`, `netlify.toml`, and `netlify/functions/` through Git.
- **401 Unauthorized**: `ADMIN_TOKEN` is missing, shorter than 24 characters, or not the token entered in the console. Redeploy after setting it.
- **No jobs**: configure real employer board tokens; many company boards have none matching title/skills, or the provider may be temporarily unavailable. Read the last-run errors in the console.
- **No submitted applications**: inspect Ready jobs, verification flags, adapter configuration, adapter logs, and real confirmation IDs. This package never claims a job was applied for merely because a listing was discovered.
- **No salary published**: leave the job unverified; do not guess salary or mark it as eligible.

## Data and security notes

Netlify Blobs stores server-side jobs, manual eligibility reviews and submission results. It is a personal tool, **not** a multi-user authenticated application: protect the admin token, enable Netlify site access controls if available, and do not expose your personal resume or credentials in public files. The automation console holds the token in memory in the current tab, not localStorage. The original static browser tracker still keeps its separate localStorage data. Do not store any third-party site passwords in Netlify environment variables or the code. API access is protected by `ADMIN_TOKEN`, but there is no user-account management, MFA, audit log, or per-user rate limiting.
