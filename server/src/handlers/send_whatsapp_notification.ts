import { type WhatsAppNotificationInput } from '../schema';

/**
 * Formats phone number to international format for WhatsApp API
 * Handles Indonesian phone numbers starting with 08, 62, or +62
 */
const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters except + at the start
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Handle Indonesian phone number formats
  if (cleaned.startsWith('08')) {
    // Convert 08xxx to +628xxx
    cleaned = '+62' + cleaned.substring(1);
  } else if (cleaned.startsWith('62')) {
    // Add + if missing
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    // If no country code, assume Indonesian and add +62
    cleaned = '+62' + cleaned;
  }
  
  return cleaned;
};

/**
 * Validates if phone number is in correct format for WhatsApp
 */
const validatePhoneNumber = (phoneNumber: string): boolean => {
  const formatted = formatPhoneNumber(phoneNumber);
  
  // Basic validation: should start with + and have 10-15 digits total
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(formatted);
};

/**
 * Simulates WhatsApp API call with proper error handling
 * In production, this would connect to actual WhatsApp Business API
 */
const sendToWhatsAppAPI = async (phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate different scenarios based on phone number for testing
    if (phoneNumber.includes('invalid') || message.includes('invalid')) {
      throw new Error('Invalid phone number format');
    }
    
    if (phoneNumber.includes('failed') || message.includes('failed')) {
      return { success: false, error: 'API rate limit exceeded' };
    }
    
    // Simulate successful send
    return { 
      success: true, 
      messageId: `wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}` 
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
    console.error('WhatsApp API error:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Sends WhatsApp notification with proper validation and error handling
 * Supports both object input and legacy separate parameters
 */
export const sendWhatsAppNotification = async (
  inputOrPhoneNumber: WhatsAppNotificationInput | string,
  legacyMessage?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  // Handle legacy signature (phoneNumber, message) for backwards compatibility
  const input: WhatsAppNotificationInput = typeof inputOrPhoneNumber === 'string' && legacyMessage !== undefined
    ? { phoneNumber: inputOrPhoneNumber, message: legacyMessage }
    : inputOrPhoneNumber as WhatsAppNotificationInput;
  try {
    // Validate input exists
    if (!input || !input.phoneNumber || !input.message) {
      return { 
        success: false, 
        error: 'Phone number and message are required' 
      };
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(input.phoneNumber);
    
    if (!validatePhoneNumber(input.phoneNumber)) {
      return { 
        success: false, 
        error: 'Invalid phone number format' 
      };
    }

    // Validate message content
    if (input.message.trim().length === 0) {
      return { 
        success: false, 
        error: 'Message cannot be empty' 
      };
    }

    if (input.message.length > 4096) {
      return { 
        success: false, 
        error: 'Message too long (maximum 4096 characters)' 
      };
    }

    // Log notification attempt for audit
    console.log(`Attempting to send WhatsApp notification to ${formattedPhone}`);
    console.log(`Message length: ${input.message.length} characters`);

    // Send to WhatsApp API
    const result = await sendToWhatsAppAPI(formattedPhone, input.message);

    // Log result
    if (result.success) {
      console.log(`WhatsApp notification sent successfully to ${formattedPhone}, messageId: ${result.messageId}`);
    } else {
      console.error(`WhatsApp notification failed for ${formattedPhone}: ${result.error}`);
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('WhatsApp notification handler error:', errorMessage);
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
};