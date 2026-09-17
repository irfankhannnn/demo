# Admin Portal Backend

Backend server for the Admin Portal with SQLite database and AWS S3 integration.

## Features

- 🔐 Admin authentication with JWT
- 📦 SQLite database for storing areas, buildings, and customer information
- ☁️ AWS S3 integration for document storage
- 🔒 Pre-signed URLs for secure document access
- 🔍 Search functionality by building name or customer name
- 📄 Support for multiple file formats (PDF, images, documents)

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-bucket-name

# Default Admin Credentials
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
```

### 3. AWS S3 Setup

1. Create an S3 bucket in your AWS account
2. Configure bucket permissions to allow read/write access
3. Create an IAM user with S3 access and get access keys
4. Update the `.env` file with your AWS credentials

**Required S3 Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 4. Start the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Admin login
- `POST /api/auth/change-password` - Change admin password

### Areas

- `GET /api/areas` - Get all areas
- `POST /api/areas` - Create new area
- `PUT /api/areas/:id` - Update area
- `DELETE /api/areas/:id` - Delete area

### Buildings

- `GET /api/buildings` - Get all buildings
- `GET /api/buildings/search?query=` - Search buildings
- `GET /api/buildings/:id` - Get building with documents
- `POST /api/buildings` - Create new building
- `PUT /api/buildings/:id` - Update building
- `DELETE /api/buildings/:id` - Delete building
- `POST /api/buildings/:id/documents` - Upload document
- `DELETE /api/buildings/:buildingId/documents/:documentId` - Delete document

## Database Schema

### admins
- `id` - Primary key
- `username` - Unique username
- `password` - Hashed password
- `created_at` - Timestamp

### areas
- `id` - Primary key
- `name` - Area name (unique)
- `created_at` - Timestamp

### buildings
- `id` - Primary key
- `name` - Building name
- `area_id` - Foreign key to areas
- `customer_name` - Customer name
- `created_at` - Timestamp

### documents
- `id` - Primary key
- `building_id` - Foreign key to buildings
- `filename` - File name in S3
- `original_filename` - Original upload filename
- `file_type` - MIME type
- `s3_key` - S3 object key
- `file_size` - File size in bytes
- `uploaded_at` - Timestamp

## Security

- JWT tokens expire after 24 hours
- Passwords are hashed using bcrypt
- All admin endpoints require authentication
- S3 URLs are pre-signed and expire after 1 hour

## Default Credentials

**Username:** admin  
**Password:** admin123

⚠️ **Important:** Change the default password after first login!

## WhatsApp Integration

The backend can send and receive WhatsApp messages via two modes:

1. **Hosted (`BAILEY_MODE=hosted`)** — third-party `api.bailey.ai` service (paid/vendor).
2. **Self-hosted (`BAILEY_MODE=selfhosted`)** — your own Baileys service in `../whatsapp-platform/` using the open-source `@whiskeysockets/baileys` library.

See [`../whatsapp-platform/README.md`](../../../platform/whatsapp-platform/README.md) for setup and deployment instructions.

# real-estate-backend


