import { db } from '../db';
import { usersTable, documentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Document } from '../schema';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

export async function generateCertificatePdf(userId: number): Promise<Document> {
  try {
    // 1. Fetch user data from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = users[0];

    // 2. Generate unique filename and paths
    const timestamp = Date.now();
    const fileName = `certificate_${userId}_${timestamp}.pdf`;
    const documentsDir = path.join(process.cwd(), 'storage', 'documents', 'certificates');
    const filePath = path.join(documentsDir, fileName);
    const relativePath = `/documents/certificates/${fileName}`;

    // Ensure directory exists
    await fs.mkdir(documentsDir, { recursive: true });

    // 3. Generate PDF content (simplified mock implementation)
    // In a real implementation, you would use a PDF library like PDFKit or jsPDF
    const pdfContent = generateCertificateContent(user);
    
    // 4. Write PDF file
    await fs.writeFile(filePath, pdfContent, 'utf-8');
    
    // Get file size
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // 5. Generate secure download token
    const downloadToken = generateDownloadToken();

    // 6. Create document record in database
    const documentResult = await db.insert(documentsTable)
      .values({
        user_id: userId,
        document_type: 'certificate',
        file_name: fileName,
        file_path: relativePath,
        file_size: fileSize,
        mime_type: 'application/pdf',
        download_token: downloadToken
      })
      .returning()
      .execute();

    const document = documentResult[0];

    // 7. Return document metadata with proper type conversion
    return {
      ...document,
      // No numeric field conversions needed for documents table
    };
  } catch (error) {
    console.error('Certificate PDF generation failed:', error);
    throw error;
  }
}

function generateCertificateContent(user: any): string {
  // This is a simplified mock PDF content generator
  // In a real implementation, you would use a proper PDF library
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
50 700 Td
(CERTIFICATE OF MEMBERSHIP) Tj
0 -50 Td
(ASOSIASI PERPUSTAKAAN PERGURUAN TINGGI NAHDLATUL ULAMA) Tj
0 -30 Td
(Institution: ${user.nama_perguruan_tinggi}) Tj
0 -20 Td
(Head Librarian: ${user.nama_kepala_perpustakaan}) Tj
0 -20 Td
(Province: ${user.provinsi}) Tj
0 -20 Td
(Membership Type: ${user.jenis_keanggotaan}) Tj
0 -20 Td
(Status: ${user.membership_status}) Tj
0 -40 Td
(Generated on: ${new Date().toLocaleDateString()}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000100 00000 n 
0000000260 00000 n 
0000000580 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
650
%%EOF`;
}

function generateDownloadToken(): string {
  const timestamp = Date.now().toString();
  const randomString = randomBytes(16).toString('hex');
  return `token_${timestamp}_${randomString}`;
}