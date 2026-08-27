# Free dynamic deployment

The frontend remains static and can be hosted on GitHub Pages or Vercel. Supabase provides the dynamic JSON content, administrator authentication, database, and media storage. All three services have free plans; no server process is required.

## 1. Create the free backend

1. Create a project at [supabase.com](https://supabase.com/).
2. Open **Authentication > Users > Add user** and create the administrator account. Disable automatic email confirmation only if you understand the trade-off; creating the user from the dashboard is simpler.
3. Copy that user's UUID.
4. Open `supabase/schema.sql`, replace `00000000-0000-0000-0000-000000000000` with the UUID, and run the complete file in **SQL Editor**.
5. Open **Project Settings > API** and copy:
   - Project URL
   - Publishable key, or the legacy `anon` key
6. Put those values in `config.js`.

The browser key in `config.js` is intentionally public. Security comes from Row Level Security. Never place the `service_role` or secret key in this repository.

## 2. Use the admin dashboard

After deployment, open:

```text
https://your-site.example/admin/
```

Sign in with the user created above. The dashboard edits:

- General titles, image, date, music, and page visibility
- Profile rows
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
