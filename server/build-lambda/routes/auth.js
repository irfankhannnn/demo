import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as dynamodb from '../dynamodbService.js';
import { getAgencyConfig, setAgencyAdminCredentials } from '../agencyConfigService.js';
import { extractTenantIdOptional } from '../tenantMiddleware.js';

const router = express.Router();

// Login endpoint (supports per-tenant admin via AgencyConfig table)
router.post('/login', extractTenantIdOptional, async (req, res) => {
  const { username, password } = req.body;
  const tenantId = req.tenantId || null;

  if (!username || !password) {
    console.warn('Login attempt with missing credentials', { tenantId, hasUsername: !!username, hasPassword: !!password });
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    console.log('Login attempt', {
      tenantId,
      username,
      hasTenantHeader: !!req.headers['x-tenant-id'],
    });

    // If tenantId is provided, prefer tenant-specific admin from AgencyConfig table
    if (tenantId) {
      const config = await getAgencyConfig(tenantId);
      console.log('Tenant config lookup result', {
        tenantId,
        hasConfig: !!config,
        configUsername: config?.adminUsername,
      });

      if (config && config.adminUsername === username) {
        const validPassword = await bcrypt.compare(password, config.adminPasswordHash);

        if (!validPassword) {
          console.warn('Tenant admin login failed: invalid password', { tenantId, username });
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { id: tenantId, username: config.adminUsername, tenantId },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('Tenant admin login success', { tenantId, username });
        return res.json({
          token,
          user: {
            id: tenantId,
            username: config.adminUsername,
            tenantId,
          },
        });
      }

      // If tenantId is specified but no matching config or username,
      // fall back to global admin so local dev works even when AgencyConfig
      // is not yet set up for this tenant.
      console.log('No matching tenant-specific admin; falling back to global admin', {
        tenantId,
        username,
        hasConfig: !!config,
      });
    }

    // Global admin from core table (no tenant specified, or tenant-specific admin not found)
    const admin = await dynamodb.getAdminByUsername(username);
    console.log('Global admin lookup result', {
      username,
      found: !!admin,
    });

    if (!admin) {
      console.warn('Global admin login failed: admin not found', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      console.warn('Global admin login failed: invalid password', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.adminId, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Global admin login success', { username, adminId: admin.adminId });
    res.json({
      token,
      user: {
        id: admin.adminId,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password endpoint (supports per-tenant admin via AgencyConfig table)
router.post('/change-password', extractTenantIdOptional, async (req, res) => {
  const { username, currentPassword, newPassword, newUsername } = req.body;
  const tenantId = req.tenantId || null;

  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    // If tenantId is provided, change password in AgencyConfig table
    if (tenantId) {
      const config = await getAgencyConfig(tenantId);

      if (!config || config.adminUsername !== username) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(currentPassword, config.adminPasswordHash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid current password' });
      }

      const nextUsername = newUsername || config.adminUsername;

      await setAgencyAdminCredentials(tenantId, nextUsername, newPassword);

      return res.json({ message: 'Password changed successfully', username: nextUsername });
    }

    // Fallback: global admin in core table
    const admin = await dynamodb.getAdminByUsername(username);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(currentPassword, admin.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    await dynamodb.changeAdminPassword(username, newPassword);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
