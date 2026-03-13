import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { pool } from './config/database';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import authRoutes from './routes/auth';
import partnerRoutes from './routes/partner';
import webhookRoutes from './routes/webhook';
import venueRoutes from './routes/venue';
import syncRoutes from './routes/sync';
import imageRoutes from './routes/images';
import operatingHoursRoutes from './routes/operatingHours';
import setupRoutes from './routes/setup';
import adminRoutes from './routes/admin';
import initDatabase from './scripts/initDatabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// Socket.io setup
// CORS configuration - allow frontend URL from environment
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/venue', venueRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/operating-hours', operatingHoursRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join venue room for KDS
  socket.on('join-venue', (venueId: string) => {
    socket.join(`venue-${venueId}`);
    console.log(`Socket ${socket.id} joined venue ${venueId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes (extend Express Request type)
declare global {
  namespace Express {
    interface Application {
      get(name: 'io'): SocketServer;
    }
  }
}
app.set('io', io);

// Initialize database tables on startup
initDatabase()
  .then(() => {
    console.log('✅ Database initialized');
  })
  .catch((error) => {
    console.error('⚠️  Database initialization failed (tables may already exist):', error.message);
  });

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});

export { io };

