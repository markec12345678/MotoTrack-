#!/bin/bash
# ============================================
# MotoTrack - Turso Database Setup
# ============================================
# Prerequisites:
#   1. Install Turso CLI: curl -sSfL https://get.tur.so/install.sh | bash
#   2. Sign up: turso auth signup
#   3. Login: turso auth login
# ============================================

set -e

echo "🏍️  MotoTrack - Turso Database Setup"
echo "====================================="

if ! command -v turso &> /dev/null; then
    echo "❌ Turso CLI not found. Install it first:"
    echo "   curl -sSfL https://get.tur.so/install.sh | bash"
    exit 1
fi

if ! turso auth whoami &> /dev/null; then
    echo "❌ Not logged in to Turso. Run: turso auth login"
    exit 1
fi

DB_NAME="mototrack"

echo "📦 Creating Turso database: $DB_NAME..."
turso db create "$DB_NAME" --group default 2>/dev/null || echo "   Database already exists, continuing..."

echo ""
echo "📊 Getting database info..."
DB_URL=$(turso db show "$DB_NAME" --url)
echo "   URL: $DB_URL"

echo ""
echo "🔑 Creating auth token..."
AUTH_TOKEN=$(turso db tokens create "$DB_NAME")
echo "   Token: ${AUTH_TOKEN:0:20}..."

echo ""
echo "✅ Turso database ready!"
echo ""
echo "🔧 Set these on Vercel (Settings → Environment Variables):"
echo ""
echo "   DATABASE_URL=$DB_URL"
echo "   TURSO_AUTH_TOKEN=$AUTH_TOKEN"
echo ""
echo "🚀 Then redeploy: vercel --prod"
