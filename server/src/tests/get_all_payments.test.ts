import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, paymentsTable } from '../db/schema';
import { getAllPayments } from '../handlers/get_all_payments';

describe('getAllPayments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no payments exist', async () => {
    const result = await getAllPayments();
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all payments ordered by created_at descending', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        nama_perguruan_tinggi: 'Test University',
        nama_kepala_perpustakaan: 'Test Head Librarian',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Test Address',
        provinsi: 'Jawa Timur',
        email_institusi: 'institution@example.com',
        url_website: 'https://example.com',
        url_otomasi: 'https://automation.example.com',
        repository_status: 'Sudah',
        jumlah_koleksi: 1000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple payments with different timestamps
    const firstPayment = await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-001',
        amount: '100000',
        status: 'pending'
      })
      .returning()
      .execute();

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondPayment = await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-002',
        midtrans_transaction_id: 'TXN-002',
        amount: '200000',
        status: 'paid',
        payment_type: 'bank_transfer'
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const thirdPayment = await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-003',
        amount: '300000',
        status: 'failed'
      })
      .returning()
      .execute();

    const result = await getAllPayments();

    // Should return all 3 payments
    expect(result).toHaveLength(3);
    
    // Should be ordered by created_at descending (newest first)
    expect(result[0].id).toBe(thirdPayment[0].id);
    expect(result[1].id).toBe(secondPayment[0].id);
    expect(result[2].id).toBe(firstPayment[0].id);
  });

  it('should convert numeric amount fields correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        nama_perguruan_tinggi: 'Test University',
        nama_kepala_perpustakaan: 'Test Head Librarian',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Test Address',
        provinsi: 'Jawa Timur',
        email_institusi: 'institution@example.com',
        url_website: 'https://example.com',
        url_otomasi: 'https://automation.example.com',
        repository_status: 'Sudah',
        jumlah_koleksi: 1000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create payment with decimal amount
    await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-DECIMAL',
        amount: '150000.50', // Decimal amount stored as string
        status: 'paid'
      })
      .execute();

    const result = await getAllPayments();
    
    expect(result).toHaveLength(1);
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].amount).toBe(150000.50);
  });

  it('should return payments with all required fields', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        nama_perguruan_tinggi: 'Test University',
        nama_kepala_perpustakaan: 'Test Head Librarian',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Test Address',
        provinsi: 'Jawa Timur',
        email_institusi: 'institution@example.com',
        url_website: 'https://example.com',
        url_otomasi: 'https://automation.example.com',
        repository_status: 'Sudah',
        jumlah_koleksi: 1000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create payment with complete data
    await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-COMPLETE',
        midtrans_transaction_id: 'TXN-COMPLETE',
        amount: '500000',
        status: 'paid',
        payment_type: 'credit_card'
      })
      .execute();

    const result = await getAllPayments();
    
    expect(result).toHaveLength(1);
    const payment = result[0];
    
    // Verify all required fields are present
    expect(payment.id).toBeDefined();
    expect(payment.user_id).toBe(userId);
    expect(payment.midtrans_order_id).toBe('ORDER-COMPLETE');
    expect(payment.midtrans_transaction_id).toBe('TXN-COMPLETE');
    expect(payment.amount).toBe(500000);
    expect(payment.status).toBe('paid');
    expect(payment.payment_type).toBe('credit_card');
    expect(payment.created_at).toBeInstanceOf(Date);
    expect(payment.updated_at).toBeInstanceOf(Date);
  });

  it('should handle payments with null values correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        nama_perguruan_tinggi: 'Test University',
        nama_kepala_perpustakaan: 'Test Head Librarian',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Test Address',
        provinsi: 'Jawa Timur',
        email_institusi: 'institution@example.com',
        url_website: 'https://example.com',
        url_otomasi: 'https://automation.example.com',
        repository_status: 'Sudah',
        jumlah_koleksi: 1000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create payment with minimal data (null values for optional fields)
    await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-MINIMAL',
        amount: '100000',
        status: 'pending'
      })
      .execute();

    const result = await getAllPayments();
    
    expect(result).toHaveLength(1);
    const payment = result[0];
    
    // Required fields should be present
    expect(payment.id).toBeDefined();
    expect(payment.user_id).toBe(userId);
    expect(payment.midtrans_order_id).toBe('ORDER-MINIMAL');
    expect(payment.amount).toBe(100000);
    expect(payment.status).toBe('pending');
    
    // Optional fields should be null
    expect(payment.midtrans_transaction_id).toBeNull();
    expect(payment.payment_type).toBeNull();
    expect(payment.transaction_time).toBeNull();
    expect(payment.settlement_time).toBeNull();
  });

  it('should handle large amounts correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        nama_perguruan_tinggi: 'Test University',
        nama_kepala_perpustakaan: 'Test Head Librarian',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Test Address',
        provinsi: 'Jawa Timur',
        email_institusi: 'institution@example.com',
        url_website: 'https://example.com',
        url_otomasi: 'https://automation.example.com',
        repository_status: 'Sudah',
        jumlah_koleksi: 1000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create payment with large amount
    const largeAmount = '9999999.99';
    await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: 'ORDER-LARGE',
        amount: largeAmount,
        status: 'paid'
      })
      .execute();

    const result = await getAllPayments();
    
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(9999999.99);
    expect(typeof result[0].amount).toBe('number');
  });
});