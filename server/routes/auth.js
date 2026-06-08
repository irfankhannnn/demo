import express from 'express';

const router = express.Router();

// NOTE: Old JWT-based authentication endpoints (/login, /change-password) have been removed.
// Authentication is now handled by the reality-flow-authentication microservice using AWS Cognito.
// Users authenticate via Cognito Hosted UI with Google OAuth, and the CRM backend validates
// tokens by calling the auth microservice's /auth/me endpoint.

export default router;
