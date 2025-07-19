import { init } from '@instantdb/react';

// Initialize InstantDB
export const initDB = () => {
  try {
    const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
    if (!appId) {
      throw new Error('NEXT_PUBLIC_INSTANT_APP_ID is not set in environment variables');
    }
    
    return init({ appId });
  } catch (error) {
    console.error('Failed to initialize InstantDB:', error);
    throw error; // Re-throw to be handled by the component
  }
};

// Export a singleton instance
export const db = initDB();
