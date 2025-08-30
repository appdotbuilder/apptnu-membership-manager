import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, paymentsTable } from '../db/schema';
import { type MidtransWebhook } from '../schema';
import { handleMidtransWebhook } from '../handlers/handle_midtrans_webhook';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Helper function to generate valid signature
const generateSignature = (orderId: string, statusCode: string, grossAmount: string): string => {
  const serverKey = process.env['MIDTRANS_SERVER_KEY'] || 'test-server-key';
  return crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
};

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  nama_perguruan_tinggi: 'Test University',
  nama_kepala_perpustakaan: 'Test Kepala',
  no_hp_kepala: '081234567890',
  instansi: 'Test Instansi',
  nama_pic: 'Test PIC',
  no_hp_pic: '081234567891',
  alamat_lengkap: 'Test Address',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'institusi@test.com',
  url_website: 'https://test.com',
  url_otomasi: 'https://otomasi.test.com',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 1000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const,
  membership_status: 'pending' as const
};

const baseWebhookInput: MidtransWebhook = {
  order_id: 'ORDER-12345',
  status_code: '200',
  gross_amount: '100000.00',
  signature_key: '',
  transaction_status: 'settlement',
  transaction_id: 'TXN-67890',
  payment_type: 'bank_transfer',
  transaction_time: '2024-01-15 10:00:00',
  settlement_time: '2024-01-15 10:05:00'
};

describe('handleMidtransWebhook', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully process settlement webhook', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const userId = users[0].id;

    // Create test payment
    const payments = await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-12345',
        amount: '100000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const paymentId = payments[0].id;

    // Generate valid signature
    const webhookInput = {
      ...baseWebhookInput,
      signature_key: generateSignature('ORDER-12345', '200', '100000.00')
    };

    const result = await handleMidtransWebhook(webhookInput);

    // Verify payment update
    expect(result.id).toBe(paymentId);
    expect(result.status).toBe('paid');
    expect(result.midtrans_transaction_id).toBe('TXN-67890');
    expect(result.payment_type).toBe('bank_transfer');
    expect(result.transaction_time).toBeInstanceOf(Date);
    expect(result.settlement_time).toBeInstanceOf(Date);
    expect(typeof result.amount).toBe('number');
    expect(result.amount).toBe(100000);

    // Verify user membership status updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(updatedUsers[0].membership_status).toBe('active');
  });

  it('should handle failed transaction status', async () => {
    // Create test user and payment
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const payments = await db.insert(paymentsTable)
      .values({
        user_id: users[0].id,
        midtrans_order_id: 'ORDER-FAILED',
        amount: '50000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const webhookInput = {
      ...baseWebhookInput,
      order_id: 'ORDER-FAILED',
      gross_amount: '50000.00',
      transaction_status: 'failure',
      signature_key: generateSignature('ORDER-FAILED', '200', '50000.00')
    };

    const result = await handleMidtransWebhook(webhookInput);

    expect(result.status).toBe('failed');

    // Verify user membership status NOT updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, users[0].id))
      .execute();

    expect(updatedUsers[0].membership_status).toBe('pending');
  });

  it('should handle expired transaction status', async () => {
    // Create test user and payment
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    await db.insert(paymentsTable)
      .values({
        user_id: users[0].id,
        midtrans_order_id: 'ORDER-EXPIRED',
        amount: '75000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const webhookInput = {
      ...baseWebhookInput,
      order_id: 'ORDER-EXPIRED',
      gross_amount: '75000.00',
      transaction_status: 'expire',
      signature_key: generateSignature('ORDER-EXPIRED', '200', '75000.00')
    };

    const result = await handleMidtransWebhook(webhookInput);

    expect(result.status).toBe('expired');
  });

  it('should handle capture transaction status as paid', async () => {
    // Create test user and payment
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    await db.insert(paymentsTable)
      .values({
        user_id: users[0].id,
        midtrans_order_id: 'ORDER-CAPTURE',
        amount: '125000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const webhookInput = {
      ...baseWebhookInput,
      order_id: 'ORDER-CAPTURE',
      gross_amount: '125000.00',
      transaction_status: 'capture',
      signature_key: generateSignature('ORDER-CAPTURE', '200', '125000.00')
    };

    const result = await handleMidtransWebhook(webhookInput);

    expect(result.status).toBe('paid');

    // Verify user membership status updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, users[0].id))
      .execute();

    expect(updatedUsers[0].membership_status).toBe('active');
  });

  it('should throw error for invalid signature', async () => {
    // Create test user and payment
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    await db.insert(paymentsTable)
      .values({
        user_id: users[0].id,
        midtrans_order_id: 'ORDER-INVALID',
        amount: '100000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const webhookInput = {
      ...baseWebhookInput,
      order_id: 'ORDER-INVALID',
      signature_key: 'invalid-signature'
    };

    await expect(handleMidtransWebhook(webhookInput)).rejects.toThrow(/Invalid signature/i);
  });

  it('should throw error for non-existent payment', async () => {
    const webhookInput = {
      ...baseWebhookInput,
      order_id: 'NON-EXISTENT-ORDER',
      signature_key: generateSignature('NON-EXISTENT-ORDER', '200', '100000.00')
    };

    await expect(handleMidtransWebhook(webhookInput)).rejects.toThrow(/Payment with order_id NON-EXISTENT-ORDER not found/i);
  });

  it('should handle webhook with optional fields missing', async () => {
    // Create test user and payment
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    await db.insert(paymentsTable)
      .values({
        user_id: users[0].id,
        midtrans_order_id: 'ORDER-MINIMAL',
        amount: '200000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const minimalWebhookInput: MidtransWebhook = {
      order_id: 'ORDER-MINIMAL',
      status_code: '200',
      gross_amount: '200000.00',
      transaction_status: 'settlement',
      signature_key: generateSignature('ORDER-MINIMAL', '200', '200000.00')
    };

    const result = await handleMidtransWebhook(minimalWebhookInput);

    expect(result.status).toBe('paid');
    expect(result.midtrans_transaction_id).toBeNull();
    expect(result.payment_type).toBeNull();
    expect(result.transaction_time).toBeNull();
    expect(result.settlement_time).toBeNull();
  });

  it('should handle unknown transaction status as pending', async () => {
    // Create test user and payment
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    await db.insert(paymentsTable)
      .values({
        user_id: users[0].id,
        midtrans_order_id: 'ORDER-UNKNOWN',
        amount: '300000.00',
        status: 'pending'
      })
      .returning()
      .execute();

    const webhookInput = {
      ...baseWebhookInput,
      order_id: 'ORDER-UNKNOWN',
      gross_amount: '300000.00',
      transaction_status: 'unknown_status',
      signature_key: generateSignature('ORDER-UNKNOWN', '200', '300000.00')
    };

    const result = await handleMidtransWebhook(webhookInput);

    expect(result.status).toBe('pending');

    // Verify user membership status NOT updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, users[0].id))
      .execute();

    expect(updatedUsers[0].membership_status).toBe('pending');
  });
});