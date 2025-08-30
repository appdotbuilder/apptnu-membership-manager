import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, documentsTable } from '../db/schema';
import { getUserDocuments } from '../handlers/get_user_documents';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@university.edu',
  password_hash: 'hashed_password',
  nama_perguruan_tinggi: 'Test University',
  nama_kepala_perpustakaan: 'Dr. Test',
  no_hp_kepala: '081234567890',
  instansi: 'Test Institution',
  nama_pic: 'John Doe',
  no_hp_pic: '081234567891',
  alamat_lengkap: 'Jl. Test No. 1',
  provinsi: 'Jawa Timur' as const,
  email_institusi: 'lib@university.edu',
  url_website: 'https://university.edu',
  url_otomasi: 'https://opac.university.edu',
  repository_status: 'Sudah' as const,
  jumlah_koleksi: 10000,
  status_akreditasi: 'Akreditasi A' as const,
  jenis_keanggotaan: 'Pendaftaran Baru' as const
};

const anotherUser = {
  email: 'another@university.edu',
  password_hash: 'hashed_password_2',
  nama_perguruan_tinggi: 'Another University',
  nama_kepala_perpustakaan: 'Dr. Another',
  no_hp_kepala: '081234567892',
  instansi: 'Another Institution',
  nama_pic: 'Jane Doe',
  no_hp_pic: '081234567893',
  alamat_lengkap: 'Jl. Another No. 2',
  provinsi: 'Jawa Barat' as const,
  email_institusi: 'lib@another.edu',
  url_website: 'https://another.edu',
  url_otomasi: 'https://opac.another.edu',
  repository_status: 'Belum' as const,
  jumlah_koleksi: 5000,
  status_akreditasi: 'Akreditasi B' as const,
  jenis_keanggotaan: 'Perpanjangan' as const
};

describe('getUserDocuments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no documents', async () => {
    // Create a user but no documents
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const documents = await getUserDocuments(userResult[0].id);

    expect(documents).toHaveLength(0);
    expect(Array.isArray(documents)).toBe(true);
  });

  it('should return user documents ordered by newest first', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create documents at different times
    const oldDate = new Date('2023-01-01');
    const middleDate = new Date('2023-06-01');
    const newDate = new Date('2023-12-01');

    // Insert documents (oldest first to test ordering)
    await db.insert(documentsTable).values([
      {
        user_id: userId,
        document_type: 'transfer_proof',
        file_name: 'old_transfer.jpg',
        file_path: '/old/path',
        created_at: oldDate,
        updated_at: oldDate
      },
      {
        user_id: userId,
        document_type: 'receipt',
        file_name: 'middle_receipt.pdf',
        file_path: '/middle/path',
        created_at: middleDate,
        updated_at: middleDate
      },
      {
        user_id: userId,
        document_type: 'certificate',
        file_name: 'new_certificate.pdf',
        file_path: '/new/path',
        created_at: newDate,
        updated_at: newDate
      }
    ]).execute();

    const documents = await getUserDocuments(userId);

    expect(documents).toHaveLength(3);
    
    // Check ordering (newest first)
    expect(documents[0].file_name).toEqual('new_certificate.pdf');
    expect(documents[1].file_name).toEqual('middle_receipt.pdf');
    expect(documents[2].file_name).toEqual('old_transfer.jpg');
    
    // Verify created_at ordering
    expect(documents[0].created_at >= documents[1].created_at).toBe(true);
    expect(documents[1].created_at >= documents[2].created_at).toBe(true);
  });

  it('should return all document types for user', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create all types of documents
    await db.insert(documentsTable).values([
      {
        user_id: userId,
        document_type: 'transfer_proof',
        file_name: 'proof.jpg',
        file_path: '/proof/path',
        file_size: 256000,
        mime_type: 'image/jpeg',
        download_token: 'token_proof'
      },
      {
        user_id: userId,
        document_type: 'receipt',
        file_name: 'receipt.pdf',
        file_path: '/receipt/path',
        file_size: 50000,
        mime_type: 'application/pdf',
        download_token: 'token_receipt'
      },
      {
        user_id: userId,
        document_type: 'certificate',
        file_name: 'cert.pdf',
        file_path: '/cert/path',
        file_size: 75000,
        mime_type: 'application/pdf',
        download_token: 'token_cert'
      }
    ]).execute();

    const documents = await getUserDocuments(userId);

    expect(documents).toHaveLength(3);
    
    // Check all document types are present
    const documentTypes = documents.map(doc => doc.document_type);
    expect(documentTypes).toContain('transfer_proof');
    expect(documentTypes).toContain('receipt');
    expect(documentTypes).toContain('certificate');

    // Verify all fields are returned correctly
    const transferProofDoc = documents.find(doc => doc.document_type === 'transfer_proof');
    expect(transferProofDoc).toBeDefined();
    expect(transferProofDoc!.file_name).toEqual('proof.jpg');
    expect(transferProofDoc!.file_path).toEqual('/proof/path');
    expect(transferProofDoc!.file_size).toEqual(256000);
    expect(transferProofDoc!.mime_type).toEqual('image/jpeg');
    expect(transferProofDoc!.download_token).toEqual('token_proof');
    expect(transferProofDoc!.created_at).toBeInstanceOf(Date);
    expect(transferProofDoc!.updated_at).toBeInstanceOf(Date);
  });

  it('should only return documents for the specified user', async () => {
    // Create two users
    const userResult1 = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userResult2 = await db.insert(usersTable)
      .values(anotherUser)
      .returning()
      .execute();

    const userId1 = userResult1[0].id;
    const userId2 = userResult2[0].id;

    // Create documents for both users
    await db.insert(documentsTable).values([
      {
        user_id: userId1,
        document_type: 'transfer_proof',
        file_name: 'user1_proof.jpg',
        file_path: '/user1/proof'
      },
      {
        user_id: userId1,
        document_type: 'receipt',
        file_name: 'user1_receipt.pdf',
        file_path: '/user1/receipt'
      },
      {
        user_id: userId2,
        document_type: 'transfer_proof',
        file_name: 'user2_proof.jpg',
        file_path: '/user2/proof'
      },
      {
        user_id: userId2,
        document_type: 'certificate',
        file_name: 'user2_cert.pdf',
        file_path: '/user2/cert'
      }
    ]).execute();

    // Get documents for user1 only
    const user1Documents = await getUserDocuments(userId1);
    expect(user1Documents).toHaveLength(2);
    
    // Verify all documents belong to user1
    user1Documents.forEach(doc => {
      expect(doc.user_id).toEqual(userId1);
    });

    const fileNames = user1Documents.map(doc => doc.file_name);
    expect(fileNames).toContain('user1_proof.jpg');
    expect(fileNames).toContain('user1_receipt.pdf');
    expect(fileNames).not.toContain('user2_proof.jpg');
    expect(fileNames).not.toContain('user2_cert.pdf');
  });

  it('should handle documents with nullable fields', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create document with nullable fields set to null
    await db.insert(documentsTable).values({
      user_id: userId,
      document_type: 'transfer_proof',
      file_name: 'minimal_doc.jpg',
      file_path: '/minimal/path',
      file_size: null,
      mime_type: null,
      download_token: null
    }).execute();

    const documents = await getUserDocuments(userId);

    expect(documents).toHaveLength(1);
    expect(documents[0].file_name).toEqual('minimal_doc.jpg');
    expect(documents[0].file_size).toBeNull();
    expect(documents[0].mime_type).toBeNull();
    expect(documents[0].download_token).toBeNull();
  });

  it('should verify database persistence', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create a document
    const insertResult = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'receipt',
        file_name: 'test_receipt.pdf',
        file_path: '/test/receipt/path',
        file_size: 12345,
        mime_type: 'application/pdf',
        download_token: 'test_token_123'
      })
      .returning()
      .execute();

    // Get documents through handler
    const documents = await getUserDocuments(userId);

    expect(documents).toHaveLength(1);
    expect(documents[0].id).toEqual(insertResult[0].id);

    // Verify the document exists in database directly
    const dbDocs = await db.select()
      .from(documentsTable)
      .where(eq(documentsTable.id, documents[0].id))
      .execute();

    expect(dbDocs).toHaveLength(1);
    expect(dbDocs[0].file_name).toEqual('test_receipt.pdf');
    expect(dbDocs[0].file_path).toEqual('/test/receipt/path');
  });
});