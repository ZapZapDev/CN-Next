import express from 'express';
import cors from 'cors';
import { config } from './src/config/index.js';
import paymentController from './src/controllers/paymentController.js';

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request body:', req.body);
    }
    next();
});

// Health check
app.get('/', (req, res) => {
    console.log('Health check requested');
    res.json({
        status: "running",
        timestamp: new Date().toISOString(),
        baseUrl: config.baseUrl
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    console.log('Test endpoint requested');
    res.json({
        success: true,
        message: 'Server operational',
        baseUrl: config.baseUrl,
        timestamp: new Date().toISOString()
    });
});

// Payment routes
app.post('/api/payment/create', paymentController.createPayment);
app.get('/api/payment/:id/transaction', paymentController.getTransaction);
app.post('/api/payment/:id/transaction', paymentController.createTransaction);
app.post('/api/payment/:id/verify', paymentController.verifyPayment);

// 404 handler
app.use('*', (req, res) => {
    console.log(`404 - ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Local: http://localhost:${config.port}`);
    console.log(`External: ${config.baseUrl}`);
    console.log('Ready to accept requests');
});