import { useState, useEffect, useRef, useMemo } from 'react';
import { useSocket } from './useSocket';
import { api } from '../utils/api';
import type { Order } from '../utils/api';

export function useKDSOrders(venueId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderBanner, setNewOrderBanner] = useState<Order | null>(null);
  const socket = useSocket(venueId);
  const previousOrderIdsRef = useRef<Set<number>>(new Set());
  const playedSoundsRef = useRef<Set<number>>(new Set()); // Track which orders already played sound
  
  // Clean up old played sounds to prevent memory leak (keep only last 100)
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (playedSoundsRef.current.size > 100) {
        const ids = Array.from(playedSoundsRef.current);
        playedSoundsRef.current = new Set(ids.slice(-50)); // Keep only last 50
      }
    }, 60000); // Clean up every minute
    return () => clearInterval(cleanup);
  }, []);

  const fetchOrders = async () => {
    if (!venueId) {
      setLoading(false);
      return;
    }
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE}/orders/venue/${venueId}`);
      if (response.ok) {
        const data: Order[] = await response.json();
        
        // Check for new orders and play sound
        const currentOrderIds = new Set<number>(data.map((o: Order) => o.id));
        const newOrderIds = Array.from(currentOrderIds).filter(
          (id: number) => !previousOrderIdsRef.current.has(id)
        );
        
        // Show banner and play sound for each new order (only if we had previous orders - not on initial load)
        if (newOrderIds.length > 0 && previousOrderIdsRef.current.size > 0) {
          // New order detected via polling - play sound and show banner
          newOrderIds.forEach((orderId) => {
            if (!playedSoundsRef.current.has(orderId)) {
              playedSoundsRef.current.add(orderId);
              const newOrder = data.find((o: Order) => o.id === orderId);
              if (newOrder) {
                console.log(`🔔 New order detected via polling: Order #${orderId} - Showing banner and playing sound`);
                // Show banner immediately
                setNewOrderBanner(newOrder);
                setTimeout(() => setNewOrderBanner(null), 5000); // Hide after 5 seconds
                // Play sound with small delay
                setTimeout(() => {
                  playNotificationSound();
                }, 100);
              }
            }
          });
        }
        
        previousOrderIdsRef.current = currentOrderIds;
        setOrders(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [venueId]);

  useEffect(() => {
    if (!venueId) return;
    // Poll every 5 seconds, but only if we have orders or are loading
    // This reduces unnecessary requests when there are no orders
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [venueId]);

  useEffect(() => {
    if (!socket || !venueId) return;

    const handleNewOrder = (order: Order) => {
      if (order.venue_id !== venueId) return;
      
      const isNewOrder = !previousOrderIdsRef.current.has(order.id);
      
      // Update orders state first (immediate)
      setOrders((prev) => {
        const existingIndex = prev.findIndex((o) => o.id === order.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = order;
          return updated;
        }
        previousOrderIdsRef.current.add(order.id);
        return [order, ...prev];
      });
      
      // Play sound and show banner AFTER state update
      if (isNewOrder && !playedSoundsRef.current.has(order.id)) {
        playedSoundsRef.current.add(order.id);
        console.log(`🔔 New order received via socket: Order #${order.id} - Showing banner and playing sound`);
        // Show banner immediately
        setNewOrderBanner(order);
        setTimeout(() => setNewOrderBanner(null), 5000); // Hide after 5 seconds
        // Play sound with small delay
        setTimeout(() => {
          playNotificationSound();
        }, 100);
      }
    };

    const handleOrderUpdate = (order: Order) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? order : o))
      );
    };

    socket.on('new-order', handleNewOrder);
    socket.on('order-updated', handleOrderUpdate);

    return () => {
      socket.off('new-order', handleNewOrder);
      socket.off('order-updated', handleOrderUpdate);
    };
  }, [socket, venueId]);

  const markOrderReady = async (orderId: number) => {
    try {
      const updatedOrder = await api.updateOrderStatus(orderId, 'READY');
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updatedOrder : o))
      );
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const updatedOrder = await api.updateOrderStatus(orderId, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updatedOrder : o))
      );
      return updatedOrder;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  };

  // Memoize filtered orders to prevent unnecessary re-renders and recalculations
  // Show PREPARING and PROCESSING orders (hide READY and UNPAID)
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'READY' && o.status !== 'UNPAID');
  }, [orders]);
  
  return {
    orders: filteredOrders,
    allOrders: orders,
    loading,
    markOrderReady,
    updateOrderStatus,
    newOrderBanner,
  };
}

// Global audio context - shared across all sound plays
let globalAudioContext: AudioContext | null = null;

// Initialize audio context (called when user enables audio)
export function initAudioContextForNotifications(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!globalAudioContext || globalAudioContext.state === 'closed') {
    try {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎵 Global audio context created');
    } catch (error) {
      console.error('❌ Failed to create audio context:', error);
      return null;
    }
  }
  
  return globalAudioContext;
}


export function playNotificationSound() {
  // Check if audio is enabled
  if (typeof window === 'undefined' || localStorage.getItem('kds_audio_enabled') !== 'true') {
    console.log('🔇 Audio not enabled - user needs to click "Enable Sound Notifications"');
    return;
  }
  
  // Try to get or create audio context
  let ctx = globalAudioContext;
  
  // If context doesn't exist or is closed, try to create a new one
  // Note: This might fail due to browser autoplay policy, but we'll try
  if (!ctx || ctx.state === 'closed') {
    try {
      ctx = initAudioContextForNotifications();
      if (!ctx) {
        console.warn('⚠️ Audio context not initialized. User must click "Enable Sound Notifications" first.');
        return;
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize audio context:', error);
      return;
    }
  }
  
  console.log('🔊 Playing notification sound...');
  
  // Function to actually play the sound (short and crisp)
  const playSound = () => {
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.frequency.value = 800;
      osc1.type = 'sine';
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      
      const now = ctx.currentTime;
      // Short, crisp ding - 0.2 seconds total
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1.2, now + 0.02); // Quick attack - louder volume
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2); // Fast decay
      
      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.05); // Start second oscillator slightly later
      osc2.stop(now + 0.2);
      
      console.log('✅ Ding sound played');
    } catch (error) {
      console.error('❌ Error creating sound:', error);
    }
  };
  
  // Always try to resume first (in case browser suspended it), then play
  // Browsers suspend audio contexts after inactivity, so we need to resume
  const tryPlay = async () => {
    try {
      // Always try to resume - even if state says 'running', it might be suspended
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        console.log('🔄 Audio context suspended, attempting to resume...');
        await ctx.resume();
        console.log('✅ Audio context resumed');
      }
      
      // Small delay to ensure context is ready
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Now play the sound
      playSound();
    } catch (err) {
      console.error('❌ Failed to resume/play sound:', err);
      // Try to play anyway - sometimes it works even if resume fails
      try {
        playSound();
      } catch (e) {
        console.error('❌ Failed to play sound after resume attempt:', e);
      }
    }
  };
  
  // Execute the play attempt
  tryPlay();
}

