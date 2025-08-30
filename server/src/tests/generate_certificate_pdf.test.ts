import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, documentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateCertificatePdf } from '../handlers/generate_certificate_pdf';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test user data
const testUser = {
  email: 'test@university.edu',
  password_hash: 'hashedpassword123',
  role: 'member' as const,
  nama_perguruan_tinggi: 'Universitas Test',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '081234567890',
  instansi: 'Perpustakaan Universitas Test',
  nama_pic: 'Test PIC',
  no_hp_pic: '081234567891',
  alamat_lengkap: 'Jl. Test No. 123, Test City',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'perpus@university.edu',
  url_website: 'https://library.university.edu',
  url_otomasi: 'https://opac.university.edu',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 50000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const,
  membership_status: 'active' as const
};

describe('generateCertificatePdf', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate certificate PDF for valid user', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await generateCertificatePdf(userId);

    // Verify document metadata
    expect(result.user_id).toEqual(userId);
    expect(result.document_type).toEqual('certificate');
    expect(result.file_name).toMatch(/^certificate_\d+_\d+\.pdf$/);
    expect(result.file_path).toMatch(/^\/documents\/certificates\/certificate_\d+_\d+\.pdf$/);
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.file_size).toBeGreaterThan(0);
    expect(typeof result.file_size).toBe('number');
    expect(result.download_token).toMatch(/^token_\d+_[a-f0-9]{32}$/);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save document record to database', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await generateCertificatePdf(userId);

    // Verify document was saved to database
    const documents = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.id, result.id))
      .execute();

    expect(documents).toHaveLength(1);
    const document = documents[0];
    expect(document.user_id).toEqual(userId);
    expect(document.document_type).toEqual('certificate');
    expect(document.file_name).toEqual(result.file_name);
    expect(document.file_path).toEqual(result.file_path);
    expect(document.mime_type).toEqual('application/pdf');
    expect(document.file_size).toEqual(result.file_size);
    expect(document.download_token).toEqual(result.download_token);
  });

  it('should create physical PDF file', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await generateCertificatePdf(userId);

    // Verify file was created
    const filePath = path.join(process.cwd(), 'storage', result.file_path);
    
    // Check file exists
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Check file content
    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toContain('%PDF-1.4');
    expect(fileContent).toContain('CERTIFICATE OF MEMBERSHIP');
    expect(fileContent).toContain(testUser.nama_perguruan_tinggi);
    expect(fileContent).toContain(testUser.nama_kepala_perpustakaan);
    expect(fileContent).toContain(testUser.provinsi);
    expect(fileContent).toContain(testUser.jenis_keanggotaan);
    expect(fileContent).toContain(testUser.membership_status);

    // Cleanup test file
    await fs.unlink(filePath).catch(() => {});
  });

  it('should include user institution details in certificate', async () => {
    // Create test user with specific details
    const customUser = {
      ...testUser,
      nama_perguruan_tinggi: 'Universitas Islam Negeri Sunan Kalijaga',
      nama_kepala_perpustakaan: 'Prof. Dr. Ahmad Librarian',
      provinsi: 'Jawa Tengah' as const,
      jenis_keanggotaan: 'Perpanjangan' as const,
      membership_status: 'active' as const
    };

    const userResult = await db.insert(usersTable)
      .values(customUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await generateCertificatePdf(userId);

    // Read the generated file
    const filePath = path.join(process.cwd(), 'storage', result.file_path);
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Verify custom user details are included
    expect(fileContent).toContain('Universitas Islam Negeri Sunan Kalijaga');
    expect(fileContent).toContain('Prof. Dr. Ahmad Librarian');
    expect(fileContent).toContain('Jawa Tengah');
    expect(fileContent).toContain('Perpanjangan');

    // Cleanup test file
    await fs.unlink(filePath).catch(() => {});
  });

  it('should generate unique filenames for different users', async () => {
    // Create two test users
    const userResult1 = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userResult2 = await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'test2@university.edu',
        email_institusi: 'perpus2@university.edu'
      })
      .returning()
      .execute();

    const userId1 = userResult1[0].id;
    const userId2 = userResult2[0].id;

    const result1 = await generateCertificatePdf(userId1);
    const result2 = await generateCertificatePdf(userId2);

    // Verify filenames are different
    expect(result1.file_name).not.toEqual(result2.file_name);
    expect(result1.file_path).not.toEqual(result2.file_path);
    expect(result1.download_token).not.toEqual(result2.download_token);

    // Cleanup test files
    const filePath1 = path.join(process.cwd(), 'storage', result1.file_path);
    const filePath2 = path.join(process.cwd(), 'storage', result2.file_path);
    await fs.unlink(filePath1).catch(() => {});
    await fs.unlink(filePath2).catch(() => {});
  });

  it('should generate unique download tokens', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Generate multiple certificates for the same user
    const result1 = await generateCertificatePdf(userId);
    const result2 = await generateCertificatePdf(userId);

    // Verify tokens are unique
    expect(result1.download_token).not.toEqual(result2.download_token);
    expect(result1.download_token).toMatch(/^token_\d+_[a-f0-9]{32}$/);
    expect(result2.download_token).toMatch(/^token_\d+_[a-f0-9]{32}$/);

    // Cleanup test files
    const filePath1 = path.join(process.cwd(), 'storage', result1.file_path);
    const filePath2 = path.join(process.cwd(), 'storage', result2.file_path);
    await fs.unlink(filePath1).catch(() => {});
    await fs.unlink(filePath2).catch(() => {});
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 99999;

    await expect(generateCertificatePdf(nonExistentUserId))
      .rejects
      .toThrow(/User with ID 99999 not found/i);
  });

  it('should validate file size is calculated correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await generateCertificatePdf(userId);

    // Get actual file size
    const filePath = path.join(process.cwd(), 'storage', result.file_path);
    const stats = await fs.stat(filePath);
    
    // Verify file size matches database record
    expect(result.file_size).toEqual(stats.size);
    expect(result.file_size).toBeGreaterThan(500); // Should be a reasonable PDF size

    // Cleanup test file
    await fs.unlink(filePath).catch(() => {});
  });

  it('should create directories if they do not exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Ensure directory doesn't exist by trying to remove it
    const documentsDir = path.join(process.cwd(), 'storage', 'documents', 'certificates');
    await fs.rmdir(documentsDir, { recursive: true }).catch(() => {});

    // Generate certificate - should create directory
    const result = await generateCertificatePdf(userId);

    // Verify directory was created and file exists
    const filePath = path.join(process.cwd(), 'storage', result.file_path);
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Cleanup test file
    await fs.unlink(filePath).catch(() => {});
  });
});