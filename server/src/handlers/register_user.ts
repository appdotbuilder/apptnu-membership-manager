import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegistrationInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const registerUser = async (input: RegistrationInput): Promise<User> => {
  try {
    // Check if user already exists with this email
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash the password using Bun's built-in password hashing
    const passwordHash = await Bun.password.hash(input.password);

    // Insert new user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        role: 'member', // Default role
        nama_perguruan_tinggi: input.nama_perguruan_tinggi,
        nama_kepala_perpustakaan: input.nama_kepala_perpustakaan,
        no_hp_kepala: input.no_hp_kepala,
        instansi: input.instansi,
        nama_pic: input.nama_pic,
        no_hp_pic: input.no_hp_pic,
        alamat_lengkap: input.alamat_lengkap,
        provinsi: input.provinsi,
        email_institusi: input.email_institusi,
        url_website: input.url_website,
        url_otomasi: input.url_otomasi,
        repository_status: input.repository_status,
        jumlah_koleksi: input.jumlah_koleksi,
        status_akreditasi: input.status_akreditasi,
        jenis_keanggotaan: input.jenis_keanggotaan,
        membership_status: 'pending' // Default status
      })
      .returning()
      .execute();

    const user = result[0];
    return user;
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};