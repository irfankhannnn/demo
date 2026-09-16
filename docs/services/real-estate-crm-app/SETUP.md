# Real Estate CRM Mobile App - Setup Guide

## Overview
This is a standalone mobile CRM application for managing real estate properties, customers, owners, and rentals. It connects to the same backend as the main website and supports multi-tenancy.

## Features Included
✅ **Admin Dashboard** - Overview of areas, buildings, and metrics  
✅ **CRM System** - Complete customer and owner management  
✅ **Property Management** - Add, edit, and manage properties  
✅ **Rental List** - Comprehensive rental tracking  
✅ **Building & Flat Management** - Organize properties by location  
✅ **Multi-Tenant Support** - Data isolation for each organization  
✅ **Mobile-Ready** - Built with Capacitor for Android & iOS  

## Prerequisites

1. **Node.js** - Version 18 or higher
2. **Backend Server** - The main backend must be running
3. **For Android**: Android Studio with Android SDK
4. **For iOS**: Xcode (macOS only)

## Installation Steps

### 1. Install Dependencies

```bash
cd real-estate-crm-app
npm install
```

### 2. Configure Environment

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and configure:
```env
# Backend API URL (must be accessible from mobile device)
VITE_API_URL=http://YOUR_BACKEND_IP:3000/api

# Your Tenant ID (get from admin portal or backend)
VITE_TENANT_ID=your-tenant-id-here
```

**Important for Mobile Testing:**
- Don't use `localhost` - use your computer's local IP address
- Example: `http://192.168.1.100:3000/api`
- Ensure backend accepts connections from your network
- Update CORS settings in backend if needed

### 3. Run Development Server

```bash
npm run dev
```

Visit http://localhost:5174 in your browser.

**Default Login:**
- Username: `admin`
- Password: `admin`

(Change via Settings after first login)

## Building for Mobile

### Android

1. Build the web app:
```bash
npm run build
```

2. Initialize Capacitor (first time only):
```bash
npx cap add android
```

3. Sync changes:
```bash
npm run sync:android
```

4. Open in Android Studio:
```bash
npm run android
```

5. Run on device or emulator from Android Studio

### iOS (macOS only)

1. Build the web app:
```bash
npm run build
```

2. Initialize Capacitor (first time only):
```bash
npx cap add ios
```

3. Sync changes:
```bash
npm run sync:ios
```

4. Open in Xcode:
```bash
npm run ios
```

5. Run on device or simulator from Xcode

## Multi-Tenancy Setup

### For New Organizations

1. Generate a unique tenant ID (UUID recommended)
2. Set `VITE_TENANT_ID` in `.env`
3. Each tenant's data is completely isolated
4. Backend automatically filters data by tenant ID

### For Existing Users

1. Get your tenant ID from the backend admin
2. Update `.env` with your tenant ID
3. Login with your credentials
4. All data will be scoped to your organization

## Backend Configuration

Ensure your backend has:

1. **CORS enabled** for mobile origins:
```javascript
// In server/index.js
app.use(cors({
  origin: ['http://localhost:5174', 'capacitor://localhost', 'http://localhost'],
  credentials: true
}));
```

2. **Tenant middleware** properly configured
3. **Authentication** endpoints working
4. **Network accessible** from mobile devices

## Troubleshooting

### Cannot Connect to Backend

- Check `VITE_API_URL` is correct
- Use computer's IP address, not localhost
- Ensure backend is running and accessible
- Check firewall settings
- Verify CORS configuration

### Login Fails

- Verify backend auth endpoints work
- Check tenant ID is correct
- Ensure credentials are valid
- Check browser console for errors

### Mobile Build Issues

**Android:**
- Ensure Android Studio is installed
- Check Java/Kotlin versions
- Run `gradle clean` if needed

**iOS:**
- Ensure Xcode is installed (macOS only)
- Check CocoaPods is installed
- Run `pod install` in ios folder if needed

### Data Not Loading

- Verify tenant ID matches backend
- Check API responses in Network tab
- Ensure user has permission
- Verify backend database has data for this tenant

## Development Workflow

1. Make changes to source code
2. For web: Changes auto-reload
3. For mobile:
   - Run `npm run build`
   - Run `npm run sync`
   - Rebuild in Android Studio/Xcode

## Project Structure

```
apps/crm/real-estate-crm-app/
├── src/
│   ├── pages/           # All page components
│   │   ├── crm/        # CRM-specific pages
│   │   ├── Dashboard.tsx
│   │   ├── RentalList.tsx
│   │   └── ...
│   ├── services/        # API service layer
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── config/         # Configuration (tenant)
│   ├── App.tsx         # Main app component with routing
│   └── main.tsx        # Entry point
├── android/            # Android native project (after init)
├── ios/                # iOS native project (after init)
└── capacitor.config.ts # Capacitor configuration
```

## Adding New Features

1. Add component in `src/pages/` or `src/components/`
2. Add route in `src/App.tsx`
3. Add API endpoint in `src/services/api.ts`
4. Test in web browser first
5. Build and sync for mobile testing

## Production Deployment

### Web Version
```bash
npm run build
# Deploy 'dist' folder to hosting service
```

### Mobile Apps

**Android:**
1. Build signed APK/AAB in Android Studio
2. Upload to Google Play Console

**iOS:**
1. Archive in Xcode
2. Upload to App Store Connect

## Support & Documentation

- Main backend documentation: `../server/README.md`
- API documentation: Check backend routes
- React Router: https://reactrouter.com/
- Capacitor: https://capacitorjs.com/

## Security Notes

- Never commit `.env` file
- Change default admin password immediately
- Use HTTPS in production
- Implement proper authentication
- Keep tenant IDs confidential
- Regularly update dependencies

## License

Same as main project
