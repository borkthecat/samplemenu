import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function useSocket(venueId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!venueId) return;

    // Connect to Socket.io server
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Join venue room for KDS updates
    socket.emit('join-venue', venueId);

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.io server, socket ID:', socket.id);
      socket.emit('join-venue', venueId);
      console.log(`Joined venue room: ${venueId}`);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.io server:', reason);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [venueId]);

  return socketRef.current;
}

