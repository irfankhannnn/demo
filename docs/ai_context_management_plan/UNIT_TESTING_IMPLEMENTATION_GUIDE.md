# RealtyFlow: Unit Testing Implementation Guide

**Version:** 1.0  
**Focus:** Backend and Frontend Unit Testing  
**Target Coverage:** 80%+

---

## 1. Backend Unit Testing Setup

### 1.1 Jest Configuration

**File:** `apps/crm/server/jest.config.js`

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/local-server.ts',
    '!src/**/*.types.ts',
  ],
  
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // Module name mapping for imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  
  // Timeout
  testTimeout: 10000,
  
  // Transform
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
};
```

**File:** `server/src/__tests__/setup.ts`

```typescript
import 'dotenv/config';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sesv2');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';

// Suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  generateId: (prefix: string) => `${prefix}#${Date.now()}`,
  generatePhone: () => `+9198765432${Math.floor(Math.random() * 100)}`,
  generateEmail: () => `test${Date.now()}@example.com`,
};
```

### 1.2 NPM Scripts

**File:** `apps/crm/server/package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## 2. Service Unit Tests

### 2.1 CRM Service Tests

**File:** `server/src/__tests__/unit/services/crm.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CRMService } from '../../../services/crm.service';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock DynamoDB
jest.mock('@aws-sdk/lib-dynamodb');

describe('CRMService', () => {
  let service: CRMService;
  let mockDynamoDB: jest.Mocked<DynamoDBDocumentClient>;

  beforeEach(() => {
    mockDynamoDB = new DynamoDBDocumentClient({} as any) as jest.Mocked<DynamoDBDocumentClient>;
    service = new CRMService(mockDynamoDB);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBuyer', () => {
    it('should create a buyer with valid data', async () => {
      const buyerData = {
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
        tenantId: 'TENANT#123',
      };

      mockDynamoDB.send = jest.fn().mockResolvedValue({
        Item: { buyerId: 'BUYER#1', ...buyerData, createdAt: new Date().toISOString() },
      });

      const result = await service.createBuyer(buyerData);

      expect(result).toHaveProperty('buyerId');
      expect(result.name).toBe('John Doe');
      expect(result.phone).toBe('+919876543210');
      expect(mockDynamoDB.send).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid phone number', async () => {
      const invalidData = {
        name: 'John Doe',
        phone: 'invalid',
        email: 'john@example.com',
        tenantId: 'TENANT#123',
      };

      await expect(service.createBuyer(invalidData)).rejects.toThrow(
        'Invalid phone number format'
      );
      expect(mockDynamoDB.send).not.toHaveBeenCalled();
    });

    it('should throw error for invalid email', async () => {
      const invalidData = {
        name: 'John Doe',
        phone: '+919876543210',
        email: 'invalid-email',
        tenantId: 'TENANT#123',
      };

      await expect(service.createBuyer(invalidData)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should throw error for missing required fields', async () => {
      const incompleteData = {
        name: 'John Doe',
        tenantId: 'TENANT#123',
      } as any;

      await expect(service.createBuyer(incompleteData)).rejects.toThrow(
        'Missing required fields'
      );
    });

    it('should generate unique buyerId', async () => {
      const buyerData = {
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
        tenantId: 'TENANT#123',
      };

      const mockSend = jest.fn()
        .mockResolvedValueOnce({
          Item: { buyerId: 'BUYER#1', ...buyerData },
        })
        .mockResolvedValueOnce({
          Item: { buyerId: 'BUYER#2', ...buyerData },
        });

      mockDynamoDB.send = mockSend;

      const buyer1 = await service.createBuyer(buyerData);
      const buyer2 = await service.createBuyer(buyerData);

      expect(buyer1.buyerId).not.toBe(buyer2.buyerId);
    });
  });

  describe('getBuyer', () => {
    it('should retrieve buyer by ID', async () => {
      const buyerId = 'BUYER#1';
      const tenantId = 'TENANT#123';
      const buyerData = {
        buyerId,
        name: 'John Doe',
        phone: '+919876543210',
        email: 'john@example.com',
        tenantId,
      };

      mockDynamoDB.send = jest.fn().mockResolvedValue({
        Item: buyerData,
      });

      const result = await service.getBuyer(buyerId, tenantId);

      expect(result).toEqual(buyerData);
      expect(mockDynamoDB.send).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent buyer', async () => {
      mockDynamoDB.send = jest.fn().mockResolvedValue({});

      const result = await service.getBuyer('BUYER#nonexistent', 'TENANT#123');

      expect(result).toBeNull();
    });

    it('should enforce tenant isolation', async () => {
      const buyerId = 'BUYER#1';
      const buyerData = {
        buyerId,
        name: 'John Doe',
        tenantId: 'TENANT#123',
      };

      mockDynamoDB.send = jest.fn().mockResolvedValue({
        Item: buyerData,
      });

      // Attempt to access with different tenant
      const result = await service.getBuyer(buyerId, 'TENANT#999');

      expect(result).toBeNull();
    });
  });

  describe('updateBuyer', () => {
    it('should update buyer with valid data', async () => {
      const buyerId = 'BUYER#1';
      const tenantId = 'TENANT#123';
      const updateData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      mockDynamoDB.send = jest.fn().mockResolvedValue({
        Item: {
          buyerId,
          tenantId,
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      });

      const result = await service.updateBuyer(buyerId, tenantId, updateData);

      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane@example.com');
    });

    it('should not allow updating tenantId', async () => {
      const buyerId = 'BUYER#1';
      const tenantId = 'TENANT#123';

      await expect(
        service.updateBuyer(buyerId, tenantId, { tenantId: 'TENANT#999' })
      ).rejects.toThrow('Cannot update tenantId');
    });

    it('should validate email on update', async () => {
      const buyerId = 'BUYER#1';
      const tenantId = 'TENANT#123';

      await expect(
        service.updateBuyer(buyerId, tenantId, { email: 'invalid-email' })
      ).rejects.toThrow('Invalid email format');
    });
  });

  describe('deleteBuyer', () => {
    it('should delete buyer', async () => {
      const buyerId = 'BUYER#1';
      const tenantId = 'TENANT#123';

      mockDynamoDB.send = jest.fn().mockResolvedValue({});

      await service.deleteBuyer(buyerId, tenantId);

      expect(mockDynamoDB.send).toHaveBeenCalledTimes(1);
    });

    it('should enforce tenant isolation on delete', async () => {
      const buyerId = 'BUYER#1';

      await expect(
        service.deleteBuyer(buyerId, 'TENANT#999')
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('listBuyers', () => {
    it('should paginate results correctly', async () => {
      const tenantId = 'TENANT#123';
      const buyers = Array(10).fill(null).map((_, i) => ({
        buyerId: `BUYER#${i}`,
        name: `Buyer ${i}`,
        tenantId,
      }));

      mockDynamoDB.send = jest.fn()
        .mockResolvedValueOnce({
          Items: buyers,
          LastEvaluatedKey: { buyerId: 'BUYER#9' },
        });

      const result = await service.listBuyers(tenantId, { limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.nextToken).toBeDefined();
    });

    it('should filter by search term', async () => {
      const tenantId = 'TENANT#123';
      const buyers = [
        { buyerId: 'BUYER#1', name: 'John Doe', tenantId },
      ];

      mockDynamoDB.send = jest.fn().mockResolvedValue({
        Items: buyers,
      });

      const result = await service.listBuyers(tenantId, { search: 'John' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toContain('John');
    });

    it('should enforce tenant isolation in list', async () => {
      const tenantId = 'TENANT#123';
      const buyers = [
        { buyerId: 'BUYER#1', name: 'Buyer 1', tenantId },
        { buyerId: 'BUYER#2', name: 'Buyer 2', tenantId: 'TENANT#999' },
      ];

      mockDynamoDB.send = jest.fn().mockResolvedValue({
        Items: buyers.filter(b => b.tenantId === tenantId),
      });

      const result = await service.listBuyers(tenantId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].tenantId).toBe(tenantId);
    });
  });
});
```

### 2.2 Subscription Service Tests

**File:** `server/src/__tests__/unit/services/subscription.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SubscriptionService } from '../../../services/subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    service = new SubscriptionService();
  });

  describe('checkSeatAvailability', () => {
    it('should allow creation when under seat limit', async () => {
      const tenantId = 'TENANT#123';
      
      jest.spyOn(service, 'getSubscription').mockResolvedValue({
        tenantId,
        plan: 'solo',
        seatsPaid: 1,
        seatsUsed: 0,
        paymentStatus: 'active',
      });

      const result = await service.checkSeatAvailability(tenantId);

      expect(result.canInvite).toBe(true);
      expect(result.seatsAvailable).toBe(1);
    });

    it('should block creation when at seat limit', async () => {
      const tenantId = 'TENANT#123';
      
      jest.spyOn(service, 'getSubscription').mockResolvedValue({
        tenantId,
        plan: 'solo',
        seatsPaid: 1,
        seatsUsed: 1,
        paymentStatus: 'active',
      });

      const result = await service.checkSeatAvailability(tenantId);

      expect(result.canInvite).toBe(false);
      expect(result.seatsAvailable).toBe(0);
    });

    it('should return upgrade options when at limit', async () => {
      const tenantId = 'TENANT#123';
      
      jest.spyOn(service, 'getSubscription').mockResolvedValue({
        tenantId,
        plan: 'solo',
        seatsPaid: 1,
        seatsUsed: 1,
        paymentStatus: 'active',
      });

      const result = await service.checkSeatAvailability(tenantId);

      expect(result.upgradeOptions).toBeDefined();
      expect(result.upgradeOptions.length).toBeGreaterThan(0);
    });
  });

  describe('getTrialStatus', () => {
    it('should return trial status for new tenant', async () => {
      const tenantId = 'TENANT#123';
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 5); // 5 days ago

      jest.spyOn(service, 'getTenantCreationDate').mockResolvedValue(createdAt);

      const result = await service.getTrialStatus(tenantId);

      expect(result.isTrialing).toBe(true);
      expect(result.trialDaysLeft).toBeLessThanOrEqual(25);
      expect(result.trialDaysLeft).toBeGreaterThan(0);
    });

    it('should return expired trial status', async () => {
      const tenantId = 'TENANT#123';
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 31); // 31 days ago

      jest.spyOn(service, 'getTenantCreationDate').mockResolvedValue(createdAt);

      const result = await service.getTrialStatus(tenantId);

      expect(result.isTrialing).toBe(false);
      expect(result.trialDaysLeft).toBeLessThanOrEqual(0);
    });
  });

  describe('validatePaymentStatus', () => {
    it('should allow operations for active payment', async () => {
      const tenantId = 'TENANT#123';
      
      jest.spyOn(service, 'getSubscription').mockResolvedValue({
        tenantId,
        plan: 'team',
        paymentStatus: 'active',
      });

      const result = await service.validatePaymentStatus(tenantId);

      expect(result.isValid).toBe(true);
      expect(result.canPerformOperations).toBe(true);
    });

    it('should block operations for failed payment', async () => {
      const tenantId = 'TENANT#123';
      
      jest.spyOn(service, 'getSubscription').mockResolvedValue({
        tenantId,
        plan: 'team',
        paymentStatus: 'failed',
      });

      const result = await service.validatePaymentStatus(tenantId);

      expect(result.isValid).toBe(false);
      expect(result.canPerformOperations).toBe(false);
    });
  });
});
```

---

## 3. Middleware Unit Tests

### 3.1 Tenant Isolation Middleware

**File:** `server/src/__tests__/unit/middleware/tenant-isolation.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { tenantIsolationMiddleware } from '../../../middleware/tenant-isolation';
import { Request, Response, NextFunction } from 'express';

describe('Tenant Isolation Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    req = {
      user: { tenantId: 'TENANT#123', userId: 'USER#456' },
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('Resource ID validation', () => {
    it('should allow access to own tenant resources', () => {
      req.params = { buyerId: 'TENANT#123#BUYER#1' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block access to other tenant resources', () => {
      req.params = { buyerId: 'TENANT#999#BUYER#1' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle multiple resource IDs', () => {
      req.params = {
        buyerId: 'TENANT#123#BUYER#1',
        propertyId: 'TENANT#123#PROPERTY#1',
      };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should block if any resource ID is from different tenant', () => {
      req.params = {
        buyerId: 'TENANT#123#BUYER#1',
        propertyId: 'TENANT#999#PROPERTY#1',
      };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Query parameter validation', () => {
    it('should allow filtering by own tenant', () => {
      req.query = { tenantId: 'TENANT#123' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should block filtering by other tenant', () => {
      req.query = { tenantId: 'TENANT#999' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow queries without tenantId filter', () => {
      req.query = { search: 'John' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Body validation', () => {
    it('should allow body without tenantId', () => {
      req.body = { name: 'John Doe', email: 'john@example.com' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should block body with different tenantId', () => {
      req.body = { name: 'John Doe', tenantId: 'TENANT#999' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow body with own tenantId', () => {
      req.body = { name: 'John Doe', tenantId: 'TENANT#123' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle missing user context', () => {
      req.user = undefined;
      req.params = { buyerId: 'TENANT#123#BUYER#1' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle malformed resource IDs', () => {
      req.params = { buyerId: 'INVALID_ID' };
      
      tenantIsolationMiddleware(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
```

---

## 4. Utility Function Tests

### 4.1 Validators Tests

**File:** `server/src/__tests__/unit/utils/validators.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  validatePhone,
  validateEmail,
  validateBudget,
  validatePropertyType,
} from '../../../utils/validators';

describe('Validators', () => {
  describe('validatePhone', () => {
    it('should validate Indian phone numbers', () => {
      expect(validatePhone('+919876543210')).toBe(true);
      expect(validatePhone('+91-9876543210')).toBe(true);
      expect(validatePhone('9876543210')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('invalid')).toBe(false);
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('+1234567890')).toBe(false);
    });

    it('should reject empty phone', () => {
      expect(validatePhone('')).toBe(false);
      expect(validatePhone(null as any)).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('john@example.com')).toBe(true);
      expect(validateEmail('user.name@example.co.in')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validateBudget', () => {
    it('should validate positive budgets', () => {
      expect(validateBudget(1000000)).toBe(true);
      expect(validateBudget(50000000)).toBe(true);
    });

    it('should reject zero or negative budgets', () => {
      expect(validateBudget(0)).toBe(false);
      expect(validateBudget(-1000000)).toBe(false);
    });

    it('should reject non-numeric budgets', () => {
      expect(validateBudget('1000000' as any)).toBe(false);
      expect(validateBudget(null as any)).toBe(false);
    });
  });

  describe('validatePropertyType', () => {
    it('should validate allowed property types', () => {
      expect(validatePropertyType('apartment')).toBe(true);
      expect(validatePropertyType('villa')).toBe(true);
      expect(validatePropertyType('plot')).toBe(true);
      expect(validatePropertyType('commercial')).toBe(true);
    });

    it('should reject invalid property types', () => {
      expect(validatePropertyType('invalid')).toBe(false);
      expect(validatePropertyType('house')).toBe(false);
    });
  });
});
```

---

## 5. Frontend Unit Testing

### 5.1 Vitest Configuration

**File:** `apps/crm/real-estate-crm-app/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/index.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**File:** `apps/crm/real-estate-crm-app/src/__tests__/setup.ts`

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
```

### 5.2 Component Tests

**File:** `apps/crm/real-estate-crm-app/src/__tests__/unit/components/LeadCard.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadCard } from '../../../components/LeadCard';

describe('LeadCard Component', () => {
  const mockLead = {
    leadId: 'LEAD#1',
    buyerId: 'BUYER#1',
    propertyId: 'PROPERTY#1',
    status: 'interested',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should render lead information', () => {
    render(<LeadCard lead={mockLead} />);
    
    expect(screen.getByText('LEAD#1')).toBeInTheDocument();
    expect(screen.getByText('interested')).toBeInTheDocument();
  });

  it('should call onStatusChange when status is updated', () => {
    const onStatusChange = vi.fn();
    render(<LeadCard lead={mockLead} onStatusChange={onStatusChange} />);
    
    const statusButton = screen.getByRole('button', { name: /interested/i });
    fireEvent.click(statusButton);
    
    expect(onStatusChange).toHaveBeenCalled();
  });

  it('should display different styles for different statuses', () => {
    const { rerender } = render(<LeadCard lead={mockLead} />);
    
    let statusElement = screen.getByText('interested');
    expect(statusElement).toHaveClass('status-interested');
    
    const updatedLead = { ...mockLead, status: 'qualified' };
    rerender(<LeadCard lead={updatedLead} />);
    
    statusElement = screen.getByText('qualified');
    expect(statusElement).toHaveClass('status-qualified');
  });

  it('should handle missing optional props', () => {
    const minimalLead = {
      leadId: 'LEAD#1',
      status: 'interested',
    };
    
    render(<LeadCard lead={minimalLead as any} />);
    
    expect(screen.getByText('LEAD#1')).toBeInTheDocument();
  });
});
```

### 5.3 Hook Tests

**File:** `apps/crm/real-estate-crm-app/src/__tests__/unit/hooks/useBuyers.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBuyers } from '../../../hooks/useBuyers';
import * as api from '../../../services/api';

vi.mock('../../../services/api');

describe('useBuyers Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch buyers on mount', async () => {
    const mockBuyers = [
      { buyerId: 'BUYER#1', name: 'John Doe' },
      { buyerId: 'BUYER#2', name: 'Jane Doe' },
    ];

    vi.spyOn(api, 'getBuyers').mockResolvedValue({
      items: mockBuyers,
      nextToken: null,
    });

    const { result } = renderHook(() => useBuyers());

    await waitFor(() => {
      expect(result.current.buyers).toEqual(mockBuyers);
    });

    expect(api.getBuyers).toHaveBeenCalled();
  });

  it('should handle loading state', async () => {
    vi.spyOn(api, 'getBuyers').mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ items: [] }), 100))
    );

    const { result } = renderHook(() => useBuyers());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch');
    vi.spyOn(api, 'getBuyers').mockRejectedValue(error);

    const { result } = renderHook(() => useBuyers());

    await waitFor(() => {
      expect(result.current.error).toBe(error);
    });
  });

  it('should support pagination', async () => {
    const page1 = {
      items: Array(10).fill(null).map((_, i) => ({
        buyerId: `BUYER#${i}`,
        name: `Buyer ${i}`,
      })),
      nextToken: 'token-123',
    };

    const page2 = {
      items: Array(5).fill(null).map((_, i) => ({
        buyerId: `BUYER#${10 + i}`,
        name: `Buyer ${10 + i}`,
      })),
      nextToken: null,
    };

    vi.spyOn(api, 'getBuyers')
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(() => useBuyers());

    await waitFor(() => {
      expect(result.current.buyers).toHaveLength(10);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.buyers).toHaveLength(15);
    });
  });
});
```

---

## 6. Running Tests

### 6.1 Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- crm.service.test.ts

# Run with coverage
npm run test:coverage

# Run with debugging
npm run test:debug
```

### 6.2 CI/CD Pipeline

```bash
# Run tests with coverage reporting
npm run test:ci

# Generate coverage report
npm run test:coverage

# Upload to code coverage service
npx codecov
```

---

## 7. Best Practices

1. **Test Organization:** Group related tests with `describe` blocks
2. **Naming:** Use descriptive test names that explain what is being tested
3. **Setup/Teardown:** Use `beforeEach`/`afterEach` for common setup
4. **Mocking:** Mock external dependencies (AWS, HTTP, etc.)
5. **Assertions:** Use specific assertions, not generic truthy checks
6. **Coverage:** Aim for 80%+ coverage, focus on critical paths
7. **Performance:** Keep tests fast (< 100ms each)
8. **Isolation:** Each test should be independent
9. **Clarity:** Write tests that are easy to understand
10. **Maintenance:** Update tests when requirements change

---

**End of Document**
