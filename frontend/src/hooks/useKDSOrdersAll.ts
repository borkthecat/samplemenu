import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../utils/api';
import type { Order } from '../utils/api';
import { playNotificationSound } from './useKDSOrders';

export function useKDSOrdersAll() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrderBanner, setNewOrderBanner] = useState<Order | null>(null);
  const previousOrderIdsRef = useRef<Set<number>>(new Set());
  const playedSoundsRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (playedSoundsRef.current.size > 100) {
        const ids = Array.from(playedSoundsRef.current);
        playedSoundsRef.current = new Set(ids.slice(-50));
      }
    }, 60000);
    return () => clearInterval(cleanup);
  }, []);

  const fetchOrders = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE}/orders/kds/all`);
      if (response.ok) {
        const data: Order[] = await response.json();
        
        const currentOrderIds = new Set<number>(data.map((o: Order) => o.id));
        const newOrderIds = Array.from(currentOrderIds).filter(
          (id: number) => !previousOrderIdsRef.current.has(id)
        );
        
        if (newOrderIds.length > 0 && previousOrderIdsRef.current.size > 0) {
          newOrderIds.forEach((orderId) => {
            if (!playedSoundsRef.current.has(orderId)) {
              playedSoundsRef.current.add(orderId);
              const newOrder = data.find((o: Order) => o.id === orderId);
              if (newOrder) {
                // Show banner
                setNewOrderBanner(newOrder);
                setTimeout(() => setNewOrderBanner(null), 5000); // Hide after 5 seconds
                setTimeout(() => {
                  console.log(`🔔 New order detected: Order #${orderId} - Playing sound`);
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
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  // Show PREPARING and PROCESSING orders (only hide READY and UNPAID)
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


