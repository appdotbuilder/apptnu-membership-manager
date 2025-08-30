import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { pbkdf2Sync, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

// Helper function to hash password (same as in handler)
function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Test user data
const testUserData = {
  email: 'test@university.ac.id',
  password: 'testpassword123',
  nama_perguruan_tinggi: 'Test University',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '08123456789',
  instansi: 'Test Institution',
  nama_pic: 'Test PIC',
  no_hp_pic: '08987654321',
  alamat_lengkap: 'Jl. Test No. 123, Test City',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'library@test.ac.id',
  url_website: 'https://test.ac.id',
  url_otomasi: 'https://opac.test.ac.id',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 5000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const,
  role: 'member' as const,
  membership_status: 'active' as const
};

const validLoginInput: LoginInput = {
  email: testUserData.email,
  password: testUserData.password
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully login with valid credentials', async () => {
    // Create test user with hashed password
    const hashedPassword = hashPassword(testUserData.password);
    
    const [insertedUser] = await db.insert(usersTable)
      .values({
        ...testUserData,
        password_hash: hashedPassword
      })
      .returning()
      .execute();

    // Attempt login
    const result = await loginUser(validLoginInput);

    // Verify response structure
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
    
    // Verify user data (should not contain password hash)
    expect(result.user.id).toBe(insertedUser.id);
    expect(result.user.email).toBe(testUserData.email);
    expect(result.user.role).toBe('member');
    expect(result.user.nama_perguruan_tinggi).toBe(testUserData.nama_perguruan_tinggi);
    expect(result.user.membership_status).toBe('active');
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
    
    // Verify password hash is not included
    expect('password_hash' in result.user).toBe(false);

    // Verify JWT token is valid
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should generate valid JWT token with correct payload', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUserData.password);
    
    const [insertedUser] = await db.insert(usersTable)
      .values({
        ...testUserData,
        password_hash: hashedPassword
      })
      .returning()
      .execute();

    // Login
    const result = await loginUser(validLoginInput);

    // Verify JWT token payload
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
    const decodedToken = jwt.verify(result.token, jwtSecret) as any;

    expect(decodedToken.userId).toBe(insertedUser.id);
    expect(decodedToken.role).toBe('member');
    expect(decodedToken.email).toBe(testUserData.email);
    expect(decodedToken.exp).toBeDefined();
    expect(decodedToken.iat).toBeDefined();
  });

  it('should login admin user correctly', async () => {
    // Create admin user
    const adminUserData = {
      ...testUserData,
      email: 'admin@system.com',
      role: 'admin' as const
    };
    
    const hashedPassword = hashPassword(testUserData.password);
    
    await db.insert(usersTable)
      .values({
        ...adminUserData,
        password_hash: hashedPassword
      })
      .execute();

    // Login as admin
    const adminLoginInput: LoginInput = {
      email: adminUserData.email,
      password: testUserData.password
    };

    const result = await loginUser(adminLoginInput);

    expect(result.user.role).toBe('admin');
    expect(result.user.email).toBe(adminUserData.email);

    // Verify JWT token contains admin role
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
    const decodedToken = jwt.verify(result.token, jwtSecret) as any;
    expect(decodedToken.role).toBe('admin');
  });

  it('should throw error for non-existent email', async () => {
    const invalidLoginInput: LoginInput = {
      email: 'nonexistent@test.com',
      password: 'anypassword'
    };

    await expect(loginUser(invalidLoginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for incorrect password', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUserData.password);
    
    await db.insert(usersTable)
      .values({
        ...testUserData,
        password_hash: hashedPassword
      })
      .execute();

    // Try login with wrong password
    const invalidLoginInput: LoginInput = {
      email: testUserData.email,
      password: 'wrongpassword'
    };

    await expect(loginUser(invalidLoginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle empty password correctly', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUserData.password);
    
    await db.insert(usersTable)
      .values({
        ...testUserData,
        password_hash: hashedPassword
      })
      .execute();

    // Try login with empty password
    const invalidLoginInput: LoginInput = {
      email: testUserData.email,
      password: ''
    };

    await expect(loginUser(invalidLoginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle case-sensitive email correctly', async () => {
    // Create test user with lowercase email
    const hashedPassword = hashPassword(testUserData.password);
    
    await db.insert(usersTable)
      .values({
        ...testUserData,
        email: testUserData.email.toLowerCase(),
        password_hash: hashedPassword
      })
      .execute();

    // Try login with uppercase email
    const uppercaseLoginInput: LoginInput = {
      email: testUserData.email.toUpperCase(),
      password: testUserData.password
    };

    // Should fail because email matching is case-sensitive
    await expect(loginUser(uppercaseLoginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should return user with all required fields', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUserData.password);
    
    await db.insert(usersTable)
      .values({
        ...testUserData,
        password_hash: hashedPassword
      })
      .execute();

    const result = await loginUser(validLoginInput);
    const user = result.user;

    // Verify all required user fields are present
    expect(user.id).toBeDefined();
    expect(user.email).toBe(testUserData.email);
    expect(user.role).toBe('member');
    expect(user.nama_perguruan_tinggi).toBe(testUserData.nama_perguruan_tinggi);
    expect(user.nama_kepala_perpustakaan).toBe(testUserData.nama_kepala_perpustakaan);
    expect(user.no_hp_kepala).toBe(testUserData.no_hp_kepala);
    expect(user.instansi).toBe(testUserData.instansi);
    expect(user.nama_pic).toBe(testUserData.nama_pic);
    expect(user.no_hp_pic).toBe(testUserData.no_hp_pic);
    expect(user.alamat_lengkap).toBe(testUserData.alamat_lengkap);
    expect(user.provinsi).toBe(testUserData.provinsi);
    expect(user.email_institusi).toBe(testUserData.email_institusi);
    expect(user.url_website).toBe(testUserData.url_website);
    expect(user.url_otomasi).toBe(testUserData.url_otomasi);
    expect(user.repository_status).toBe(testUserData.repository_status);
    expect(user.jumlah_koleksi).toBe(testUserData.jumlah_koleksi);
    expect(user.status_akreditasi).toBe(testUserData.status_akreditasi);
    expect(user.jenis_keanggotaan).toBe(testUserData.jenis_keanggotaan);
    expect(user.membership_status).toBe(testUserData.membership_status);
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });
});