import { io } from 'socket.io-client';
import { getBufferedCoordinates, clearSyncedCoordinates } from './indexeddb';

let socket = null;
let syncingIds = [];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

/**
 * Initializes the Socket.io connection for a driver.
 * @param {string} driverId 
 * @param {object} callbacks - Event callbacks (onProposal, onConnect, onDisconnect, onConnectError)
 * @returns {object} The socket instance
 */
export function initSocket(driverId, callbacks = {}) {
  if (typeof window === 'undefined') return null;

  if (socket) {
    socket.disconnect();
  }

  console.log(`[Socket] Conectando a ${BACKEND_URL} con driverId=${driverId}`);
  socket = io(BACKEND_URL, {
    query: { driverId },
    transports: ['websocket'], // force websocket for stability
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', async () => {
    console.log('[Socket] Conectado al servidor.');
    if (callbacks.onConnect) callbacks.onConnect();

    // Trigger sync of buffered coordinates
    await syncBufferedCoordinates();
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Desconectado del servidor:', reason);
    if (callbacks.onDisconnect) callbacks.onDisconnect(reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Error de conexión:', error);
    if (callbacks.onConnectError) callbacks.onConnectError(error);
  });

  // Listen for task proposals from backend
  socket.on('dispatch_proposal', (payload) => {
    console.log('[Socket] Nueva propuesta de despacho recibida:', payload);
    if (callbacks.onProposal) {
      callbacks.onProposal(payload);
    }
  });

  // Listen for batch acknowledgment from backend
  socket.on('batch_received', async (data) => {
    console.log('[Socket] Lote de coordenadas recibido por el servidor:', data);
    if (data.status === 'ok' && syncingIds.length > 0) {
      try {
        await clearSyncedCoordinates(syncingIds);
        syncingIds = [];
      } catch (err) {
        console.error('[Socket] Error al limpiar coordenadas sincronizadas:', err);
      }
    }
  });

  socket.on('error', (errMsg) => {
    console.error('[Socket] Error emitido por servidor:', errMsg);
  });

  return socket;
}

/**
 * Sends a GPS coordinate update. If offline, buffers it in IndexedDB.
 * @param {string} driverId 
 * @param {number} latitude 
 * @param {number} longitude 
 */
export async function sendLocation(driverId, latitude, longitude) {
  const timestamp = new Date().toISOString();

  if (socket && socket.connected) {
    console.log(`[Socket] Enviando actualización de ubicación en tiempo real: Lat=${latitude}, Lng=${longitude}`);
    socket.emit('location_update', {
      latitude,
      longitude,
      timestamp,
    });
  } else {
    console.warn('[Socket] Sin conexión activa. Almacenando coordenadas en IndexedDB.');
    const { bufferCoordinate } = require('./indexeddb');
    await bufferCoordinate(latitude, longitude);
  }
}

/**
 * Syncs any buffered offline coordinates to the backend via WebSocket.
 */
export async function syncBufferedCoordinates() {
  if (!socket || !socket.connected) {
    console.warn('[Socket] No se puede sincronizar: socket no conectado.');
    return;
  }

  try {
    const coords = await getBufferedCoordinates();
    if (coords.length === 0) {
      console.log('[Socket] No hay coordenadas offline guardadas para sincronizar.');
      return;
    }

    console.log(`[Socket] Sincronizando ${coords.length} coordenadas guardadas offline...`);
    
    // Store IDs to clear them upon 'batch_received' confirmation
    syncingIds = coords.map((c) => c.id);

    // Format coordinates to match GPSCoordinateDto
    const coordinatesPayload = coords.map((c) => ({
      latitude: c.latitude,
      longitude: c.longitude,
      timestamp: c.timestamp,
    }));

    socket.emit('location_batch', {
      coordinates: coordinatesPayload,
    });
  } catch (err) {
    console.error('[Socket] Error durante sincronización de coordenadas:', err);
  }
}

/**
 * Disconnects the current socket connection.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
