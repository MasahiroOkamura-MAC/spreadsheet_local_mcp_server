#!/bin/bash

# Configuration
PROJECT_ID="your-project-id"
SERVICE_NAME="spreadsheet-remote-mcp"
REGION="asia-northeast1"

# Build and Deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLIENT_ID="your_client_id",GOOGLE_CLIENT_SECRET="your_client_secret",GOOGLE_REDIRECT_URI="https://your-service-url/auth/callback"
