# GCP Secret Manager Setup Guide

This guide shows you how to securely store your Vertex AI credentials using GCP Secret Manager.

## Why Secret Manager?

✅ **More Secure**: No credential files on disk
✅ **Centralized**: Manage secrets in one place
✅ **Auditable**: Track who accesses secrets
✅ **Rotation**: Easy to update credentials
✅ **Git-Safe**: Zero risk of committing credentials

---

## Step 1: Create GCP Project & Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - [Vertex AI API](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)
   - [Secret Manager API](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)

---

## Step 2: Create Service Account for Vertex AI

This service account will be **stored in Secret Manager** and used by your app to call Vertex AI.

```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Create service account
gcloud iam service-accounts create vertex-ai-app \
    --display-name="Vertex AI Application" \
    --project=$PROJECT_ID

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:vertex-ai-app@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Generate key and save to temp file
gcloud iam service-accounts keys create /tmp/vertex-ai-key.json \
    --iam-account=vertex-ai-app@${PROJECT_ID}.iam.gserviceaccount.com
```

---

## Step 3: Store Service Account in Secret Manager

```bash
# Create secret with the service account JSON
gcloud secrets create vertex-ai-service-account \
    --data-file=/tmp/vertex-ai-key.json \
    --replication-policy="automatic" \
    --project=$PROJECT_ID

# Delete the temp file (important!)
rm /tmp/vertex-ai-key.json

# Verify secret was created
gcloud secrets describe vertex-ai-service-account --project=$PROJECT_ID
```

---

## Step 4: Create Service Account for Your App

This service account will run your Next.js app and access Secret Manager.

```bash
# Create app service account
gcloud iam service-accounts create media-toolkit-app \
    --display-name="Media Toolkit Application" \
    --project=$PROJECT_ID

# Grant Secret Manager access
gcloud secrets add-iam-policy-binding vertex-ai-service-account \
    --member="serviceAccount:media-toolkit-app@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
```

---

## Step 5: Local Development Setup

For local development, authenticate with your own account:

```bash
# Authenticate (opens browser)
gcloud auth application-default login

# Set default project
gcloud config set project $PROJECT_ID

# Verify you can access the secret
gcloud secrets versions access latest --secret=vertex-ai-service-account
```

Create `.env.local` file:

```bash
cd /home/patwiloak/coding/toolkit-python/toolkit-web

cat > .env.local << 'EOF'
GCP_PROJECT_ID=your-actual-project-id
GCP_LOCATION=us-central1
GCP_SECRET_NAME=vertex-ai-service-account
EOF
```

---

## Step 6: Test Your Setup

```bash
# Restart dev server
pkill -f "next dev"
npm run dev
```

Navigate to `http://localhost:3000/podcasts` and try summarizing a YouTube video!

---

## Security Architecture

```
Your App (local or deployed)
  ↓
Uses: Application Default Credentials
  ↓
Accesses: Secret Manager
  ↓
Retrieves: Vertex AI Service Account JSON
  ↓
Calls: Vertex AI API
```

**No credentials stored in:**
- ❌ `.env` files
- ❌ JSON files on disk
- ❌ Git repository
- ❌ Application code

**Credentials stored in:**
- ✅ GCP Secret Manager (encrypted at rest)
- ✅ Accessed only at runtime
- ✅ Access is audited in Cloud Logging

---

## Production Deployment (Optional)

When deploying to Cloud Run, Cloud Functions, or GKE:

1. **Set service account:**
   ```bash
   gcloud run deploy media-toolkit \
       --service-account=media-toolkit-app@${PROJECT_ID}.iam.gserviceaccount.com \
       --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}"
   ```

2. **No additional credentials needed!** The service account automatically has access.

---

## Troubleshooting

**Error: "Failed to access service account from Secret Manager"**
```bash
# Check you're authenticated
gcloud auth application-default print-access-token

# Verify secret exists
gcloud secrets list --project=$PROJECT_ID

# Test secret access
gcloud secrets versions access latest --secret=vertex-ai-service-account
```

**Error: "Permission denied"**
```bash
# Grant yourself Secret Manager access for testing
gcloud secrets add-iam-policy-binding vertex-ai-service-account \
    --member="user:YOUR_EMAIL@gmail.com" \
    --role="roles/secretmanager.secretAccessor"
```

---

## Cost Estimate

**Secret Manager pricing:**
- $0.06 per 10,000 access operations
- 6 secret versions (active): $0.10/month
- For this use case: **~$0.10-0.20/month**

**Vertex AI pricing (unchanged):**
- Typical podcast summary: **$0.20-0.50**

---

## Rotating Credentials

To rotate the Vertex AI service account key:

```bash
# Generate new key
gcloud iam service-accounts keys create /tmp/new-key.json \
    --iam-account=vertex-ai-app@${PROJECT_ID}.iam.gserviceaccount.com

# Update secret
gcloud secrets versions add vertex-ai-service-account \
    --data-file=/tmp/new-key.json

# Delete temp file
rm /tmp/new-key.json

# List old keys and delete them
gcloud iam service-accounts keys list \
    --iam-account=vertex-ai-app@${PROJECT_ID}.iam.gserviceaccount.com

# Delete old key (use KEY_ID from above)
gcloud iam service-accounts keys delete KEY_ID \
    --iam-account=vertex-ai-app@${PROJECT_ID}.iam.gserviceaccount.com
```

No app restart needed! The app will automatically use the new key.
