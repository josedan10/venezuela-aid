/**
 * Utility for buffering GPS coordinates in IndexedDB during offline periods.
 * This is designed to run exclusively in the browser context.
 */

const DB_NAME = 'AidVenezuelaGPSDB';
const STORE_NAME = 'gps_coordinates';
const DB_VERSION = 1;

let dbInstance = null;

function getDB() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Saves a GPS coordinate to the offline buffer.
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<void>}
 */
export async function bufferCoordinate(latitude, longitude) {
  const db = await getDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    };

    const request = store.add(record);

    request.onsuccess = () => {
      console.log('[IndexedDB] Coordinate buffered offline:', record);
      resolve();
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Failed to buffer coordinate:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves all buffered coordinates sorted chronologically.
 * @returns {Promise<Array>}
 */
export async function getBufferedCoordinates() {
  const db = await getDB();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      // IndexedDB getAll generally returns items in key order (auto-incremented id order = chronological)
      resolve(event.target.result || []);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Failed to retrieve coordinates:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Clears buffered coordinates up to a specific list of IDs.
 * Used after successful synchronization.
 * @param {Array<number>} ids 
 * @returns {Promise<void>}
 */
export async function clearSyncedCoordinates(ids) {
  const db = await getDB();
  if (!db || !ids || ids.length === 0) return;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    let completed = 0;
    let hasError = false;

    ids.forEach((id) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        completed++;
        if (completed === ids.length && !hasError) {
          console.log(`[IndexedDB] Cleared ${ids.length} synced coordinates.`);
          resolve();
        }
      };
      request.onerror = (event) => {
        if (!hasError) {
          hasError = true;
          console.error('[IndexedDB] Failed to delete coordinate ID:', id, event.target.error);
          reject(event.target.error);
        }
      };
    });
  });
}

/**
 * Checks if there are any buffered coordinates.
 * @returns {Promise<boolean>}
 */
export async function hasBufferedCoordinates() {
  const coords = await getBufferedCoordinates();
  return coords.length > 0;
}
