import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, paymentsTable, documentsTable } from '../db/schema';
import { generateReceiptPdf } from '../handlers/generate_receipt_pdf';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { join } from 'path';


describe('generateReceiptPdf', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPaymentId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@university.edu',
        password_hash: 'hashed_password_123',
        role: 'member',
        nama_perguruan_tinggi: 'Universitas Test',
        nama_kepala_perpustakaan: 'Dr. Test Head',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Jl. Test No. 123, Test City',
        provinsi: 'Jawa Timur',
        email_institusi: 'library@university.edu',
        url_website: 'https://university.edu',
        url_otomasi: 'https://library.university.edu',
        repository_status: 'Sudah',
        jumlah_koleksi: 10000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru',
        membership_status: 'active'
      })
      .returning()
      .execute();

    testUserId = userResult[0].id;

    // Create test payment
    const paymentResult = await db.insert(paymentsTable)
      .values({
        user_id: testUserId,
        midtrans_order_id: 'ORDER_TEST_123',
        midtrans_transaction_id: 'TXN_TEST_123',
        amount: '500000.00', // Convert to string for numeric column
        status: 'paid',
        payment_type: 'bank_transfer',
        transaction_time: new Date('2024-01-15T10:30:00Z'),
        settlement_time: new Date('2024-01-15T10:35:00Z')
      })
      .returning()
      .execute();

    testPaymentId = paymentResult[0].id;
  });

  it('should generate PDF receipt successfully', async () => {
    const result = await generateReceiptPdf(testUserId, testPaymentId);

    // Verify document metadata
    expect(result.user_id).toEqual(testUserId);
    expect(result.document_type).toEqual('receipt');
    expect(result.file_name).toMatch(/^receipt_\d+_\d+_\d+\.pdf$/);
    expect(result.file_path).toMatch(/^\/documents\/receipts\/receipt_\d+_\d+_\d+\.pdf$/);
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.download_token).toBeDefined();
    expect(result.file_size).toBeGreaterThan(0);
    expect(typeof result.file_size).toBe('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create document record in database', async () => {
    const result = await generateReceiptPdf(testUserId, testPaymentId);

    // Verify document was saved to database
    const documents = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.id, result.id))
      .execute();

    expect(documents).toHaveLength(1);
    const document = documents[0];
    
    expect(document.user_id).toEqual(testUserId);
    expect(document.document_type).toEqual('receipt');
    expect(document.file_name).toEqual(result.file_name);
    expect(document.file_path).toEqual(result.file_path);
    expect(document.mime_type).toEqual('application/pdf');
    expect(document.download_token).toEqual(result.download_token);
    expect(document.file_size).toEqual(result.file_size);
  });

  it('should create physical PDF file', async () => {
    const result = await generateReceiptPdf(testUserId, testPaymentId);

    // Extract filename from file path
    const fileName = result.file_name;
    const filePath = join(process.cwd(), 'uploads', 'receipts', fileName);

    // Verify file exists
    expect(existsSync(filePath)).toBe(true);
  });

  it('should generate unique filenames for multiple receipts', async () => {
    const result1 = await generateReceiptPdf(testUserId, testPaymentId);
    
    // Wait a millisecond to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const result2 = await generateReceiptPdf(testUserId, testPaymentId);

    expect(result1.file_name).not.toEqual(result2.file_name);
    expect(result1.download_token).not.toEqual(result2.download_token);
  });

  it('should generate unique download tokens', async () => {
    const result1 = await generateReceiptPdf(testUserId, testPaymentId);
    const result2 = await generateReceiptPdf(testUserId, testPaymentId);

    expect(result1.download_token).not.toEqual(result2.download_token);
    expect(result1.download_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result2.download_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should fail for non-existent payment', async () => {
    const nonExistentPaymentId = 99999;

    await expect(generateReceiptPdf(testUserId, nonExistentPaymentId))
      .rejects.toThrow(/payment not found or not paid/i);
  });

  it('should fail for payment belonging to different user', async () => {
    // Create another user
    const anotherUserResult = await db.insert(usersTable)
      .values({
        email: 'another@university.edu',
        password_hash: 'hashed_password_456',
        role: 'member',
        nama_perguruan_tinggi: 'Another University',
        nama_kepala_perpustakaan: 'Dr. Another Head',
        no_hp_kepala: '081234567892',
        instansi: 'Another Institution',
        nama_pic: 'Another PIC',
        no_hp_pic: '081234567893',
        alamat_lengkap: 'Jl. Another No. 456, Another City',
        provinsi: 'Jawa Barat',
        email_institusi: 'library@another.edu',
        url_website: 'https://another.edu',
        url_otomasi: 'https://library.another.edu',
        repository_status: 'Belum',
        jumlah_koleksi: 5000,
        status_akreditasi: 'Akreditasi B',
        jenis_keanggotaan: 'Perpanjangan',
        membership_status: 'pending'
      })
      .returning()
      .execute();

    const anotherUserId = anotherUserResult[0].id;

    await expect(generateReceiptPdf(anotherUserId, testPaymentId))
      .rejects.toThrow(/payment not found or not paid/i);
  });

  it('should fail for unpaid payment', async () => {
    // Create unpaid payment
    const unpaidPaymentResult = await db.insert(paymentsTable)
      .values({
        user_id: testUserId,
        midtrans_order_id: 'ORDER_UNPAID_123',
        amount: '300000.00', // Convert to string for numeric column
        status: 'pending',
        payment_type: null,
        transaction_time: null,
        settlement_time: null
      })
      .returning()
      .execute();

    const unpaidPaymentId = unpaidPaymentResult[0].id;

    await expect(generateReceiptPdf(testUserId, unpaidPaymentId))
      .rejects.toThrow(/payment not found or not paid/i);
  });

  it('should handle different payment amounts correctly', async () => {
    // Create payment with different amount
    const largePaymentResult = await db.insert(paymentsTable)
      .values({
        user_id: testUserId,
        midtrans_order_id: 'ORDER_LARGE_123',
        midtrans_transaction_id: 'TXN_LARGE_123',
        amount: '1500000.50', // Convert to string for numeric column
        status: 'paid',
        payment_type: 'credit_card',
        transaction_time: new Date(),
        settlement_time: new Date()
      })
      .returning()
      .execute();

    const largePaymentId = largePaymentResult[0].id;

    const result = await generateReceiptPdf(testUserId, largePaymentId);

    expect(result.user_id).toEqual(testUserId);
    expect(result.document_type).toEqual('receipt');
    expect(result.file_size).toBeGreaterThan(0);
  });

  it('should handle null settlement_time gracefully', async () => {
    // Create payment with null settlement_time
    const nullTimePaymentResult = await db.insert(paymentsTable)
      .values({
        user_id: testUserId,
        midtrans_order_id: 'ORDER_NULL_TIME_123',
        midtrans_transaction_id: 'TXN_NULL_TIME_123',
        amount: '250000.00', // Convert to string for numeric column
        status: 'paid',
        payment_type: 'e_wallet',
        transaction_time: new Date(),
        settlement_time: null
      })
      .returning()
      .execute();

    const nullTimePaymentId = nullTimePaymentResult[0].id;

    const result = await generateReceiptPdf(testUserId, nullTimePaymentId);

    expect(result.user_id).toEqual(testUserId);
    expect(result.document_type).toEqual('receipt');
    expect(result.file_size).toBeGreaterThan(0);
  });
});