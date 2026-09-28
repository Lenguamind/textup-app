/**
 * Service for handling all localStorage interactions.
 * Provides type safety and error handling for persisted data.
 */

export enum StorageKey {
  LANGUAGE = 'textUpLanguage',
  USER = 'textUpUser',
  CORRECTIONS = 'textUpCorrections',
  REMEMBERED_AUTH = 'rememberedAuth',
  API_KEY = 'textUpApiKey'
}

export class StorageService {
  /**
   * Saves data to localStorage.
   */
  static setItem(key: StorageKey, value: any): void {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
    } catch (error) {
      console.error(`Error saving to storage [${key}]:`, error);
      // Handle quota exceeded or other errors if necessary
    }
  }

  /**
   * Retrieves and parses data from localStorage.
   */
  static getItem<T>(key: StorageKey, fallback: T): T {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      
      // Attempt to parse if it looks like JSON, otherwise return as string
      if (typeof fallback === 'string' && !value.startsWith('{') && !value.startsWith('[')) {
        return value as unknown as T;
      }
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`Error reading from storage [${key}]:`, error);
      return fallback;
    }
  }

  /**
   * Removes an item from localStorage.
   */
  static removeItem(key: StorageKey): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from storage [${key}]:`, error);
    }
  }

  /**
   * Clears all app-related items from localStorage.
   */
  static clear(): void {
    try {
      Object.values(StorageKey).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}
