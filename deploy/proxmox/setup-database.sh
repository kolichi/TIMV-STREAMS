#!/bin/bash
# Izwei Music - PostgreSQL Database Setup
# Run this on your Proxmox container after the base setup

set -e

echo "🗄️ Setting up PostgreSQL Database for Izwei Music"
echo "=================================================="

# Variables - CHANGE THESE!
DB_NAME="izwei_music"
DB_USER="izwei"
DB_PASSWORD="CHANGE_THIS_SECURE_PASSWORD"

echo "Creating database and user..."

# Create database and user
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to the database and grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Database connection string:"
echo "DATABASE_URL=\"postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public\""
echo ""
echo "⚠️  IMPORTANT: Change the password in this script and your .env file!"
