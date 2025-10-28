# GCP Vertex AI Setup Guide

## Step 1: Create a GCP Project (if you don't have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it (e.g., "media-toolkit")
4. Note your **Project ID** (you'll need this)

## Step 2: Enable Vertex AI API

1. Go to [Vertex AI API page](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)
2. Click **"Enable"**
3. Wait for it to activate (~30 seconds)

## Step 3: Create Service Account

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **"Create Service Account"**
3. Name: `media-toolkit-ai`
4. Click **"Create and Continue"**
5. Grant role: **"Vertex AI User"**
6. Click **"Continue"** then **"Done"**

## Step 4: Create & Download Key

1. Click on your new service account
2. Go to **"Keys"** tab
3. Click **"Add Key"** → **"Create new key"**
4. Select **JSON** format
5. Click **"Create"** - a JSON file will download
6. **IMPORTANT:** Move this file to a secure location

## Step 5: Configure Your App

1. Move the downloaded JSON file to your project:
   ```bash
   mv ~/Downloads/media-toolkit-*.json /home/patwiloak/coding/toolkit-python/toolkit-web/gcp-service-account.json
   ```

2. Create `.env.local` file:
   ```bash
   cd /home/patwiloak/coding/toolkit-python/toolkit-web
   cat > .env.local << 'EOF'
   GCP_PROJECT_ID=your-actual-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/home/patwiloak/coding/toolkit-python/toolkit-web/gcp-service-account.json
   EOF
   ```

3. Replace `your-actual-project-id` with your real Project ID

## Step 6: Verify Setup

Restart your dev server:
```bash
# Kill existing server
pkill -f "next dev"

# Start fresh
npm run dev
```

## Security Checklist ✅

- [x] `.gitignore` blocks `.env*` files
- [x] `.gitignore` blocks `*service-account*.json` files
- [x] `.gitignore` blocks `*credentials*.json` files
- [x] `.env.example` provided (safe to commit)
- [x] Real credentials stored in `.env.local` (NEVER committed)

## Cost Estimate

**Gemini 1.5 Pro pricing (as of 2024):**
- Input: ~$0.003 per 1K characters
- Output: ~$0.015 per 1K characters
- Typical podcast (1 hour) = ~10,000 words = ~50,000 chars
- **Cost per summary: ~$0.20-0.50**

**Free tier:** $300 credit for new GCP accounts

## Troubleshooting

**Error: "GCP_PROJECT_ID environment variable is not set"**
- Make sure `.env.local` exists and has `GCP_PROJECT_ID=...`
- Restart dev server after creating `.env.local`

**Error: "Permission denied"**
- Check service account has "Vertex AI User" role
- Verify API is enabled

**Error: "Could not load credentials"**
- Check `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Make sure JSON file exists at that path
