# Vercel Deployment Guide - WebPanel

## Prerequisites
- GitHub account
- Vercel account (sign up at vercel.com)
- Supabase project with all tables created
- Resend API key with verified domain (yaleya.biz.id)

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Clean up for production deployment"
git push origin main
```

## Step 2: Import Project to Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub account and `webpanel` repository
4. Click "Import"

## Step 3: Configure Project Settings

### Framework Preset
- Framework: **Next.js**
- Build Command: `next build` (default)
- Output Directory: `.next` (default)
- Install Command: `npm install` (default)

### Root Directory
- Leave as default (root of repository)

## Step 4: Environment Variables

Click "Environment Variables" and add these:

### Supabase Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**How to get these:**
1. Go to your Supabase project
2. Click Settings → API
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### Resend Variable
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

**How to get this:**
1. Go to https://resend.com/api-keys
2. Copy your API key

### Important Notes:
- Make sure all variables are set for **Production**, **Preview**, and **Development** environments
- Don't include quotes around values
- Double-check there are no extra spaces

## Step 5: Deploy

1. Click **"Deploy"** button
2. Wait for build to complete (usually 2-3 minutes)
3. Vercel will show you the deployment URL

## Step 6: Configure Supabase Redirect URLs

After deployment, add your Vercel URL to Supabase:

1. Go to Supabase project → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app/confirm
   https://your-app.vercel.app/login
   ```
3. Add to **Site URL**:
   ```
   https://your-app.vercel.app
   ```

## Step 7: Test Deployment

Visit your Vercel URL and test:
- ✅ Login page loads
- ✅ Can login with credentials
- ✅ Dashboard loads
- ✅ Invoice pages work
- ✅ PDF export works
- ✅ Email sending works
- ✅ WhatsApp message generation works
- ✅ Communication tracking displays

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all TypeScript errors are fixed locally first
- Make sure `package.json` dependencies are correct

### Environment Variables Not Working
- Make sure variables are set for the correct environment (Production)
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### Authentication Issues
- Verify Supabase redirect URLs are configured correctly
- Check that Supabase URL and keys are correct
- Make sure Supabase project is not paused

### Email Not Sending
- Verify RESEND_API_KEY is set correctly
- Check that yaleya.biz.id domain is verified in Resend
- Check API logs in Resend dashboard

## Custom Domain (Optional)

To use your own domain (e.g., app.yaleya.biz.id):

1. Go to Vercel project → Settings → Domains
2. Add your domain
3. Configure DNS records as instructed by Vercel
4. Update Supabase redirect URLs to use new domain

## Continuous Deployment

After initial deployment, every push to `main` branch will automatically deploy to Vercel!

```bash
git add .
git commit -m "Update feature"
git push
```

Vercel will automatically build and deploy the new version.

## Environment Variable Updates

To update environment variables after deployment:

1. Go to Vercel project → Settings → Environment Variables
2. Edit the variable
3. Click **Save**
4. Go to Deployments tab
5. Click **Redeploy** on latest deployment

## Monitoring

Check these regularly:
- Vercel Analytics (traffic, performance)
- Vercel Logs (errors, API calls)
- Supabase Logs (database queries)
- Resend Dashboard (email delivery)

---

**Need help?**
- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Supabase Auth: https://supabase.com/docs/guides/auth
