import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, paymentsTable } from '../db/schema';
import { getUserPayments } from '../handlers/get_user_payments';

describe('getUserPayments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async (id?: number) => {
    const userData = {
      email: `test${id || 1}@example.com`,
      password_hash: 'hashedpassword',
      nama_perguruan_tinggi: 'Test University',
      nama_kepala_perpustakaan: 'Test Kepala',
      no_hp_kepala: '081234567890',
      instansi: 'Test Institution',
      nama_pic: 'Test PIC',
      no_hp_pic: '081234567891',
      alamat_lengkap: 'Test Address',
      provinsi: 'Jawa Timur' as const,
      email_institusi: `institution${id || 1}@example.com`,
      url_website: 'https://test.edu',
      url_otomasi: 'https://library.test.edu',
      repository_status: 'Sudah' as const,
      jumlah_koleksi: 1000,
      status_akreditasi: 'Akreditasi A' as const,
      jenis_keanggotaan: 'Pendaftaran Baru' as const
    };

    const result = await db.insert(usersTable)
      .values(userData)
      .returning()
      .execute();
    
    return result[0];
  };

  // Helper function to create a test payment
  const createTestPayment = async (userId: number, overrides: Partial<any> = {}) => {
    const paymentData = {
      user_id: userId,
      midtrans_order_id: `ORDER-${Date.now()}-${Math.random()}`,
      midtrans_transaction_id: `TXN-${Math.random()}`,
      amount: '500000.00',
      status: 'paid' as const,
      payment_type: 'bank_transfer',
      transaction_time: new Date(),
      settlement_time: new Date(),
      ...overrides
    };

    const result = await db.insert(paymentsTable)
      .values(paymentData)
      .returning()
      .execute();
    
    return result[0];
  };

  it('should return empty array for user with no payments', async () => {
    const user = await createTestUser();
    
    const result = await getUserPayments(user.id);
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return user payments in descending order by created_at', async () => {
    const user = await createTestUser();
    
    // Create payments with different timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const latest = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    
    const payment1 = await createTestPayment(user.id, {
      amount: '300000.00',
      created_at: earlier
    });
    
    const payment2 = await createTestPayment(user.id, {
      amount: '400000.00',
      created_at: now
    });
    
    const payment3 = await createTestPayment(user.id, {
      amount: '500000.00',
      created_at: latest
    });
    
    const result = await getUserPayments(user.id);
    
    expect(result).toHaveLength(3);
    
    // Should be ordered by created_at descending (newest first)
    expect(result[0].id).toEqual(payment3.id);
    expect(result[1].id).toEqual(payment2.id);
    expect(result[2].id).toEqual(payment1.id);
    
    // Verify amounts are converted to numbers
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].amount).toEqual(500000);
    expect(result[1].amount).toEqual(400000);
    expect(result[2].amount).toEqual(300000);
  });

  it('should only return payments for the specified user', async () => {
    const user1 = await createTestUser(1);
    const user2 = await createTestUser(2);
    
    // Create payments for both users
    await createTestPayment(user1.id, { amount: '100000.00' });
    await createTestPayment(user1.id, { amount: '200000.00' });
    await createTestPayment(user2.id, { amount: '300000.00' });
    
    const user1Payments = await getUserPayments(user1.id);
    const user2Payments = await getUserPayments(user2.id);
    
    expect(user1Payments).toHaveLength(2);
    expect(user2Payments).toHaveLength(1);
    
    // All payments should belong to the requested user
    user1Payments.forEach(payment => {
      expect(payment.user_id).toEqual(user1.id);
    });
    
    user2Payments.forEach(payment => {
      expect(payment.user_id).toEqual(user2.id);
    });
  });

  it('should return complete payment objects with all required fields', async () => {
    const user = await createTestUser();
    const payment = await createTestPayment(user.id, {
      midtrans_order_id: 'ORDER-TEST-123',
      midtrans_transaction_id: 'TXN-TEST-456',
      amount: '750000.50',
      status: 'pending',
      payment_type: 'credit_card'
    });
    
    const result = await getUserPayments(user.id);
    
    expect(result).toHaveLength(1);
    
    const returnedPayment = result[0];
    expect(returnedPayment.id).toEqual(payment.id);
    expect(returnedPayment.user_id).toEqual(user.id);
    expect(returnedPayment.midtrans_order_id).toEqual('ORDER-TEST-123');
    expect(returnedPayment.midtrans_transaction_id).toEqual('TXN-TEST-456');
    expect(returnedPayment.amount).toEqual(750000.5);
    expect(typeof returnedPayment.amount).toBe('number');
    expect(returnedPayment.status).toEqual('pending');
    expect(returnedPayment.payment_type).toEqual('credit_card');
    expect(returnedPayment.created_at).toBeInstanceOf(Date);
    expect(returnedPayment.updated_at).toBeInstanceOf(Date);
  });

  it('should handle payments with different statuses', async () => {
    const user = await createTestUser();
    
    await createTestPayment(user.id, { status: 'pending' });
    await createTestPayment(user.id, { status: 'paid' });
    await createTestPayment(user.id, { status: 'failed' });
    await createTestPayment(user.id, { status: 'expired' });
    
    const result = await getUserPayments(user.id);
    
    expect(result).toHaveLength(4);
    
    const statuses = result.map(payment => payment.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('paid');
    expect(statuses).toContain('failed');
    expect(statuses).toContain('expired');
  });

  it('should handle payments with null optional fields', async () => {
    const user = await createTestUser();
    
    await createTestPayment(user.id, {
      midtrans_transaction_id: null,
      payment_type: null,
      transaction_time: null,
      settlement_time: null
    });
    
    const result = await getUserPayments(user.id);
    
    expect(result).toHaveLength(1);
    expect(result[0].midtrans_transaction_id).toBeNull();
    expect(result[0].payment_type).toBeNull();
    expect(result[0].transaction_time).toBeNull();
    expect(result[0].settlement_time).toBeNull();
  });

  it('should return empty array for non-existent user', async () => {
    const nonExistentUserId = 99999;
    
    const result = await getUserPayments(nonExistentUserId);
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});