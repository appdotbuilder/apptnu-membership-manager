import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, documentsTable } from '../db/schema';
import { type FileUploadInput } from '../schema';
import { uploadDocument } from '../handlers/upload_document';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Create test user data
const testUser = {
  email: 'test@university.edu',
  password_hash: bcrypt.hashSync('password123', 10),
  role: 'member' as const,
  nama_perguruan_tinggi: 'Universitas Test',
  nama_kepala_perpustakaan: 'Dr. Test Kepala',
  no_hp_kepala: '08123456789',
  instansi: 'Perpustakaan Universitas Test',
  nama_pic: 'Test PIC',
  no_hp_pic: '08123456788',
  alamat_lengkap: 'Jl. Test No. 123, Kota Test',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'library@university.edu',
  url_website: 'https://university.edu',
  url_otomasi: 'https://opac.university.edu',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 10000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const,
  membership_status: 'pending' as const
};

// Test input for document upload
const testInput: FileUploadInput = {
  user_id: 1,
  document_type: 'transfer_proof',
  file_name: 'transfer_proof.pdf',
  file_path: '/uploads/transfer_proof_123.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf'
};

describe('uploadDocument', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should upload document successfully', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const testInputWithUserId = {
      ...testInput,
      user_id: userResult[0].id
    };

    const result = await uploadDocument(testInputWithUserId);

    // Verify document fields
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.document_type).toEqual('transfer_proof');
    expect(result.file_name).toEqual('transfer_proof.pdf');
    expect(result.file_path).toEqual('/uploads/transfer_proof_123.pdf');
    expect(result.file_size).toEqual(1024000);
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.download_token).toBeDefined();
    expect(result.download_token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save document to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const testInputWithUserId = {
      ...testInput,
      user_id: userResult[0].id
    };

    const result = await uploadDocument(testInputWithUserId);

    // Query document from database
    const documents = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.id, result.id))
      .execute();

    expect(documents).toHaveLength(1);
    expect(documents[0].user_id).toEqual(userResult[0].id);
    expect(documents[0].document_type).toEqual('transfer_proof');
    expect(documents[0].file_name).toEqual('transfer_proof.pdf');
    expect(documents[0].file_path).toEqual('/uploads/transfer_proof_123.pdf');
    expect(documents[0].file_size).toEqual(1024000);
    expect(documents[0].mime_type).toEqual('application/pdf');
    expect(documents[0].download_token).toBeDefined();
  });

  it('should handle optional fields correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Test input without optional fields
    const minimalInput: FileUploadInput = {
      user_id: userResult[0].id,
      document_type: 'certificate',
      file_name: 'certificate.pdf',
      file_path: '/uploads/cert_456.pdf'
    };

    const result = await uploadDocument(minimalInput);

    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.document_type).toEqual('certificate');
    expect(result.file_name).toEqual('certificate.pdf');
    expect(result.file_path).toEqual('/uploads/cert_456.pdf');
    expect(result.file_size).toBeNull();
    expect(result.mime_type).toBeNull();
    expect(result.download_token).toBeDefined();
  });

  it('should generate unique download tokens', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const input1 = {
      ...testInput,
      user_id: userResult[0].id,
      file_name: 'doc1.pdf'
    };

    const input2 = {
      ...testInput,
      user_id: userResult[0].id,
      file_name: 'doc2.pdf'
    };

    const result1 = await uploadDocument(input1);
    const result2 = await uploadDocument(input2);

    expect(result1.download_token).toBeDefined();
    expect(result2.download_token).toBeDefined();
    expect(result1.download_token).not.toEqual(result2.download_token);
  });

  it('should support different document types', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Test all document types
    const documentTypes = ['transfer_proof', 'receipt', 'certificate'] as const;

    for (const docType of documentTypes) {
      const input = {
        ...testInput,
        user_id: userResult[0].id,
        document_type: docType,
        file_name: `${docType}.pdf`
      };

      const result = await uploadDocument(input);
      expect(result.document_type).toEqual(docType);
      expect(result.file_name).toEqual(`${docType}.pdf`);
    }
  });

  it('should throw error for non-existent user', async () => {
    const invalidInput = {
      ...testInput,
      user_id: 999999 // Non-existent user
    };

    expect(uploadDocument(invalidInput)).rejects.toThrow(/User with id 999999 not found/i);
  });

  it('should handle database errors gracefully', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Try to insert document with invalid data (missing required field will be caught by schema)
    const invalidInput = {
      user_id: userResult[0].id,
      document_type: 'invalid_type' as any, // Invalid document type
      file_name: 'test.pdf',
      file_path: '/uploads/test.pdf'
    };

    expect(uploadDocument(invalidInput)).rejects.toThrow();
  });

  it('should handle multiple documents for same user', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Upload multiple documents
    const input1 = {
      ...testInput,
      user_id: userResult[0].id,
      document_type: 'transfer_proof' as const,
      file_name: 'transfer.pdf'
    };

    const input2 = {
      ...testInput,
      user_id: userResult[0].id,
      document_type: 'receipt' as const,
      file_name: 'receipt.pdf'
    };

    const result1 = await uploadDocument(input1);
    const result2 = await uploadDocument(input2);

    // Both documents should belong to the same user but have different IDs
    expect(result1.user_id).toEqual(userResult[0].id);
    expect(result2.user_id).toEqual(userResult[0].id);
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.document_type).toEqual('transfer_proof');
    expect(result2.document_type).toEqual('receipt');

    // Verify both are in database
    const documents = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.user_id, userResult[0].id))
      .execute();

    expect(documents).toHaveLength(2);
  });
});