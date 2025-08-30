import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUserProfile } from '../handlers/get_user_profile';

// Test user data
const testUserData = {
  email: 'test@university.edu',
  password_hash: 'hashed_password_123',
  role: 'member' as const,
  nama_perguruan_tinggi: 'Universitas Test Indonesia',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '081234567890',
  instansi: 'Perpustakaan Universitas Test',
  nama_pic: 'Test PIC',
  no_hp_pic: '081234567891',
  alamat_lengkap: 'Jl. Test No. 123, Jakarta',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'library@test.edu',
  url_website: 'https://library.test.edu',
  url_otomasi: 'https://opac.test.edu',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 50000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Perpanjangan' as const,
  membership_status: 'active' as const
};

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile for existing user', async () => {
    // Create test user
    const insertResult = await db.insert(usersTable)
      .values(testUserData)
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const userId = createdUser.id;

    // Get user profile
    const result = await getUserProfile(userId);

    // Verify all fields are returned correctly
    expect(result.id).toBe(userId);
    expect(result.email).toBe('test@university.edu');
    expect(result.password_hash).toBe('hashed_password_123');
    expect(result.role).toBe('member');
    expect(result.nama_perguruan_tinggi).toBe('Universitas Test Indonesia');
    expect(result.nama_kepala_perpustakaan).toBe('Dr. Test Kepala');
    expect(result.no_hp_kepala).toBe('081234567890');
    expect(result.instansi).toBe('Perpustakaan Universitas Test');
    expect(result.nama_pic).toBe('Test PIC');
    expect(result.no_hp_pic).toBe('081234567891');
    expect(result.alamat_lengkap).toBe('Jl. Test No. 123, Jakarta');
    expect(result.provinsi).toBe('Jawa Timur');
    expect(result.email_institusi).toBe('library@test.edu');
    expect(result.url_website).toBe('https://library.test.edu');
    expect(result.url_otomasi).toBe('https://opac.test.edu');
    expect(result.repository_status).toBe('Sudah');
    expect(result.jumlah_koleksi).toBe(50000);
    expect(typeof result.jumlah_koleksi).toBe('number');
    expect(result.status_akreditasi).toBe('Akreditasi A');
    expect(result.jenis_keanggotaan).toBe('Perpanjangan');
    expect(result.membership_status).toBe('active');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 99999;

    await expect(getUserProfile(nonExistentUserId))
      .rejects
      .toThrow(/User with ID 99999 not found/i);
  });

  it('should return user with default membership status', async () => {
    // Create user without explicitly setting membership_status (should use default 'pending')
    const userWithDefaults = {
      ...testUserData,
      membership_status: undefined // This will use the database default
    };

    const insertResult = await db.insert(usersTable)
      .values({
        ...userWithDefaults,
        membership_status: 'pending' // Explicitly set the default for test
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const result = await getUserProfile(createdUser.id);

    expect(result.membership_status).toBe('pending');
    expect(result.role).toBe('member'); // Should also have default role
  });

  it('should return user with admin role', async () => {
    // Create admin user
    const adminUserData = {
      ...testUserData,
      email: 'admin@test.edu',
      role: 'admin' as const,
      membership_status: 'active' as const
    };

    const insertResult = await db.insert(usersTable)
      .values(adminUserData)
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const result = await getUserProfile(createdUser.id);

    expect(result.role).toBe('admin');
    expect(result.email).toBe('admin@test.edu');
    expect(result.membership_status).toBe('active');
  });

  it('should return user with different provinsi options', async () => {
    // Test with different provinsi
    const jabarUserData = {
      ...testUserData,
      email: 'jabar@test.edu',
      provinsi: 'Jawa Barat' as const
    };

    const insertResult = await db.insert(usersTable)
      .values(jabarUserData)
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const result = await getUserProfile(createdUser.id);

    expect(result.provinsi).toBe('Jawa Barat');
  });

  it('should handle user with all enum variations', async () => {
    // Create user with different enum values
    const enumTestUserData = {
      ...testUserData,
      email: 'enum@test.edu',
      provinsi: 'Jawa Tengah' as const,
      repository_status: 'Belum' as const,
      status_akreditasi: 'Belum Akreditasi' as const,
      jenis_keanggotaan: 'Pendaftaran Baru' as const,
      membership_status: 'expired' as const
    };

    const insertResult = await db.insert(usersTable)
      .values(enumTestUserData)
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const result = await getUserProfile(createdUser.id);

    expect(result.provinsi).toBe('Jawa Tengah');
    expect(result.repository_status).toBe('Belum');
    expect(result.status_akreditasi).toBe('Belum Akreditasi');
    expect(result.jenis_keanggotaan).toBe('Pendaftaran Baru');
    expect(result.membership_status).toBe('expired');
  });
});