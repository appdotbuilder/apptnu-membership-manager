import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { type WhatsAppNotificationInput } from '../schema';
import { sendWhatsAppNotification } from '../handlers/send_whatsapp_notification';

// Test inputs
const validInput: WhatsAppNotificationInput = {
  phoneNumber: '08123456789',
  message: 'Selamat! Pembayaran keanggotaan Anda telah berhasil diproses. Dokumen sertifikat keanggotaan dapat diunduh melalui dashboard.'
};

const longMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100); // Over 4096 chars

describe('sendWhatsAppNotification', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('successful notifications', () => {
    it('should send notification with Indonesian phone number format (08)', async () => {
      const result = await sendWhatsAppNotification(validInput);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^wa_msg_\d+_[a-z0-9]+$/);
      expect(result.error).toBeUndefined();
    });

    it('should handle phone number with country code (+62)', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '+6281234567890',
        message: 'Test message with country code'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle phone number starting with 62', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '6281234567890',
        message: 'Test message without + prefix'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle phone numbers with spaces and hyphens', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '0812-3456-789',
        message: 'Test message with formatted number'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send membership notification message', async () => {
      const membershipMessage = `
🎉 Selamat! Pembayaran keanggotaan PERPUSNAS berhasil!

Detail Keanggotaan:
- Nama Institusi: Universitas Indonesia
- Jenis: Perpanjangan
- Status: Aktif

📋 Dokumen tersedia:
- Sertifikat Keanggotaan
- Bukti Transfer

Akses dashboard: https://member.perpusnas.go.id
      `.trim();

      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: membershipMessage
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should reject empty phone number', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '',
        message: 'Test message'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Phone number and message are required');
      expect(result.messageId).toBeUndefined();
    });

    it('should reject empty message', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: ''
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Phone number and message are required');
    });

    it('should reject whitespace-only message', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: '   \n\t   '
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('should reject message that is too long', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: longMessage
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message too long (maximum 4096 characters)');
    });

    it('should reject invalid phone number format', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: 'invalid-phone',
        message: 'Test message'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });

    it('should reject phone number that is too short', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '081234',
        message: 'Test message'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });
  });

  describe('API simulation scenarios', () => {
    it('should handle API error for invalid message', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: 'This should trigger API error invalid'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });

    it('should handle API failure response', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: 'This should trigger API failure failed'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
    });
  });

  describe('phone number formatting', () => {
    it('should format Indonesian mobile numbers correctly', async () => {
      const testCases = [
        { input: '08123456789', expected: true },
        { input: '+6281234567890', expected: true },
        { input: '6281234567890', expected: true },
        { input: '0812 3456 789', expected: true },
        { input: '0812-3456-789', expected: true },
      ];

      for (const testCase of testCases) {
        const input: WhatsAppNotificationInput = {
          phoneNumber: testCase.input,
          message: 'Test formatting'
        };

        const result = await sendWhatsAppNotification(input);
        expect(result.success).toBe(testCase.expected);
      }
    });

    it('should handle international numbers', async () => {
      const input: WhatsAppNotificationInput = {
        phoneNumber: '+1234567890123',
        message: 'International number test'
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('message content validation', () => {
    it('should accept various message formats', async () => {
      const messageFormats = [
        'Simple text message',
        'Message with\nnewlines\nand formatting',
        'Message with emojis 🎉📋✅',
        'Message with special chars: @#$%^&*()',
        'Message dengan bahasa Indonesia',
        'Mixed language message with English and Indonesia'
      ];

      for (const message of messageFormats) {
        const input: WhatsAppNotificationInput = {
          phoneNumber: '08123456789',
          message
        };

        const result = await sendWhatsAppNotification(input);
        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
      }
    });

    it('should handle maximum allowed message length', async () => {
      const maxMessage = 'A'.repeat(4096); // Exactly 4096 characters

      const input: WhatsAppNotificationInput = {
        phoneNumber: '08123456789',
        message: maxMessage
      };

      const result = await sendWhatsAppNotification(input);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });
});