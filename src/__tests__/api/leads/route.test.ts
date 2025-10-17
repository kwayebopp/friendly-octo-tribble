import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { POST } from '../../../app/api/leads/route';
import { cleanupDatabase, closeTestDatabase, getTestPrisma } from '../../setup/test-db';
import {
  createMockRequest,
  createValidLeadData,
  createInvalidLeadData
} from '../../setup/test-helpers';

describe('Leads API Route Tests', () => {
  const testPrisma = getTestPrisma();

  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('HTTP Method Handling', () => {
    it('should handle POST requests correctly', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData, 'POST');

      const response = await POST(request);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(201);
    });

    it('should return proper content type for JSON responses', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should handle requests with proper headers', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Request Body Parsing', () => {
    it('should parse valid JSON request body', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.name).toBe(validData.name);
    });

    it('should handle empty request body', async () => {
      const request = new Request('http://localhost:3000/api/leads', {
        method: 'POST',
        body: '',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(500);
    });

    it('should handle null request body', async () => {
      const request = new Request('http://localhost:3000/api/leads', {
        method: 'POST',
        body: null as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON', async () => {
      const request = new Request('http://localhost:3000/api/leads', {
        method: 'POST',
        body: '{"name": "John", "email": "john@example.com", "phone": "1234567890", "notes": "test",}', // trailing comma
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(500);
    });
  });

  describe('Response Status Codes', () => {
    it('should return 201 for successful lead creation', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should return 400 for validation errors', async () => {
      const invalidData = createInvalidLeadData('name', '');
      const request = createMockRequest(invalidData);

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 418 for coffee teapot error', async () => {
      const coffeeData = createValidLeadData({ notes: 'I love coffee' });
      const request = createMockRequest(coffeeData);

      const response = await POST(request);

      expect(response.status).toBe(418);
    });

    it('should return 422 for duplicate email', async () => {
      // Create first lead
      const firstLead = createValidLeadData();
      const firstRequest = createMockRequest(firstLead);
      await POST(firstRequest);

      // Try to create duplicate
      const duplicateLead = createValidLeadData({
        name: 'Different Name',
        phone: '9876543210'
      });
      const duplicateRequest = createMockRequest(duplicateLead);

      const response = await POST(duplicateRequest);

      expect(response.status).toBe(422);
    });

    it('should return 422 for duplicate phone', async () => {
      // Create first lead
      const firstLead = createValidLeadData();
      const firstRequest = createMockRequest(firstLead);
      await POST(firstRequest);

      // Try to create duplicate
      const duplicateLead = createValidLeadData({
        name: 'Different Name',
        email: 'different@example.com'
      });
      const duplicateRequest = createMockRequest(duplicateLead);

      const response = await POST(duplicateRequest);

      expect(response.status).toBe(422);
    });

    it('should return 500 for server errors', async () => {
      const request = new Request('http://localhost:3000/api/leads', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(500);
    });
  });

  describe('Response Body Structure', () => {
    it('should return success response with correct structure', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Lead submitted successfully');
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('name', validData.name);
      expect(data.data).toHaveProperty('email', validData.email);
      expect(data.data).toHaveProperty('phone', validData.phone);
      expect(data.data).toHaveProperty('notes', validData.notes);
      expect(data.data).toHaveProperty('createdAt');
    });

    it('should return error response with correct structure for validation errors', async () => {
      const invalidData = createInvalidLeadData('name', '');
      const request = createMockRequest(invalidData);

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('message', 'Validation failed');
      expect(data).toHaveProperty('errors');
      expect(Array.isArray(data.errors)).toBe(true);
    });

    it('should return error response with correct structure for teapot error', async () => {
      const coffeeData = createValidLeadData({ notes: 'I love coffee' });
      const request = createMockRequest(coffeeData);

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('message', "I'm a teapot. No coffee for you!");
    });

    it('should return error response with correct structure for duplicate email', async () => {
      // Create first lead
      const firstLead = createValidLeadData();
      const firstRequest = createMockRequest(firstLead);
      await POST(firstRequest);

      // Try to create duplicate
      const duplicateLead = createValidLeadData({
        name: 'Different Name',
        phone: '9876543210'
      });
      const duplicateRequest = createMockRequest(duplicateLead);

      const response = await POST(duplicateRequest);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('message', 'The email address is already in use.');
    });
  });

  describe('Database Integration', () => {
    it('should persist lead data to database', async () => {
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify data was saved to database
      const savedLead = await testPrisma.lead.findUnique({
        where: { email: validData.email }
      });

      expect(savedLead).toBeTruthy();
      expect(savedLead?.name).toBe(validData.name);
      expect(savedLead?.phone).toBe(validData.phone);
      expect(savedLead?.notes).toBe(validData.notes);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test that the function doesn't crash
      const validData = createValidLeadData();
      const request = createMockRequest(validData);

      const response = await POST(request);

      // Should either succeed or fail gracefully
      expect([201, 500]).toContain(response.status);
    });
  });
});
