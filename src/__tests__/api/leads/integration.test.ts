import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { POST } from '../../../app/api/leads/route';
import { cleanupDatabase, closeTestDatabase, getTestPrisma } from '../../setup/test-db';
import {
  createMockRequest,
  createValidLeadData,
  createInvalidLeadData,
  expectSuccessResponse,
  expectErrorResponse
} from '../../setup/test-helpers';

describe('Leads API Integration Tests', () => {
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    // Ensure test database is clean
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupDatabase();
  });

  describe('POST /api/leads', () => {
    it('should create a new lead with valid data', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      expectSuccessResponse(response, {
        name: validData.name,
        email: validData.email,
        phone: validData.phone,
        notes: validData.notes,
      });

      // Verify lead was actually saved to database
      const savedLead = await testPrisma.lead.findUnique({
        where: { email: validData.email }
      });
      expect(savedLead).toBeTruthy();
      expect(savedLead?.name).toBe(validData.name);
      expect(savedLead?.phone).toBe(validData.phone);
    });

    it('should create a lead without notes', async () => {
      const validData = createValidLeadData({ notes: undefined });
      const request = createMockRequest(validData);

      const response = await POST(request);

      expectSuccessResponse(response, {
        name: validData.name,
        email: validData.email,
        phone: validData.phone,
        notes: null,
      });
    });

    it('should reject lead with missing name', async () => {
      const invalidData = createInvalidLeadData('name', '');
      const request = createMockRequest(invalidData);

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');

      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Validation failed');
      expect(responseData.errors).toBeDefined();
      expect(responseData.errors.some((error: any) => error.path.includes('name'))).toBe(true);
    });

    it('should reject lead with invalid email format', async () => {
      const invalidData = createInvalidLeadData('email', 'invalid-email');
      const request = createMockRequest(invalidData);

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');

      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Validation failed');
      expect(responseData.errors).toBeDefined();
      expect(responseData.errors.some((error: any) => error.path.includes('email'))).toBe(true);
    });

    it('should reject lead with phone number less than 10 digits', async () => {
      const invalidData = createInvalidLeadData('phone', '123');
      const request = createMockRequest(invalidData);

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');

      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Validation failed');
      expect(responseData.errors).toBeDefined();
      expect(responseData.errors.some((error: any) => error.path.includes('phone'))).toBe(true);
    });

    it('should reject lead with duplicate email', async () => {
      // First, create a lead
      const firstLead = createValidLeadData();
      const firstRequest = createMockRequest(firstLead);
      await POST(firstRequest);

      // Try to create another lead with the same email
      const duplicateLead = createValidLeadData({
        name: 'Different Name',
        phone: '9876543210'
      });
      const duplicateRequest = createMockRequest(duplicateLead);

      const response = await POST(duplicateRequest);

      expectErrorResponse(response, 422, 'The email address is already in use.');
    });

    it('should reject lead with duplicate phone', async () => {
      // First, create a lead
      const firstLead = createValidLeadData();
      const firstRequest = createMockRequest(firstLead);
      await POST(firstRequest);

      // Try to create another lead with the same phone
      const duplicateLead = createValidLeadData({
        name: 'Different Name',
        email: 'different@example.com'
      });
      const duplicateRequest = createMockRequest(duplicateLead);

      const response = await POST(duplicateRequest);

      expectErrorResponse(response, 422, 'The phone number is already in use');
    });

    it('should return 418 teapot error when notes contain "coffee"', async () => {
      const coffeeLead = createValidLeadData({
        notes: 'I love coffee and want to learn more'
      });
      const request = createMockRequest(coffeeLead);

      const response = await POST(request);

      expectErrorResponse(response, 418, "I'm a teapot. No coffee for you!");
    });

    it('should return 418 teapot error when notes contain "coffee" (case insensitive)', async () => {
      const coffeeLead = createValidLeadData({
        notes: 'I love COFFEE and want to learn more'
      });
      const request = createMockRequest(coffeeLead);

      const response = await POST(request);

      expectErrorResponse(response, 418, "I'm a teapot. No coffee for you!");
    });

    it('should handle malformed JSON request body', async () => {
      const request = new Request('http://localhost:3000/api/leads', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as any);

      expectErrorResponse(response, 500);
    });

    it('should handle missing request body', async () => {
      const request = new Request('http://localhost:3000/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as any);

      expectErrorResponse(response, 500);
    });

    it('should create multiple leads with different data', async () => {
      const leads = [
        createValidLeadData({
          name: 'Alice Smith',
          email: 'alice@example.com',
          phone: '1111111111'
        }),
        createValidLeadData({
          name: 'Bob Johnson',
          email: 'bob@example.com',
          phone: '2222222222'
        }),
        createValidLeadData({
          name: 'Carol Williams',
          email: 'carol@example.com',
          phone: '3333333333'
        }),
      ];

      for (const lead of leads) {
        const request = createMockRequest(lead);
        const response = await POST(request);
        expectSuccessResponse(response, {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
        });
      }

      // Verify all leads were saved
      const savedLeads = await testPrisma.lead.findMany();
      expect(savedLeads).toHaveLength(3);
    });
  });
});
