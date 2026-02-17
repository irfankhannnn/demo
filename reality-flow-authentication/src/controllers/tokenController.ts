import { Request, Response } from 'express';
import axios from 'axios';
import { getConfig } from '../config/config';
import { ok, badRequest, internalError } from '../utils/http';

/**
 * POST /auth/token
 * Exchanges authorization code for tokens (server-side)
 * This keeps the client secret secure on the server
 */
export async function exchangeToken(req: Request, res: Response): Promise<void> {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    badRequest(res, 'Missing required fields: code, code_verifier, redirect_uri');
    return;
  }

  try {
    const config = getConfig();
    const tokenUrl = `${config.COGNITO_HOSTED_UI_DOMAIN}/oauth2/token`;

    // Build params object, only include client_secret if it exists
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: config.COGNITO_CLIENT_ID,
      redirect_uri,
      code,
      code_verifier,
    };

    if (config.COGNITO_CLIENT_SECRET) {
      params.client_secret = config.COGNITO_CLIENT_SECRET;
    }

    // Exchange code for tokens with Cognito
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams(params).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Return tokens to frontend
    ok(res, {
      id_token: response.data.id_token,
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    });
  } catch (error: any) {
    console.error('[TOKEN_EXCHANGE] Failed:', error.response?.data || error.message);
    
    if (error.response) {
      // Forward Cognito error to frontend
      res.status(error.response.status).json({
        error: error.response.data.error || 'token_exchange_failed',
        error_description: error.response.data.error_description || 'Failed to exchange authorization code',
      });
      return;
    }

    internalError(res, 'Token exchange failed');
  }
}

/**
 * POST /auth/refresh
 * Refreshes access token using refresh token
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    badRequest(res, 'Missing refresh_token');
    return;
  }

  try {
    const config = getConfig();
    const tokenUrl = `${config.COGNITO_HOSTED_UI_DOMAIN}/oauth2/token`;

    // Build params object, only include client_secret if it exists
    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      client_id: config.COGNITO_CLIENT_ID,
      refresh_token,
    };

    if (config.COGNITO_CLIENT_SECRET) {
      params.client_secret = config.COGNITO_CLIENT_SECRET;
    }

    const response = await axios.post(
      tokenUrl,
      new URLSearchParams(params).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    ok(res, {
      id_token: response.data.id_token,
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    });
  } catch (error: any) {
    console.error('[TOKEN_REFRESH] Failed:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data.error || 'token_refresh_failed',
        error_description: error.response.data.error_description || 'Failed to refresh token',
      });
      return;
    }

    internalError(res, 'Token refresh failed');
  }
}
