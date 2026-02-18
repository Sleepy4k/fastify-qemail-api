# QEmail API - Temporary Email Service

A high-performance, production-ready backend API for a temporary/disposable email service built with **Bun**, **Fastify**, **TypeScript**, **MySQL**, **Redis**, and **Cloudflare Email Routing**.

## Features

- **No-Auth Email Generation**: Users can instantly create temporary email addresses without signing up
- **Optional Password Protection**: Users can optionally secure their email addresses with a password
- **Real-time Email Reception**: Incoming emails are captured via Cloudflare Workers and stored in real-time
- **RESTful API**: Clean, documented API with Swagger/OpenAPI specification
- **High Performance**: Built on Bun and Fastify for maximum throughput
- **Rate Limiting**: Redis-backed distributed rate limiting to prevent abuse
- **Admin Dashboard API**: Complete admin endpoints for monitoring and management
- **Cloudflare Integration**: Leverages Cloudflare Email Routing for reliable email delivery

## Technology Stack

- **Runtime**: Bun (v1.0+)
- **Framework**: Fastify 5.x
- **Language**: TypeScript (Strict mode)
- **Database**: MySQL 8.x
- **Cache**: Redis 7.x
- **Email Provider**: Cloudflare Email Routing
- **Validation**: TypeBox (JSON Schema)
- **Security**: Helmet, CORS, Argon2 password hashing
- **Logging**: Pino

## Prerequisites

- Bun >= 1.0.0
- MySQL >= 8.0
- Redis >= 7.0
- Cloudflare account with Email Routing enabled
- Node.js >= 20 (optional, for tooling)

## Quick Start

### 1. Clone and Install

```bash
bun install
```

### 2. Environment Setup

Create `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

### 3. Database Setup

Run migrations:

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE qemail_db;"

# Run migrations
mysql -u root -p qemail_db < database/migrations/001_init_schema.sql
mysql -u root -p qemail_db < database/migrations/002_add_indexes.sql

# Seed data (optional)
mysql -u root -p qemail_db < database/seeds/domains.sql
```

### 4. Start Development Server

```bash
bun run dev
```

The API will be available at:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

## API Endpoints

### Authentication & Email Generation

- `GET /api/v1/auth/domains` - Get available domains
- `POST /api/v1/auth/generate` - Generate new email address
- `POST /api/v1/auth/login` - Login to protected email
- `POST /api/v1/auth/verify-session` - Verify session token
- `GET /api/v1/auth/me` - Get current user (protected)

### Inbox Management

- `GET /api/v1/inbox` - Get inbox emails (protected)
- `GET /api/v1/inbox/:emailId` - Get email by ID (protected)
- `POST /api/v1/inbox/mark-read` - Mark emails as read (protected)
- `DELETE /api/v1/inbox/:emailId` - Delete email (protected)
- `GET /api/v1/inbox/unread-count` - Get unread count (protected)

### Webhook

- `POST /api/v1/webhook/incoming-email` - Receive incoming email from Cloudflare
- `GET /api/v1/webhook/health` - Webhook health check

### Admin Dashboard

- `POST /api/v1/admin/login` - Admin login
- `GET /api/v1/admin/stats` - System statistics (admin)
- `GET /api/v1/admin/domains` - List all domains (admin)
- `POST /api/v1/admin/domains` - Create domain (admin)
- `DELETE /api/v1/admin/domains/:id` - Delete domain (admin)

## Cloudflare Worker Setup

### 1. Deploy Worker

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler publish
```

### 2. Configure Email Routing

1. Go to Cloudflare Dashboard > Email > Email Routing
2. Add your domain and verify DNS records
3. Create a catch-all route pointing to the Worker
4. Set environment variables:
   - `API_ENDPOINT`: Your Fastify API URL
   - `WEBHOOK_SECRET`: Shared secret for authentication

## Admin Credentials

Default admin credentials (from seed data):
- Username: `admin`
- Password: `Admin@123456`

**Important**: Change this password in production!

## License

MIT

---

Built with ❤️ using Bun and Fastify
