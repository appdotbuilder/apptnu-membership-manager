import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

// Helper function to verify password using PBKDF2
function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
  try {
    // Parse the stored hash (format: salt:hash)
    const [salt, hash] = hashedPassword.split(':');
    if (!salt || !hash) {
      return false;
    }
    
    // Hash the provided password with the same salt
    const hashedInput = pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512').toString('hex');
    
    // Use timing-safe comparison
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashedInput, 'hex'));
  } catch (error) {
    return false;
  }
}

// Helper function to hash password using PBKDF2
function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function loginUser(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userRecord = users[0];

    // Verify password
    const isPasswordValid = verifyPassword(input.password, userRecord.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
    const token = jwt.sign(
      { 
        userId: userRecord.id,
        role: userRecord.role,
        email: userRecord.email 
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Return user data (excluding password hash) and token
    const { password_hash, ...userWithoutPassword } = userRecord;
    
    return {
      user: userWithoutPassword as User,
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}