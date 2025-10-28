#!/bin/bash

# GCP Secret Manager Setup Script
# This script automates the entire GCP setup for the Media Toolkit

set -e  # Exit on any error

echo "======================================"
echo "Media Toolkit - GCP Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Step 1: Get or create project
echo -e "${BLUE}Step 1: Project Setup${NC}"
echo ""
echo "Do you want to:"
echo "1) Use an existing project"
echo "2) Create a new project"
read -p "Enter choice (1 or 2): " project_choice

if [ "$project_choice" == "2" ]; then
    read -p "Enter new project ID (lowercase, no spaces, globally unique): " PROJECT_ID
    echo -e "${YELLOW}Creating project: $PROJECT_ID${NC}"

    if gcloud projects create $PROJECT_ID --name="Media Toolkit" 2>/dev/null; then
        echo -e "${GREEN}✓ Project created${NC}"
    else
        echo -e "${RED}Failed to create project. The ID may already be taken globally.${NC}"
        echo -e "${YELLOW}Try adding a suffix like: ${PROJECT_ID}-$(date +%s)${NC}"
        exit 1
    fi
else
    # List available projects
    echo -e "${YELLOW}Available projects:${NC}"
    gcloud projects list --format="table(projectId,name)"
    echo ""
    read -p "Enter project ID: " PROJECT_ID
fi

# Set default project
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Project set to: $PROJECT_ID${NC}"
echo ""

# Check if billing is enabled
echo -e "${YELLOW}Checking billing status...${NC}"
BILLING_ENABLED=$(gcloud beta billing projects describe $PROJECT_ID --format="value(billingEnabled)" 2>/dev/null || echo "false")

if [ "$BILLING_ENABLED" != "True" ]; then
    echo -e "${RED}Warning: Billing is not enabled for this project${NC}"
    echo "You need to enable billing to use Vertex AI"
    echo "Enable it here: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    read -p "Press Enter after enabling billing..."
fi

# Step 2: Enable APIs
echo -e "${BLUE}Step 2: Enabling Required APIs${NC}"
echo -e "${YELLOW}This may take 1-2 minutes...${NC}"

gcloud services enable aiplatform.googleapis.com --project=$PROJECT_ID
echo -e "${GREEN}✓ Vertex AI API enabled${NC}"

gcloud services enable generativelanguage.googleapis.com --project=$PROJECT_ID
echo -e "${GREEN}✓ Generative Language API enabled${NC}"

gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
echo -e "${GREEN}✓ Secret Manager API enabled${NC}"

gcloud services enable iam.googleapis.com --project=$PROJECT_ID
echo -e "${GREEN}✓ IAM API enabled${NC}"
echo ""

# Step 3: Create Vertex AI service account
echo -e "${BLUE}Step 3: Creating Vertex AI Service Account${NC}"

SA_EMAIL="vertex-ai-app@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account already exists
if gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID &>/dev/null; then
    echo -e "${YELLOW}Service account already exists: $SA_EMAIL${NC}"
    read -p "Delete and recreate? (y/n): " recreate
    if [ "$recreate" == "y" ]; then
        gcloud iam service-accounts delete $SA_EMAIL --project=$PROJECT_ID --quiet
        echo -e "${GREEN}✓ Deleted existing service account${NC}"
    fi
fi

if ! gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID &>/dev/null; then
    gcloud iam service-accounts create vertex-ai-app \
        --display-name="Vertex AI Application" \
        --project=$PROJECT_ID
    echo -e "${GREEN}✓ Service account created: $SA_EMAIL${NC}"
fi

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/aiplatform.user" \
    --condition=None \
    --quiet

echo -e "${GREEN}✓ Granted Vertex AI User role${NC}"
echo ""

# Step 4: Generate and store key in Secret Manager
echo -e "${BLUE}Step 4: Generating Key and Storing in Secret Manager${NC}"

# Generate temporary key file
TEMP_KEY="/tmp/vertex-ai-key-$$.json"
gcloud iam service-accounts keys create $TEMP_KEY \
    --iam-account=$SA_EMAIL \
    --project=$PROJECT_ID

echo -e "${GREEN}✓ Service account key generated${NC}"

# Check if secret exists
SECRET_NAME="vertex-ai-service-account"
if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
    echo -e "${YELLOW}Secret already exists. Adding new version...${NC}"
    gcloud secrets versions add $SECRET_NAME \
        --data-file=$TEMP_KEY \
        --project=$PROJECT_ID
else
    gcloud secrets create $SECRET_NAME \
        --data-file=$TEMP_KEY \
        --replication-policy="automatic" \
        --project=$PROJECT_ID
fi

echo -e "${GREEN}✓ Credentials stored in Secret Manager${NC}"

# Delete temporary key file
rm $TEMP_KEY
echo -e "${GREEN}✓ Temporary key file deleted${NC}"
echo ""

# Step 5: Grant your user account access to the secret
echo -e "${BLUE}Step 5: Granting Secret Access${NC}"

# Get current user email
USER_EMAIL=$(gcloud config get-value account)

gcloud secrets add-iam-policy-binding $SECRET_NAME \
    --member="user:$USER_EMAIL" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID \
    --quiet

echo -e "${GREEN}✓ Granted you access to secret: $USER_EMAIL${NC}"
echo ""

# Step 6: Authenticate for local development
echo -e "${BLUE}Step 6: Setting Up Local Authentication${NC}"

echo -e "${YELLOW}Authenticating with Application Default Credentials...${NC}"
echo "This will open a browser window for authentication."
read -p "Press Enter to continue..."

gcloud auth application-default login --project=$PROJECT_ID

echo -e "${GREEN}✓ Local authentication complete${NC}"
echo ""

# Step 7: Create .env.local file
echo -e "${BLUE}Step 7: Creating .env.local Configuration${NC}"

ENV_FILE="/home/patwiloak/coding/toolkit-python/toolkit-web/.env.local"

cat > $ENV_FILE << EOF
# Auto-generated by setup-gcp.sh
GCP_PROJECT_ID=$PROJECT_ID
GCP_LOCATION=us-central1
GCP_SECRET_NAME=$SECRET_NAME
EOF

echo -e "${GREEN}✓ Created .env.local${NC}"
echo ""

# Step 8: Verify setup
echo -e "${BLUE}Step 8: Verifying Setup${NC}"

echo -e "${YELLOW}Testing Secret Manager access...${NC}"
if gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
    echo -e "${GREEN}✓ Can access secret successfully${NC}"
else
    echo -e "${RED}✗ Cannot access secret${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo -e "${GREEN}Setup Complete! 🎉${NC}"
echo "======================================"
echo ""
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Service Account: $SA_EMAIL"
echo "  Secret Name: $SECRET_NAME"
echo "  Location: us-central1"
echo ""
echo "Next steps:"
echo "1. Restart your dev server:"
echo "   cd /home/patwiloak/coding/toolkit-python/toolkit-web"
echo "   npm run dev"
echo ""
echo "2. Navigate to: http://localhost:3000/podcasts"
echo ""
echo "3. Try summarizing a YouTube podcast!"
echo ""
echo "======================================"
echo ""

# Optional: Test the secret retrieval
read -p "Would you like to test retrieving the secret? (y/n): " test_secret
if [ "$test_secret" == "y" ]; then
    echo ""
    echo -e "${YELLOW}Secret content (first 100 chars):${NC}"
    gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT_ID | head -c 100
    echo "..."
    echo ""
fi

echo -e "${GREEN}Done!${NC}"
