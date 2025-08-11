import express from 'express';
import cors from 'cors';
import { config } from './src/config/index.js';
import paymentController from './src/controllers/paymentController.js';

const app = express();

// Добавляем простые CORS заголовки вручную
app.use((req, res, next) => {
    // Убираем все возможные дублированные заголовки от Cloudflare
    res.removeHeader('access-control-allow-origin');
    res.removeHeader('Access-Control-Allow-Origin');
    res.removeHeader('access-control-allow-methods');
    res.removeHeader('Access-Control-Allow-Methods');
    res.removeHeader('access-control-allow-headers');
    res.removeHeader('Access-Control-Allow-Headers');

    // Устанавливаем только наши заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

    // Обрабатываем preflight OPTIONS запросы
    if (req.method === 'OPTIONS') {
        console.log('🔧 Handling preflight OPTIONS request');
        return res.status(200).end();
    }

    next();
});

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Health check
app.get('/', (req, res) => {
    res.json({
        name: "CryptoNow Payment Server",
        status: "running",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        baseUrl: config.baseUrl
    });
});

// API test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'CryptoNow server operational',
        timestamp: new Date().toISOString(),
        supported_tokens: ['USDC', 'USDT', 'SOL']
    });
});

// Solana Pay Transaction Request endpoints
app.get('/api/payment/:id/transaction', paymentController.getTransaction);
app.post('/api/payment/:id/transaction', paymentController.createTransaction);

// Payment management endpoints
app.post('/api/payment/create', paymentController.createPayment);
app.post('/api/payment/:id/verify', paymentController.verifyPayment);
app.get('/api/payment/:id/status', paymentController.getPaymentStatus);

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

const port = config.port;

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 CryptoNow Payment Server Started');
    console.log(`📍 Port: ${port}`);
    console.log(`🌐 External: ${config.baseUrl}`);
    console.log(`💰 Fee wallet: ${config.cryptonow.feeWallet}`);
    console.log(`💵 Fee amount: ${config.cryptonow.feeAmount} USDC`);
    console.log('✅ Ready to accept payments');
});