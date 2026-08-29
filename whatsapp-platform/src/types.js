/**
 * @typedef {Object} Session
 * @property {string} phone - Normalized phone number (digits only)
 * @property {any|null} socket - Baileys WebSocket instance
 * @property {string} connectionState - Current connection state (open|connecting|close)
 * @property {string|null} qrCode - Base64 QR code data URL
 * @property {string|null} lastQrAt - ISO timestamp of last QR generation
 * @property {string|null} lastError - Last error message
 * @property {string} createdAt - ISO timestamp of session creation
 * @property {Set<Function>} qrResolvers - Pending QR promise resolvers
 * @property {Set<Function>} openResolvers - Pending open promise resolvers
 */
