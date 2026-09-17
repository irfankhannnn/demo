# Quick Start Guide

Get up and running in 5 minutes!

## 1. Install Dependencies

```bash
cd real-estate-crm-app
npm install
```

## 2. Setup Environment

**Option A: Interactive Setup (Recommended)**
```bash
npm run setup
```

**Option B: Manual Setup**
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://192.168.1.100:3000/api  # Your backend IP
VITE_TENANT_ID=my-organization-id           # Your unique ID
```

## 3. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:5174

## 4. Login

- Username: `admin`
- Password: `admin`

**⚠️ Change password after first login via Settings!**

## Features Available

✅ **Dashboard** - Overview of all properties and areas  
✅ **CRM** - Manage customers and property owners  
✅ **Properties** - Add and manage property listings  
✅ **Rentals** - Track all rental agreements  
✅ **Buildings** - Organize properties by building/area  

## Building for Mobile

### First Time Only
```bash
npm run mobile:init
```

### Every Update
```bash
npm run mobile:build
npm run android  # or npm run ios
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run setup` | Configure environment |
| `npm run android` | Open in Android Studio |
| `npm run ios` | Open in Xcode |
| `npm run sync` | Sync to mobile platforms |

## Backend Setup

Ensure your backend is:
1. **Running** on accessible network
2. **CORS enabled** for mobile origins
3. **Authentication** working
4. **Tenant middleware** configured

## Network Configuration

### For Mobile Testing

Your mobile device must be able to reach the backend:

1. **Find your computer's IP:**
   ```bash
   # Windows
   ipconfig
   
   # macOS/Linux
   ifconfig
   ```

2. **Use that IP in .env:**
   ```env
   VITE_API_URL=http://192.168.1.100:3000/api
   ```

3. **Ensure firewall allows connections**

4. **Both devices on same network**

## Troubleshooting

### "Cannot connect to backend"
- Check API URL uses IP not localhost
- Verify backend is running
- Test URL in mobile browser first

### "Login failed"
- Verify credentials in backend
- Check tenant ID is correct
- Clear app data and retry

### Build errors
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

1. ✅ Change default password
2. ✅ Add your areas and buildings
3. ✅ Start adding properties
4. ✅ Create customer records
5. ✅ Track rentals

## Documentation

- **Full Setup:** See `SETUP.md`
- **Architecture:** See `ARCHITECTURE.md`  
- **README:** See `README.md`

## Support

If you need help:
1. Check the documentation above
2. Review backend logs
3. Check browser console for errors
4. Contact your development team

---

**Happy Property Managing! 🏢**
