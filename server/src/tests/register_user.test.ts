import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegistrationInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: RegistrationInput = {
  email: 'test@university.edu',
  password: 'securepassword123',
  nama_perguruan_tinggi: 'Universitas Test',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '081234567890',
  instansi: 'Perpustakaan Universitas Test',
  nama_pic: 'Test PIC',
  no_hp_pic: '089876543210',
  alamat_lengkap: 'Jl. Test No. 123, Kota Test',
  provinsi: 'Jawa Timur',
  email_institusi: 'library@university.edu',
  url_website: 'https://university.edu',
  url_otomasi: 'https://library.university.edu',
  repository_status: 'Sudah',
  jumlah_koleksi: 10000,
  status_akreditasi: 'Akreditasi A',
  jenis_keanggotaan: 'Pendaftaran Baru'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testInput);

    // Verify all basic fields are correctly set
    expect(result.email).toEqual(testInput.email);
    expect(result.role).toEqual('member');
    expect(result.nama_perguruan_tinggi).toEqual(testInput.nama_perguruan_tinggi);
    expect(result.nama_kepala_perpustakaan).toEqual(testInput.nama_kepala_perpustakaan);
    expect(result.no_hp_kepala).toEqual(testInput.no_hp_kepala);
    expect(result.instansi).toEqual(testInput.instansi);
    expect(result.nama_pic).toEqual(testInput.nama_pic);
    expect(result.no_hp_pic).toEqual(testInput.no_hp_pic);
    expect(result.alamat_lengkap).toEqual(testInput.alamat_lengkap);
    expect(result.provinsi).toEqual(testInput.provinsi);
    expect(result.email_institusi).toEqual(testInput.email_institusi);
    expect(result.url_website).toEqual(testInput.url_website);
    expect(result.url_otomasi).toEqual(testInput.url_otomasi);
    expect(result.repository_status).toEqual(testInput.repository_status);
    expect(result.jumlah_koleksi).toEqual(testInput.jumlah_koleksi);
    expect(result.status_akreditasi).toEqual(testInput.status_akreditasi);
    expect(result.jenis_keanggotaan).toEqual(testInput.jenis_keanggotaan);

    // Verify default values
    expect(result.membership_status).toEqual('pending');
    expect(result.role).toEqual('member');

    // Verify generated fields
    expect(result.id).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual(testInput.password); // Should be hashed
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database correctly', async () => {
    const result = await registerUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];

    expect(savedUser.email).toEqual(testInput.email);
    expect(savedUser.nama_perguruan_tinggi).toEqual(testInput.nama_perguruan_tinggi);
    expect(savedUser.membership_status).toEqual('pending');
    expect(savedUser.role).toEqual('member');
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should hash the password correctly', async () => {
    const result = await registerUser(testInput);

    // Password should be hashed, not stored as plain text
    expect(result.password_hash).not.toEqual(testInput.password);
    expect(result.password_hash.length).toBeGreaterThan(testInput.password.length);

    // Verify the hashed password can be verified using Bun's password verification
    const isValid = await Bun.password.verify(testInput.password, result.password_hash);
    expect(isValid).toBe(true);

    // Verify wrong password fails verification
    const isInvalid = await Bun.password.verify('wrongpassword', result.password_hash);
    expect(isInvalid).toBe(false);
  });

  it('should prevent duplicate email registration', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register another user with same email
    const duplicateInput = {
      ...testInput,
      nama_perguruan_tinggi: 'Different University'
    };

    await expect(registerUser(duplicateInput)).rejects.toThrow(/already exists/i);
  });

  it('should handle different enum values correctly', async () => {
    const inputWithDifferentEnums: RegistrationInput = {
      ...testInput,
      provinsi: 'Jawa Barat',
      repository_status: 'Belum',
      status_akreditasi: 'Belum Akreditasi',
      jenis_keanggotaan: 'Perpanjangan'
    };

    const result = await registerUser(inputWithDifferentEnums);

    expect(result.provinsi).toEqual('Jawa Barat');
    expect(result.repository_status).toEqual('Belum');
    expect(result.status_akreditasi).toEqual('Belum Akreditasi');
    expect(result.jenis_keanggotaan).toEqual('Perpanjangan');
  });

  it('should handle edge case values correctly', async () => {
    const edgeCaseInput: RegistrationInput = {
      ...testInput,
      jumlah_koleksi: 0, // Minimum allowed value
      email: 'edge-case+test@example.co.id', // Complex email format
      no_hp_kepala: '021-1234-5678', // Phone with dashes
      no_hp_pic: '+62-812-3456-7890' // Phone with country code
    };

    const result = await registerUser(edgeCaseInput);

    expect(result.jumlah_koleksi).toEqual(0);
    expect(result.email).toEqual(edgeCaseInput.email);
    expect(result.no_hp_kepala).toEqual(edgeCaseInput.no_hp_kepala);
    expect(result.no_hp_pic).toEqual(edgeCaseInput.no_hp_pic);
  });

  it('should create user with proper timestamps', async () => {
    const beforeRegistration = new Date();
    const result = await registerUser(testInput);
    const afterRegistration = new Date();

    // Timestamps should be within reasonable range
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterRegistration.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterRegistration.getTime());

    // Initially, created_at and updated_at should be very close
    const timeDiff = Math.abs(result.updated_at.getTime() - result.created_at.getTime());
    expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
  });
});