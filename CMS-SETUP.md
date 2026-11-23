# Portfolio CMS setup

The CMS is implemented on the isolated `cms-development` branch. The live `main` branch has not been changed.

## 1. Create the Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Open **Project Settings → API** and copy the Project URL and anon/public key.
4. In the repository, edit `cms-config.js` and replace the two `YOUR_...` values. This file contains public browser settings only.

## 2. Create the first CMS login
1. In Supabase, open **Authentication → Users → Add user** and create your email/password login.
2. Copy the user's UUID.
3. In SQL Editor, run:
   ```sql
   update public.cms_profiles
   set role = 'admin'
   where id = 'PASTE-YOUR-USER-UUID';
   ```
4. Create any additional accounts in Authentication → Users. They are editors by default; only admins can publish.

## 3. Configure secure publishing
The GitHub token must stay server-side; never put it in `cms-config.js`.
1. Create a fine-grained GitHub token for this repository with **Contents: Read and write** permission.
2. Install the Supabase CLI and link this project.
3. Set the Edge Function secrets:
   ```sh
   supabase secrets set GITHUB_TOKEN=YOUR_GITHUB_TOKEN
   supabase secrets set SUPABASE_URL=YOUR_PROJECT_URL
   supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```
4. Deploy:
   ```sh
   supabase functions deploy publish-cms-submission
   ```

## 4. Deploy the CMS page
Deploy the `cms-development` branch as a Netlify deploy preview/branch deploy, or merge it only after review. Open `/cms.html` on that deployed site. The CMS and website preview must share the same origin for visual editing.

## Workflow
- Editors sign in with email/password, load the website, edit text and image URLs in the preview, and submit a complete HTML draft.
- Admins review the queue and click **Approve & publish**.
- The Edge Function verifies the admin role and commits the approved HTML to GitHub `main/index.html`.
- GitHub/Netlify's existing deployment integration then rebuilds the live website.

## Important
- Keep the Supabase service-role key and GitHub token in Supabase Edge Function secrets only.
- Do not enable public signup unless you want anyone to be able to create an editor account. Prefer creating users manually in Supabase Auth.
- Test the first publish on a copy/staging deploy before using it on the live site. A published HTML draft replaces the complete `index.html`.
