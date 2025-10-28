# Quick Start - GCP Setup

## One-Command Setup

Just run this script and follow the prompts:

```bash
./setup-gcp.sh
```

That's it! The script will:

1. ✅ Help you select or create a GCP project
2. ✅ Enable Vertex AI and Secret Manager APIs
3. ✅ Create service account with proper permissions
4. ✅ Generate credentials and store in Secret Manager
5. ✅ Set up local authentication
6. ✅ Create `.env.local` configuration file
7. ✅ Verify everything works

**Total time: ~3-5 minutes** (including browser authentication)

---

## What You Need

- **gcloud CLI** installed ([Install guide](https://cloud.google.com/sdk/docs/install))
- **GCP account** with billing enabled
- **Internet connection** (for API calls)

---

## After Setup

Once the script completes:

```bash
# Start your dev server
npm run dev
```

Navigate to `http://localhost:3000/podcasts` and try summarizing a YouTube podcast!

---

## Manual Setup

If you prefer manual setup, see `SETUP_SECRET_MANAGER.md` for detailed step-by-step instructions.

---

## Troubleshooting

**"gcloud: command not found"**
- Install gcloud CLI: https://cloud.google.com/sdk/docs/install

**"Billing is not enabled"**
- Enable billing: https://console.cloud.google.com/billing

**"Permission denied"**
- Make sure you're an Owner or Editor on the project

**"Cannot access secret"**
- Run `gcloud auth application-default login` again

---

## Cost Estimate

- **Secret Manager**: ~$0.10-0.20/month
- **Vertex AI**: ~$0.20-0.50 per podcast summary
- **Free tier**: $300 credit for new GCP accounts

---

## Security

✅ No credentials stored on disk
✅ All secrets encrypted in GCP Secret Manager
✅ `.gitignore` prevents accidental commits
✅ Credentials never leave Google Cloud
