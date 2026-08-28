# Free dynamic deployment

The frontend remains static and can be hosted on GitHub Pages or Vercel. Supabase provides the dynamic JSON content, administrator authentication, database, and media storage. All three services have free plans; no server process is required.

## 1. Create the free backend

1. Create a project at [supabase.com](https://supabase.com/).
2. Keep public email registration disabled for this private editor.
3. Deploy the database with either the CLI or SQL Editor instructions below.
4. Open **Authentication > Users > Add user** and create the administrator account.
5. Open `supabase/enroll-admin.example.sql`, replace `admin@example.com`, and run it in **SQL Editor**.
6. Open **Project Settings > API** and copy:
   - Project URL
   - Publishable key, or the legacy `anon` key
7. Put those values in `config.js`.

The browser key in `config.js` is intentionally public. Security comes from Row Level Security. Never place the `service_role` or secret key in this repository.

### Deploy the schema with Supabase CLI

The repository includes `supabase/config.toml` and an idempotent migration.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The project reference is the subdomain in `https://YOUR_PROJECT_REF.supabase.co`. Login opens an interactive browser/token flow; do not commit the generated `.temp` directory or any access token.

### Deploy with SQL Editor instead

Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it once. Do not also run `db push` for the same initial setup unless you first repair migration history.

## 2. Use the admin dashboard

After deployment, open:

```text
https://your-site.example/admin/
```

Sign in with the user created above. The dashboard edits:

- General titles, image, date, music, and page visibility
- Profile rows
- Current-obsessions scrapbook and polaroid
- Favorite games and outbound URLs
- Social links
- Theme colors
- Images and audio through Supabase Storage
- The complete JSON document, including optional custom quiz definitions

Select **Publish** to update the live site without a Git commit or redeployment. The public site falls back to `default-content.js` if Supabase is unavailable.

## 3A. Deploy on GitHub Pages

1. Push the repository to GitHub.
2. In **Settings > Pages**, select **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save. GitHub will publish the site and `/admin/` dashboard.

The current repository already uses this deployment style. No build command is needed.

## 3B. Deploy on Vercel instead

1. Import the GitHub repository in Vercel.
2. Choose **Other** as the framework preset.
3. Leave the build command empty.
4. Set the output directory to `.`.
5. Deploy.

Vercel is optional. It does not replace Supabase in this architecture; it only hosts the same static files.

## Security checklist

- Keep Row Level Security enabled on both tables.
- Keep public registration disabled unless it is needed for another feature.
- Use a long, unique administrator password and enable MFA in Supabase when available.
- Add only trusted user UUIDs to `admin_users`.
- Do not commit secret or service-role keys.
- The dashboard path is not a security boundary. Authentication and RLS are.

## Free-tier note

This design can run at no cost within each provider's free quotas. Providers can change quotas, and inactive Supabase projects may be paused. A paused project does not break the page: visitors receive the built-in fallback content until the project resumes.
