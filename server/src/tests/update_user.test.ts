import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';


// Test user data for setup
const testUser = {
  email: 'test@university.ac.id',
  password_hash: '$2b$10$hash', // Mock password hash
  role: 'member' as const,
  nama_perguruan_tinggi: 'Universitas Test',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '08123456789',
  instansi: 'Perpustakaan Test',
  nama_pic: 'Test PIC',
  no_hp_pic: '08987654321',
  alamat_lengkap: 'Jalan Test No. 123, Test City',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'library@university.ac.id',
  url_website: 'https://library.university.ac.id',
  url_otomasi: 'https://opac.university.ac.id',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 50000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const,
  membership_status: 'active' as const
};

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user with all fields', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const updateInput: UpdateUserInput = {
      id: createdUser.id,
      email: 'updated@university.ac.id',
      nama_perguruan_tinggi: 'Updated University',
      nama_kepala_perpustakaan: 'Dr. Updated Kepala',
      no_hp_kepala: '08111111111',
      instansi: 'Updated Perpustakaan',
      nama_pic: 'Updated PIC',
      no_hp_pic: '08222222222',
      alamat_lengkap: 'Updated Address 456',
      provinsi: 'Jawa Barat',
      email_institusi: 'updated@university.ac.id',
      url_website: 'https://updated.university.ac.id',
      url_otomasi: 'https://opac-updated.university.ac.id',
      repository_status: 'Belum',
      jumlah_koleksi: 75000,
      status_akreditasi: 'Akreditasi B',
      jenis_keanggotaan: 'Perpanjangan',
      membership_status: 'pending'
    };

    const result = await updateUser(updateInput);

    // Verify all fields were updated correctly
    expect(result.id).toEqual(createdUser.id);
    expect(result.email).toEqual('updated@university.ac.id');
    expect(result.nama_perguruan_tinggi).toEqual('Updated University');
    expect(result.nama_kepala_perpustakaan).toEqual('Dr. Updated Kepala');
    expect(result.no_hp_kepala).toEqual('08111111111');
    expect(result.instansi).toEqual('Updated Perpustakaan');
    expect(result.nama_pic).toEqual('Updated PIC');
    expect(result.no_hp_pic).toEqual('08222222222');
    expect(result.alamat_lengkap).toEqual('Updated Address 456');
    expect(result.provinsi).toEqual('Jawa Barat');
    expect(result.email_institusi).toEqual('updated@university.ac.id');
    expect(result.url_website).toEqual('https://updated.university.ac.id');
    expect(result.url_otomasi).toEqual('https://opac-updated.university.ac.id');
    expect(result.repository_status).toEqual('Belum');
    expect(result.jumlah_koleksi).toEqual(75000);
    expect(result.status_akreditasi).toEqual('Akreditasi B');
    expect(result.jenis_keanggotaan).toEqual('Perpanjangan');
    expect(result.membership_status).toEqual('pending');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
  });

  it('should update user with partial fields only', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const partialUpdate: UpdateUserInput = {
      id: createdUser.id,
      email: 'partial@university.ac.id',
      nama_perguruan_tinggi: 'Partially Updated University',
      membership_status: 'expired'
    };

    const result = await updateUser(partialUpdate);

    // Verify only specified fields were updated
    expect(result.email).toEqual('partial@university.ac.id');
    expect(result.nama_perguruan_tinggi).toEqual('Partially Updated University');
    expect(result.membership_status).toEqual('expired');
    
    // Verify other fields remained unchanged
    expect(result.nama_kepala_perpustakaan).toEqual(testUser.nama_kepala_perpustakaan);
    expect(result.no_hp_kepala).toEqual(testUser.no_hp_kepala);
    expect(result.instansi).toEqual(testUser.instansi);
    expect(result.provinsi).toEqual(testUser.provinsi);
    expect(result.jumlah_koleksi).toEqual(testUser.jumlah_koleksi);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should persist changes in database', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const updateInput: UpdateUserInput = {
      id: createdUser.id,
      email: 'persisted@university.ac.id',
      membership_status: 'inactive'
    };

    await updateUser(updateInput);

    // Query database directly to verify changes were persisted
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, createdUser.id))
      .execute();

    expect(users).toHaveLength(1);
    const persistedUser = users[0];
    expect(persistedUser.email).toEqual('persisted@university.ac.id');
    expect(persistedUser.membership_status).toEqual('inactive');
    expect(persistedUser.updated_at).toBeInstanceOf(Date);
    expect(persistedUser.updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
  });

  it('should throw error when user not found', async () => {
    const nonExistentId = 99999;
    const updateInput: UpdateUserInput = {
      id: nonExistentId,
      email: 'nonexistent@university.ac.id'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should update only membership status for admin operations', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const adminUpdate: UpdateUserInput = {
      id: createdUser.id,
      membership_status: 'active'
    };

    const result = await updateUser(adminUpdate);

    // Verify only membership status was updated
    expect(result.membership_status).toEqual('active');
    expect(result.email).toEqual(testUser.email); // Should remain unchanged
    expect(result.nama_perguruan_tinggi).toEqual(testUser.nama_perguruan_tinggi); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle enum value updates correctly', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const enumUpdate: UpdateUserInput = {
      id: createdUser.id,
      provinsi: 'Jawa Tengah',
      repository_status: 'Belum',
      status_akreditasi: 'Belum Akreditasi',
      jenis_keanggotaan: 'Perpanjangan'
    };

    const result = await updateUser(enumUpdate);

    // Verify enum fields were updated correctly
    expect(result.provinsi).toEqual('Jawa Tengah');
    expect(result.repository_status).toEqual('Belum');
    expect(result.status_akreditasi).toEqual('Belum Akreditasi');
    expect(result.jenis_keanggotaan).toEqual('Perpanjangan');
  });

  it('should update integer field correctly', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const integerUpdate: UpdateUserInput = {
      id: createdUser.id,
      jumlah_koleksi: 100000
    };

    const result = await updateUser(integerUpdate);

    // Verify integer field was updated correctly
    expect(result.jumlah_koleksi).toEqual(100000);
    expect(typeof result.jumlah_koleksi).toBe('number');
  });

  it('should always update the updated_at timestamp', async () => {
    // Create test user first
    const [createdUser] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const minimalUpdate: UpdateUserInput = {
      id: createdUser.id
      // No other fields - just trigger an update
    };

    const result = await updateUser(minimalUpdate);

    // Verify updated_at timestamp was changed
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
  });
});