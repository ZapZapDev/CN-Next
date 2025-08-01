import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './src/config/index.js';
import paymentController from './src/controllers/paymentController.js';
import solanaService from './src/services/solanaService.js';

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Логирование запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/', (req, res) => {
    res.json({
        message: "🚀 CryptoNow Multichain Server",
        status: "running",
        version: "2.0.0",
        supportedNetworks: ["solana"],
        supportedTokens: solanaService.getSupportedTokens(),
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.post('/api/payment/create', paymentController.createPayment.bind(paymentController));
app.get('/api/payment/:id', paymentController.getPayment.bind(paymentController));
app.get('/api/payment/:id/transaction', paymentController.getTransactionMetadata.bind(paymentController));
app.post('/api/payment/:id/transaction', paymentController.createTransaction.bind(paymentController));
app.post('/api/payment/:id/verify', paymentController.verifyPayment.bind(paymentController));
app.get('/api/stats', paymentController.getStats.bind(paymentController));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'POST /api/payment/create',
            'GET /api/payment/:id',
            'GET /api/payment/:id/transaction',
            'POST /api/payment/:id/transaction',
            'POST /api/payment/:id/verify',
            'GET /api/stats'
        ]
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Запуск сервера
async function startServer() {
    try {
        // Валидируем конфигурацию
        validateConfig();

        // Проверяем подключение к Solana
        console.log('🔗 Testing Solana connection...');
        // Можно добавить тест подключения

        // Запускаем сервер
        app.listen(config.server.port, config.server.host, () => {
            console.log('\n🚀 ================================');
            console.log('🚀 CryptoNow Server Started!');
            console.log('🚀 ================================');
            console.log(`📡 Server: http://${config.server.host}:${config.server.port}`);
            console.log(`🌐 Base URL: ${config.server.baseUrl}`);
            console.log(`💰 Fee Wallet: ${config.fees.wallet}`);
            console.log(`💳 Fee Amount: ${config.fees.amount} ${config.fees.token}`);
            console.log(`🪙 Supported Tokens: ${solanaService.getSupportedTokens().join(', ')}`);
            console.log(`🔗 Solana RPC: ${config.solana.rpcUrl}`);
            console.log('🚀 ================================\n');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

// Запускаем сервер
startServer();