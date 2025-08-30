import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, paymentsTable, documentsTable } from '../db/schema';
import { deleteUser } from '../handlers/delete_user';
import { eq } from 'drizzle-orm';

describe('deleteUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a user successfully', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@university.edu',
        password_hash: 'hashed_password',
        nama_perguruan_tinggi: 'Test University',
        nama_kepala_perpustakaan: 'Dr. Test',
        no_hp_kepala: '081234567890',
        instansi: 'Test Institution',
        nama_pic: 'Test PIC',
        no_hp_pic: '081234567891',
        alamat_lengkap: 'Test Address',
        provinsi: 'Jawa Timur',
        email_institusi: 'admin@university.edu',
        url_website: 'https://test.university.edu',
        url_otomasi: 'https://library.university.edu',
        repository_status: 'Sudah',
        jumlah_koleksi: 10000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Delete the user
    const result = await deleteUser(userId);

    expect(result.success).toBe(true);

    // Verify user is deleted from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(0);
  });

  it('should cascade delete related payments and documents', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'cascade@university.edu',
        password_hash: 'hashed_password',
        nama_perguruan_tinggi: 'Cascade University',
        nama_kepala_perpustakaan: 'Dr. Cascade',
        no_hp_kepala: '081234567892',
        instansi: 'Cascade Institution',
        nama_pic: 'Cascade PIC',
        no_hp_pic: '081234567893',
        alamat_lengkap: 'Cascade Address',
        provinsi: 'Jawa Barat',
        email_institusi: 'admin@cascade.edu',
        url_website: 'https://cascade.university.edu',
        url_otomasi: 'https://library.cascade.edu',
        repository_status: 'Belum',
        jumlah_koleksi: 5000,
        status_akreditasi: 'Akreditasi B',
        jenis_keanggotaan: 'Perpanjangan'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create related payment
    await db.insert(paymentsTable)
      .values({
        user_id: userId,
        midtrans_order_id: `ORDER-${userId}-001`,
        amount: '250000.00',
        status: 'paid'
      })
      .execute();

    // Create related document
    await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'transfer_proof',
        file_name: 'transfer_proof.pdf',
        file_path: '/uploads/transfer_proof.pdf'
      })
      .execute();

    // Verify data exists before deletion
    const paymentsBefore = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.user_id, userId))
      .execute();

    const documentsBefore = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.user_id, userId))
      .execute();

    expect(paymentsBefore).toHaveLength(1);
    expect(documentsBefore).toHaveLength(1);

    // Delete the user
    const result = await deleteUser(userId);

    expect(result.success).toBe(true);

    // Verify cascade deletion of related records
    const paymentsAfter = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.user_id, userId))
      .execute();

    const documentsAfter = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.user_id, userId))
      .execute();

    expect(paymentsAfter).toHaveLength(0);
    expect(documentsAfter).toHaveLength(0);
  });

  it('should throw error when user does not exist', async () => {
    const nonExistentUserId = 99999;

    await expect(deleteUser(nonExistentUserId))
      .rejects
      .toThrow(/User with ID 99999 not found/i);
  });

  it('should handle multiple related records deletion', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'multi@university.edu',
        password_hash: 'hashed_password',
        nama_perguruan_tinggi: 'Multi University',
        nama_kepala_perpustakaan: 'Dr. Multi',
        no_hp_kepala: '081234567894',
        instansi: 'Multi Institution',
        nama_pic: 'Multi PIC',
        no_hp_pic: '081234567895',
        alamat_lengkap: 'Multi Address',
        provinsi: 'Jawa Tengah',
        email_institusi: 'admin@multi.edu',
        url_website: 'https://multi.university.edu',
        url_otomasi: 'https://library.multi.edu',
        repository_status: 'Sudah',
        jumlah_koleksi: 15000,
        status_akreditasi: 'Belum Akreditasi',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple payments
    await db.insert(paymentsTable)
      .values([
        {
          user_id: userId,
          midtrans_order_id: `ORDER-${userId}-001`,
          amount: '250000.00',
          status: 'paid'
        },
        {
          user_id: userId,
          midtrans_order_id: `ORDER-${userId}-002`,
          amount: '300000.00',
          status: 'pending'
        }
      ])
      .execute();

    // Create multiple documents
    await db.insert(documentsTable)
      .values([
        {
          user_id: userId,
          document_type: 'transfer_proof',
          file_name: 'transfer1.pdf',
          file_path: '/uploads/transfer1.pdf'
        },
        {
          user_id: userId,
          document_type: 'receipt',
          file_name: 'receipt1.pdf',
          file_path: '/uploads/receipt1.pdf'
        },
        {
          user_id: userId,
          document_type: 'certificate',
          file_name: 'cert1.pdf',
          file_path: '/uploads/cert1.pdf'
        }
      ])
      .execute();

    // Delete the user
    const result = await deleteUser(userId);

    expect(result.success).toBe(true);

    // Verify all related records are deleted
    const paymentsAfter = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.user_id, userId))
      .execute();

    const documentsAfter = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.user_id, userId))
      .execute();

    expect(paymentsAfter).toHaveLength(0);
    expect(documentsAfter).toHaveLength(0);
  });

  it('should not affect other users when deleting one user', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@university.edu',
        password_hash: 'hashed_password1',
        nama_perguruan_tinggi: 'University One',
        nama_kepala_perpustakaan: 'Dr. One',
        no_hp_kepala: '081234567896',
        instansi: 'Institution One',
        nama_pic: 'PIC One',
        no_hp_pic: '081234567897',
        alamat_lengkap: 'Address One',
        provinsi: 'Jawa Timur',
        email_institusi: 'admin@one.edu',
        url_website: 'https://one.university.edu',
        url_otomasi: 'https://library.one.edu',
        repository_status: 'Sudah',
        jumlah_koleksi: 10000,
        status_akreditasi: 'Akreditasi A',
        jenis_keanggotaan: 'Pendaftaran Baru'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@university.edu',
        password_hash: 'hashed_password2',
        nama_perguruan_tinggi: 'University Two',
        nama_kepala_perpustakaan: 'Dr. Two',
        no_hp_kepala: '081234567898',
        instansi: 'Institution Two',
        nama_pic: 'PIC Two',
        no_hp_pic: '081234567899',
        alamat_lengkap: 'Address Two',
        provinsi: 'Jawa Barat',
        email_institusi: 'admin@two.edu',
        url_website: 'https://two.university.edu',
        url_otomasi: 'https://library.two.edu',
        repository_status: 'Belum',
        jumlah_koleksi: 8000,
        status_akreditasi: 'Akreditasi B',
        jenis_keanggotaan: 'Perpanjangan'
      })
      .returning()
      .execute();

    const userId1 = user1Result[0].id;
    const userId2 = user2Result[0].id;

    // Create payments for both users
    await db.insert(paymentsTable)
      .values([
        {
          user_id: userId1,
          midtrans_order_id: `ORDER-${userId1}-001`,
          amount: '250000.00',
          status: 'paid'
        },
        {
          user_id: userId2,
          midtrans_order_id: `ORDER-${userId2}-001`,
          amount: '300000.00',
          status: 'pending'
        }
      ])
      .execute();

    // Delete only user1
    const result = await deleteUser(userId1);

    expect(result.success).toBe(true);

    // Verify user1 is deleted but user2 remains
    const user1After = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId1))
      .execute();

    const user2After = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId2))
      .execute();

    expect(user1After).toHaveLength(0);
    expect(user2After).toHaveLength(1);
    expect(user2After[0].email).toBe('user2@university.edu');

    // Verify user2's payment remains
    const user2Payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.user_id, userId2))
      .execute();

    expect(user2Payments).toHaveLength(1);
    expect(parseFloat(user2Payments[0].amount)).toBe(300000.00);
  });
});