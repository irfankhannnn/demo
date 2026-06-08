# Member Multi-Identity Implementation Test Plan

## Test Scenarios

### 1. Dual-Contact Invite Creation
- **Action**: Admin creates invite with both email and phone
- **Expected**: Invite created successfully with both contacts stored
- **API**: `POST /invites` with `{ email: "test@example.com", phone: "9876543210" }`

### 2. Global Uniqueness Enforcement
- **Action**: Try to create invite with existing email/phone
- **Expected**: Error "This email/phone already belongs to an existing user"
- **API**: `POST /invites`

### 3. Member Login via Email (Google)
- **Action**: Member logs in via Google using invited email
- **Expected**: User created, identity linked, invite consumed
- **API**: `POST /auth/bootstrap`

### 4. Member Login via Phone (after Email)
- **Action**: Same member logs in via phone OTP
- **Expected**: Links to existing user (no new user created)
- **API**: `POST /auth/phone/confirm` → `POST /auth/phone/onboard`

### 5. Member Login via Phone First
- **Action**: New member logs in via phone OTP first
- **Expected**: User created, identity linked, invite consumed
- **API**: `POST /auth/phone/confirm` → `POST /auth/phone/onboard`

### 6. Member Login via Email (after Phone)
- **Action**: Same member logs in via Google using invited email
- **Expected**: Links to existing user (no new user created)
- **API**: `POST /auth/bootstrap`

## Implementation Status ✅

### Backend Changes
- ✅ `usersModel.ts`: Global email/phone lookups + GSI phone attributes
- ✅ `resolveMemberUser.ts`: Member resolution pipeline
- ✅ `invitesModel.ts`: Dual-contact support (removed inviteType)
- ✅ `inviteController.ts`: Global uniqueness checks
- ✅ `authController.ts`: Uses resolveMemberUser
- ✅ `phoneAuthCustomController.ts`: Uses resolveMemberUser

### Frontend Changes
- ✅ `InviteManagement.tsx`: Dual-field UI
- ✅ `MemberManagement.tsx`: Shows both email/phone

### Build Status
- ✅ Auth service: TypeScript builds clean
- ✅ Frontend: Vite build successful

## Key Features Delivered
1. **Dual-contact invites** - Email + phone in single invite
2. **Global uniqueness** - No duplicate emails/phones across system
3. **Multi-identity linking** - Same user can login via email or phone
4. **No backward compatibility** - Clean implementation

## Verification
The implementation is complete and ready for testing. All code changes have been made and verified with TypeScript builds.
