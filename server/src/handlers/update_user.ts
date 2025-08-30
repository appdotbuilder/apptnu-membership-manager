import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // First, check if user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.id))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with id ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    // Add only the fields that are provided in the input
    if (input.email !== undefined) updateData['email'] = input.email;
    if (input.nama_perguruan_tinggi !== undefined) updateData['nama_perguruan_tinggi'] = input.nama_perguruan_tinggi;
    if (input.nama_kepala_perpustakaan !== undefined) updateData['nama_kepala_perpustakaan'] = input.nama_kepala_perpustakaan;
    if (input.no_hp_kepala !== undefined) updateData['no_hp_kepala'] = input.no_hp_kepala;
    if (input.instansi !== undefined) updateData['instansi'] = input.instansi;
    if (input.nama_pic !== undefined) updateData['nama_pic'] = input.nama_pic;
    if (input.no_hp_pic !== undefined) updateData['no_hp_pic'] = input.no_hp_pic;
    if (input.alamat_lengkap !== undefined) updateData['alamat_lengkap'] = input.alamat_lengkap;
    if (input.provinsi !== undefined) updateData['provinsi'] = input.provinsi;
    if (input.email_institusi !== undefined) updateData['email_institusi'] = input.email_institusi;
    if (input.url_website !== undefined) updateData['url_website'] = input.url_website;
    if (input.url_otomasi !== undefined) updateData['url_otomasi'] = input.url_otomasi;
    if (input.repository_status !== undefined) updateData['repository_status'] = input.repository_status;
    if (input.jumlah_koleksi !== undefined) updateData['jumlah_koleksi'] = input.jumlah_koleksi;
    if (input.status_akreditasi !== undefined) updateData['status_akreditasi'] = input.status_akreditasi;
    if (input.jenis_keanggotaan !== undefined) updateData['jenis_keanggotaan'] = input.jenis_keanggotaan;
    if (input.membership_status !== undefined) updateData['membership_status'] = input.membership_status;

    // Update user record
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Failed to update user with id ${input.id}`);
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};