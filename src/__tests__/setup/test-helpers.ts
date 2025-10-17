import { NextRequest } from 'next/server';

export const createMockRequest = (body: any, method: string = 'POST'): NextRequest => {
  const request = new NextRequest('http://localhost:3000/api/leads', {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return request;
};

export const createValidLeadData = (overrides: Partial<any> = {}) => ({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '1234567890',
  notes: 'Test lead',
  ...overrides,
});

export const createInvalidLeadData = (field: string, value: any) => {
  const validData = createValidLeadData();
  return {
    ...validData,
    [field]: value,
  };
};

export const expectResponseStructure = (response: any, expectedStatus: number) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('content-type')).toContain('application/json');
};

export const expectSuccessResponse = (response: any, expectedData: any) => {
  expectResponseStructure(response, 201);
  const data = response.json();
  expect(data).resolves.toMatchObject({
    success: true,
    message: 'Lead submitted successfully',
    data: expect.objectContaining(expectedData),
  });
};

export const expectErrorResponse = (response: any, expectedStatus: number, expectedMessage?: string) => {
  expectResponseStructure(response, expectedStatus);
  const data = response.json();
  expect(data).resolves.toMatchObject({
    success: false,
    message: expectedMessage || expect.any(String),
  });
};
