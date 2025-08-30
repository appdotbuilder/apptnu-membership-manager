import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UserListFilter } from '../schema';
import { getAllUsers } from '../handlers/get_all_users';
import bcrypt from 'bcryptjs';

// Test user data
const createTestUser = async (overrides: Partial<any> = {}) => {
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  
  const defaultUser = {
    email: 'test@example.com',
    password_hash: hashedPassword,
    role: 'member' as const,
    nama_perguruan_tinggi: 'Universitas Test',
    nama_kepala_perpustakaan: 'Dr. Test Librarian',
    no_hp_kepala: '08123456789',
    instansi: 'Test Institution',
    nama_pic: 'Test PIC',
    no_hp_pic: '08987654321',
    alamat_lengkap: 'Jl. Test No. 123, Kota Test',
    provinsi: 'Jawa Timur' as const,
    email_institusi: 'library@test.ac.id',
    url_website: 'https://test.ac.id',
    url_otomasi: 'https://opac.test.ac.id',
    repository_status: 'Belum' as const,
    jumlah_koleksi: 1000,
    status_akreditasi: 'Akreditasi B' as const,
    jenis_keanggotaan: 'Pendaftaran Baru' as const,
    membership_status: 'active' as const,
    ...overrides
  };

  const result = await db.insert(usersTable)
    .values(defaultUser)
    .returning()
    .execute();

  return result[0];
};

describe('getAllUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getAllUsers();
    expect(result).toEqual([]);
  });

  it('should return all users without filters', async () => {
    // Create multiple test users
    await createTestUser({ email: 'user1@test.com' });
    await createTestUser({ 
      email: 'user2@test.com',
      provinsi: 'Jawa Barat',
      membership_status: 'pending'
    });

    const result = await getAllUsers();

    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('user1@test.com');
    expect(result[1].email).toBe('user2@test.com');
    
    // Verify all required fields are present
    expect(result[0].nama_perguruan_tinggi).toBe('Universitas Test');
    expect(result[0].provinsi).toBe('Jawa Timur');
    expect(result[0].membership_status).toBe('active');
    expect(result[0].password_hash).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter by membership_status', async () => {
    await createTestUser({ 
      email: 'active@test.com',
      membership_status: 'active'
    });
    await createTestUser({ 
      email: 'pending@test.com',
      membership_status: 'pending'
    });
    await createTestUser({ 
      email: 'expired@test.com',
      membership_status: 'expired'
    });

    const filter: UserListFilter = {
      membership_status: 'pending'
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('pending@test.com');
    expect(result[0].membership_status).toBe('pending');
  });

  it('should filter by provinsi', async () => {
    await createTestUser({ 
      email: 'jatim@test.com',
      provinsi: 'Jawa Timur'
    });
    await createTestUser({ 
      email: 'jabar@test.com',
      provinsi: 'Jawa Barat'
    });
    await createTestUser({ 
      email: 'jateng@test.com',
      provinsi: 'Jawa Tengah'
    });

    const filter: UserListFilter = {
      provinsi: 'Jawa Barat'
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('jabar@test.com');
    expect(result[0].provinsi).toBe('Jawa Barat');
  });

  it('should filter by jenis_keanggotaan', async () => {
    await createTestUser({ 
      email: 'baru@test.com',
      jenis_keanggotaan: 'Pendaftaran Baru'
    });
    await createTestUser({ 
      email: 'perpanjangan@test.com',
      jenis_keanggotaan: 'Perpanjangan'
    });

    const filter: UserListFilter = {
      jenis_keanggotaan: 'Perpanjangan'
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('perpanjangan@test.com');
    expect(result[0].jenis_keanggotaan).toBe('Perpanjangan');
  });

  it('should filter by multiple conditions', async () => {
    await createTestUser({ 
      email: 'match@test.com',
      provinsi: 'Jawa Timur',
      membership_status: 'active',
      jenis_keanggotaan: 'Pendaftaran Baru'
    });
    await createTestUser({ 
      email: 'nomatch1@test.com',
      provinsi: 'Jawa Barat',
      membership_status: 'active',
      jenis_keanggotaan: 'Pendaftaran Baru'
    });
    await createTestUser({ 
      email: 'nomatch2@test.com',
      provinsi: 'Jawa Timur',
      membership_status: 'pending',
      jenis_keanggotaan: 'Pendaftaran Baru'
    });

    const filter: UserListFilter = {
      provinsi: 'Jawa Timur',
      membership_status: 'active',
      jenis_keanggotaan: 'Pendaftaran Baru'
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('match@test.com');
    expect(result[0].provinsi).toBe('Jawa Timur');
    expect(result[0].membership_status).toBe('active');
    expect(result[0].jenis_keanggotaan).toBe('Pendaftaran Baru');
  });

  it('should support pagination with limit', async () => {
    // Create 5 users
    for (let i = 1; i <= 5; i++) {
      await createTestUser({ email: `user${i}@test.com` });
    }

    const filter: UserListFilter = {
      limit: 3
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(3);
  });

  it('should support pagination with offset', async () => {
    // Create users with predictable ordering
    await createTestUser({ email: 'user1@test.com' });
    await createTestUser({ email: 'user2@test.com' });
    await createTestUser({ email: 'user3@test.com' });

    const filter: UserListFilter = {
      limit: 2,
      offset: 1
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(2);
    // Should skip the first user due to offset - verify we got 2 users
    const allUsers = await getAllUsers();
    expect(allUsers).toHaveLength(3);
  });

  it('should combine filters with pagination', async () => {
    // Create multiple users with different statuses
    await createTestUser({ 
      email: 'active1@test.com',
      membership_status: 'active'
    });
    await createTestUser({ 
      email: 'active2@test.com',
      membership_status: 'active'
    });
    await createTestUser({ 
      email: 'active3@test.com',
      membership_status: 'active'
    });
    await createTestUser({ 
      email: 'pending@test.com',
      membership_status: 'pending'
    });

    const filter: UserListFilter = {
      membership_status: 'active',
      limit: 2
    };

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(2);
    result.forEach(user => {
      expect(user.membership_status).toBe('active');
      expect(user.email).toMatch(/active\d@test\.com/);
    });
  });

  it('should return empty array when filters match no users', async () => {
    await createTestUser({ 
      email: 'user@test.com',
      provinsi: 'Jawa Timur',
      membership_status: 'active'
    });

    const filter: UserListFilter = {
      provinsi: 'Jawa Barat',
      membership_status: 'expired'
    };

    const result = await getAllUsers(filter);

    expect(result).toEqual([]);
  });

  it('should handle edge case with zero limit', async () => {
    await createTestUser({ email: 'user@test.com' });

    const filter: UserListFilter = {
      limit: 0
    };

    const result = await getAllUsers(filter);

    expect(result).toEqual([]);
  });

  it('should return all users when filter is provided but empty', async () => {
    await createTestUser({ email: 'user1@test.com' });
    await createTestUser({ email: 'user2@test.com' });

    const filter: UserListFilter = {};

    const result = await getAllUsers(filter);

    expect(result).toHaveLength(2);
  });
});