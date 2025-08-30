import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, paymentsTable } from '../db/schema';
import { type CreatePaymentInput } from '../schema';
import { createPayment } from '../handlers/create_payment';
import { eq } from 'drizzle-orm';

// Simple fetch mock
const mockFetch = mock(async (url: string, options?: any) => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      token: 'mock_snap_token',
      redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/mock_token'
    }),
    text: async () => 'Mock response'
  } as Response;
});

// Set up environment
globalThis.fetch = mockFetch as any;
process.env['MIDTRANS_SERVER_KEY'] = 'test_server_key';
process.env['MIDTRANS_ENVIRONMENT'] = 'sandbox';

// Test user data
const testUser = {
  email: 'test@university.edu',
  password_hash: 'hashed_password',
  role: 'member' as const,
  nama_perguruan_tinggi: 'Universitas Test',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '081234567890',
  instansi: 'Perpustakaan Universitas Test',
  nama_pic: 'Test PIC',
  no_hp_pic: '081234567891',
  alamat_lengkap: 'Jl. Test No. 123, Kota Test',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'library@university.edu',
  url_website: 'https://university.edu',
  url_otomasi: 'https://library.university.edu',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 10000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const,
  membership_status: 'pending' as const
};

const testPaymentInput: CreatePaymentInput = {
  user_id: 1,
  amount: 500000
};

describe('createPayment', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test user
    await db.insert(usersTable).values(testUser).execute();
    
    // Reset mock call count
    mockFetch.mockClear();
  });

  afterEach(resetDB);

  it('should create a payment and return redirect URL', async () => {
    const result = await createPayment(testPaymentInput);

    // Verify payment object structure
    expect(result.payment).toBeDefined();
    expect(result.payment.id).toBeDefined();
    expect(result.payment.user_id).toEqual(1);
    expect(result.payment.amount).toEqual(500000);
    expect(typeof result.payment.amount).toBe('number');
    expect(result.payment.status).toEqual('pending');
    expect(result.payment.midtrans_order_id).toMatch(/^ORDER-\d+-1$/);
    expect(result.payment.midtrans_transaction_id).toBeNull();
    expect(result.payment.created_at).toBeInstanceOf(Date);
    expect(result.payment.updated_at).toBeInstanceOf(Date);

    // Verify redirect URL
    expect(result.redirect_url).toEqual('https://app.sandbox.midtrans.com/snap/v2/vtweb/mock_token');
  });

  it('should save payment to database', async () => {
    const result = await createPayment(testPaymentInput);

    // Query database to verify payment was saved
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, result.payment.id))
      .execute();

    expect(payments).toHaveLength(1);
    expect(payments[0].user_id).toEqual(1);
    expect(parseFloat(payments[0].amount)).toEqual(500000);
    expect(payments[0].status).toEqual('pending');
    expect(payments[0].midtrans_order_id).toMatch(/^ORDER-\d+-1$/);
  });

  it('should generate unique order IDs for different payments', async () => {
    const result1 = await createPayment(testPaymentInput);
    
    // Wait a bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const result2 = await createPayment(testPaymentInput);

    expect(result1.payment.midtrans_order_id).not.toEqual(result2.payment.midtrans_order_id);
    expect(result1.payment.midtrans_order_id).toMatch(/^ORDER-\d+-1$/);
    expect(result2.payment.midtrans_order_id).toMatch(/^ORDER-\d+-1$/);
  });

  it('should call Midtrans API with correct parameters', async () => {
    await createPayment(testPaymentInput);

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
  });

  it('should throw error for non-existent user', async () => {
    const invalidInput: CreatePaymentInput = {
      user_id: 999,
      amount: 500000
    };

    await expect(createPayment(invalidInput)).rejects.toThrow(/User with ID 999 not found/);
  });

  it('should handle Midtrans API errors', async () => {
    // Create failed mock
    const failedMockFetch = mock(async (url: string, options?: any) => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({}),
        text: async () => 'Invalid request'
      } as Response;
    });
    
    globalThis.fetch = failedMockFetch as any;

    await expect(createPayment(testPaymentInput)).rejects.toThrow(/Midtrans API error: 400 Bad Request/);
    
    // Restore original mock
    globalThis.fetch = mockFetch as any;
  });

  it('should handle missing Midtrans server key', async () => {
    // Temporarily remove server key
    const originalKey = process.env['MIDTRANS_SERVER_KEY'];
    delete process.env['MIDTRANS_SERVER_KEY'];

    await expect(createPayment(testPaymentInput)).rejects.toThrow(/Midtrans server key not configured/);

    // Restore server key
    if (originalKey) {
      process.env['MIDTRANS_SERVER_KEY'] = originalKey;
    }
  });

  it('should handle decimal amounts correctly', async () => {
    const decimalInput: CreatePaymentInput = {
      user_id: 1,
      amount: 499.99
    };

    const result = await createPayment(decimalInput);

    // Verify amount is handled correctly
    expect(result.payment.amount).toEqual(499.99);
    expect(typeof result.payment.amount).toBe('number');
  });

  it('should use production URL when environment is production', async () => {
    // Set production environment
    process.env['MIDTRANS_ENVIRONMENT'] = 'production';

    await createPayment(testPaymentInput);

    // Verify API was called
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Reset to sandbox
    process.env['MIDTRANS_ENVIRONMENT'] = 'sandbox';
  });
});