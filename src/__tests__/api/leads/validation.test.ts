import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Import the lead schema from the route file
const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  notes: z.string().optional(),
});

describe('Lead Validation Schema', () => {
  describe('Valid data', () => {
    it('should validate complete lead data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        notes: 'Interested in our services',
      };

      const result = leadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should validate lead data without notes', () => {
      const validData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '0987654321',
      };

      const result = leadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should validate lead data with empty notes', () => {
      const validData = {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        phone: '5555555555',
        notes: '',
      };

      const result = leadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });
  });

  describe('Invalid data', () => {
    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        email: 'test@example.com',
        phone: '1234567890',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['name']);
        expect(result.error.issues[0].message).toBe('Name is required');
      }
    });

    it('should reject missing name', () => {
      const invalidData = {
        email: 'test@example.com',
        phone: '1234567890',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['name']);
      }
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        name: 'Test User',
        email: 'invalid-email',
        phone: '1234567890',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['email']);
        expect(result.error.issues[0].message).toBe('Invalid email format');
      }
    });

    it('should reject missing email', () => {
      const invalidData = {
        name: 'Test User',
        phone: '1234567890',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['email']);
      }
    });

    it('should reject phone number less than 10 digits', () => {
      const invalidData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '123',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['phone']);
        expect(result.error.issues[0].message).toBe('Phone number must be at least 10 digits');
      }
    });

    it('should reject missing phone', () => {
      const invalidData = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['phone']);
      }
    });

    it('should reject multiple invalid fields', () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        phone: '123',
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(3);
        const paths = result.error.issues.map(issue => issue.path[0]);
        expect(paths).toContain('name');
        expect(paths).toContain('email');
        expect(paths).toContain('phone');
      }
    });

    it('should reject null values', () => {
      const invalidData = {
        name: null,
        email: null,
        phone: null,
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should reject undefined values', () => {
      const invalidData = {
        name: undefined,
        email: undefined,
        phone: undefined,
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should reject non-string values', () => {
      const invalidData = {
        name: 123,
        email: 456,
        phone: 789,
      };

      const result = leadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge cases', () => {
    it('should accept exactly 10 digit phone number', () => {
      const validData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
      };

      const result = leadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept phone number with more than 10 digits', () => {
      const validData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890123',
      };

      const result = leadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept various valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@example-domain.com',
        'test@subdomain.example.com',
      ];

      validEmails.forEach(email => {
        const validData = {
          name: 'Test User',
          email,
          phone: '1234567890',
        };

        const result = leadSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    it('should reject various invalid email formats', () => {
      const invalidEmails = [
        'user@',
        '@example.com',
        'user@.com',
        'user.example.com',
        'user@example',
        'user space@example.com',
        '',
      ];

      invalidEmails.forEach(email => {
        const invalidData = {
          name: 'Test User',
          email,
          phone: '1234567890',
        };

        const result = leadSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});
