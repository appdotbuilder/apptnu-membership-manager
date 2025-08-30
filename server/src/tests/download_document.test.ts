import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, documentsTable } from '../db/schema';
import { type DocumentDownloadInput } from '../schema';
import { downloadDocument } from '../handlers/download_document';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@university.edu',
  password_hash: 'hashed_password',
  nama_perguruan_tinggi: 'Test University',
  nama_kepala_perpustakaan: 'Dr. Test',
  no_hp_kepala: '081234567890',
  instansi: 'Test Institution',
  nama_pic: 'Test PIC',
  no_hp_pic: '081234567891',
  alamat_lengkap: 'Test Address',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'admin@university.edu',
  url_website: 'https://university.edu',
  url_otomasi: 'https://library.university.edu',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 1000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const
};

const testFilePath = join(process.cwd(), 'test-documents', 'test-document.pdf');
const testDir = join(process.cwd(), 'test-documents');

describe('downloadDocument', () => {
  beforeEach(async () => {
    await createDB();
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up test file
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
    // Clean up test directory if empty
    if (existsSync(testDir)) {
      try {
        const files = require('fs').readdirSync(testDir);
        if (files.length === 0) {
          require('fs').rmdirSync(testDir);
        }
      } catch (e) {
        // Directory might not be empty or already removed
      }
    }
    await resetDB();
  });

  it('should download document with valid token', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = users[0].id;

    // Create test file
    writeFileSync(testFilePath, 'Test PDF content');

    // Create test document
    const documents = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'transfer_proof',
        file_name: 'test-document.pdf',
        file_path: testFilePath,
        file_size: 16,
        mime_type: 'application/pdf',
        download_token: 'valid-token-123'
      })
      .returning()
      .execute();

    const input: DocumentDownloadInput = {
      token: 'valid-token-123'
    };

    const result = await downloadDocument(input);

    expect(result.filePath).toEqual(testFilePath);
    expect(result.fileName).toEqual('test-document.pdf');
    expect(result.mimeType).toEqual('application/pdf');
  });

  it('should use default mime type when not specified', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = users[0].id;

    // Create test file
    writeFileSync(testFilePath, 'Test content');

    // Create document without mime type
    const documents = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'receipt',
        file_name: 'document-no-mime.txt',
        file_path: testFilePath,
        download_token: 'token-no-mime'
      })
      .returning()
      .execute();

    const input: DocumentDownloadInput = {
      token: 'token-no-mime'
    };

    const result = await downloadDocument(input);

    expect(result.mimeType).toEqual('application/octet-stream');
    expect(result.fileName).toEqual('document-no-mime.txt');
  });

  it('should throw error for invalid token', async () => {
    const input: DocumentDownloadInput = {
      token: 'invalid-token-xyz'
    };

    await expect(downloadDocument(input)).rejects.toThrow(/invalid or expired download token/i);
  });

  it('should throw error when file does not exist on disk', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = users[0].id;

    const nonExistentPath = join(process.cwd(), 'non-existent-file.pdf');

    // Create document record with non-existent file path
    const documents = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'certificate',
        file_name: 'missing-file.pdf',
        file_path: nonExistentPath,
        download_token: 'token-missing-file'
      })
      .returning()
      .execute();

    const input: DocumentDownloadInput = {
      token: 'token-missing-file'
    };

    await expect(downloadDocument(input)).rejects.toThrow(/document file not found on disk/i);
  });

  it('should handle different document types correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = users[0].id;

    // Create test file
    writeFileSync(testFilePath, 'Certificate content');

    // Create certificate document
    const documents = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'certificate',
        file_name: 'membership-certificate.pdf',
        file_path: testFilePath,
        file_size: 18,
        mime_type: 'application/pdf',
        download_token: 'cert-token-456'
      })
      .returning()
      .execute();

    const input: DocumentDownloadInput = {
      token: 'cert-token-456'
    };

    const result = await downloadDocument(input);

    expect(result.fileName).toEqual('membership-certificate.pdf');
    expect(result.mimeType).toEqual('application/pdf');

    // Verify document exists in database
    const dbDocuments = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.id, documents[0].id))
      .execute();

    expect(dbDocuments).toHaveLength(1);
    expect(dbDocuments[0].document_type).toEqual('certificate');
  });

  it('should handle empty token', async () => {
    const input: DocumentDownloadInput = {
      token: ''
    };

    await expect(downloadDocument(input)).rejects.toThrow(/invalid or expired download token/i);
  });
});