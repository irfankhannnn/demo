/**
 * @typedef {Object} Session
 * @property {string} phone
 * @property {import('@whiskeysockets/baileys').WASocket|null} socket
 * @property {string} connectionState
 * @property {string|null} qrCode
 * @property {string|null} lastQrAt
 * @property {string|null} lastError
 * @property {string} createdAt
 * @property {Set<Function>} qrResolvers
 * @property {Set<Function>} openResolvers
 */

export {};
