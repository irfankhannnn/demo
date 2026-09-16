# WhatsApp Connection — Quick Reference Guide

## New Utilities Location
**File:** `apps/crm/real-estate-crm-app/src/utils/whatsappConnection.ts`

## Key Functions

### Phone Operations
```typescript
// Normalize phone to digits only (e.g., "918291537522")
const normalized = normalizeWhatsAppPhone("+91 8291 537522");

// Format for display (e.g., "+91 82915 37522")
const formatted = formatWhatsAppPhone("918291537522");

// Validate phone (10-15 digits)
const { valid, normalized, error } = validateWhatsAppPhone("+91 8291 537522");
if (!valid) console.error(error);
```

### Status Checking
```typescript
// Fetch connection status with 10s timeout
const result = await fetchConnectionStatus(phone);
// Returns: { connected, state, error, errorType, sessionId }
// errorType: 'network' | 'auth' | 'api' | 'disconnected' | 'unknown'
```

### Storage Operations
```typescript
// Save phone with rollback on failure
const result = await saveConnectedPhone(phone, (config) => api.updateAiEmployeeConfig(config));
// Returns: { success, localStorageOk }

// Clear phone with rollback on failure
const result = await clearConnectedPhone((config) => api.updateAiEmployeeConfig(config));
// Returns: { success, localStorageOk }

// Resolve phone from API config (single source of truth)
const phone = await resolveConnectedPhone(() => api.getAiEmployeeConfig());
```

### Polling
```typescript
const poller = new WhatsappPoller();
poller.start(phone, 3000, (result) => {
  // Handle status result
  // Automatically deduplicates requests
});
// Later: stop polling and cancel pending requests
poller.stop();
```

### Cross-Tab Sync
```typescript
const sync = new WhatsappConnectionSync();

// Listen for state changes from other tabs
const unsubscribe = sync.onChange((state) => {
  if (state.connected !== undefined) setConnected(state.connected);
});

// Publish state to other tabs
sync.publish({ phone, connected, error });

// Cleanup
unsubscribe();
sync.close();
```

### Storage Reliability
```typescript
// Detect incognito/private browsing
const unreliable = await isStorageUnreliable();
if (unreliable) {
  showWarning('Your connection state may not persist in private browsing');
}
```

## Constants
```typescript
WHATSAPP_STATUS_TIMEOUT_MS = 10000        // 10s timeout for status check
WHATSAPP_POLL_INTERVAL_MS = 30000         // 30s dashboard polling
WHATSAPP_QR_POLL_INTERVAL_MS = 3000       // 3s QR polling
WHATSAPP_QR_POLL_TIMEOUT_MS = 120000      // 2min QR timeout
CONNECTED_PHONE_KEY = 'connectedWhatsAppPhone'
```

## Component Usage

### ConnectWhatsApp.tsx
```typescript
import {
  normalizeWhatsAppPhone,
  validateWhatsAppPhone,
  fetchConnectionStatus,
  saveConnectedPhone,
  clearConnectedPhone,
  resolveConnectedPhone,
  WhatsappPoller,
  WhatsappConnectionSync,
} from '../../utils/whatsappConnection';

// Validate phone before QR
const validation = validateWhatsAppPhone(phone);
if (!validation.valid) {
  setPhoneError(validation.error);
  return;
}

// Save with rollback
const result = await saveConnectedPhone(validation.normalized, (config) => 
  api.updateAiEmployeeConfig(config)
);

// Poll for connection
const poller = new WhatsappPoller();
poller.start(phone, 3000, handleResult);
```

### CRMDashboard.tsx
```typescript
import {
  formatWhatsAppPhone,
  fetchConnectionStatus,
  resolveConnectedPhone,
  WhatsappPoller,
  WhatsappConnectionSync,
} from '../../utils/whatsappConnection';

// Resolve phone from API config
const phone = await resolveConnectedPhone(() => api.getAiEmployeeConfig());

// Poll status
const poller = new WhatsappPoller();
poller.start(phone, 30000, (result) => {
  setWhatsappConnected(result.connected);
  setWhatsappErrorType(result.errorType);
});
```

## Error Handling

### Error Types
- **`'network'`** — Network timeout or connection refused (show orange warning)
- **`'auth'`** — Authentication failed, 401 (show purple warning)
- **`'api'`** — API error, other HTTP error (show red error)
- **`'disconnected'`** — WhatsApp not connected (show red error)
- **`'unknown'`** — Unknown error (show red error)

### Display Logic
```typescript
if (result.errorType === 'network') {
  // Show: "⚠️ Network error: ..."
} else if (result.errorType === 'auth') {
  // Show: "🔐 Auth error: ..."
} else {
  // Show: "Error: ..."
}
```

## Edge Cases Handled

| # | Issue | Solution |
|---|-------|----------|
| 1 | Phone normalization inconsistency | `normalizeWhatsAppPhone()` |
| 2 | Storage sync failure | Rollback on API failure |
| 3 | Polling race conditions | `WhatsappPoller` with AbortController |
| 4 | Single source of truth | `resolveConnectedPhone()` prioritizes API |
| 5 | Error ambiguity | `errorType` field distinguishes errors |
| 6 | Cross-tab desync | `WhatsappConnectionSync` with BroadcastChannel |
| 7 | Session expiration | Backend detects `PAIRING_PROMPT_TIMEOUT` state |
| 8 | Network timeout | `fetchWithTimeout()` with 10s default |
| 9 | Incognito mode | `isStorageUnreliable()` detects and warns |
| 10 | Disconnect rollback | `clearConnectedPhone()` rolls back on failure |
| 11 | Phone validation | `validateWhatsAppPhone()` before QR |
| 12 | Concurrent QR generation | `qrGenerationInProgressRef` flag |

## Migration Guide

### Old Code
```typescript
// Old: Direct fetch without timeout
const res = await fetch(`${API_URL}/auth/whatsapp/status/${phone}`);

// Old: No validation
setPhone(userInput);

// Old: No sync failure handling
await api.updateAiEmployeeConfig({ connectedWhatsAppPhone: phone });
```

### New Code
```typescript
// New: Uses timeout and error types
const result = await fetchConnectionStatus(phone);

// New: Validates before use
const { valid, normalized } = validateWhatsAppPhone(userInput);
if (!valid) return;
setPhone(normalized);

// New: Handles sync failures with rollback
const { success } = await saveConnectedPhone(phone, (config) => 
  api.updateAiEmployeeConfig(config)
);
if (!success) showError('Sync failed');
```

## Debugging

### Check localStorage
```javascript
// In browser console
localStorage.getItem('connectedWhatsAppPhone')
```

### Check cross-tab sync
```javascript
// In browser console (open 2 tabs)
// Tab 1:
const sync = new BroadcastChannel('whatsapp-connection');
sync.postMessage({ phone: '918291537522', connected: true });

// Tab 2: should receive message
```

### Check polling
```typescript
// Add logging
const poller = new WhatsappPoller();
poller.start(phone, 3000, (result) => {
  console.log('Poll result:', result);
});
```

## Performance Tips

1. **Stop polling on unmount:** Always call `poller.stop()` in cleanup
2. **Unsubscribe from sync:** Always call `unsubscribe()` from `onChange()`
3. **Close sync on unmount:** Always call `sync.close()` in cleanup
4. **Debounce phone input:** Validate on blur, not on every keystroke
5. **Use constants:** Don't hardcode timeout values, use exported constants

## Backward Compatibility

✅ All changes are backward compatible
✅ Old code that doesn't use new utilities still works
✅ No breaking changes to API contracts
✅ No database migrations required
