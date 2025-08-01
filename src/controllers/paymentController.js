import solanaService from '../services/solanaService.js';
import qrService from '../services/qrService.js';
import storageService from '../services/storageService.js';
import { config } from '../config/index.js';

class PaymentController {
    /**
     * POST /api/payment/create
     * Создать новый платеж
     */
    async createPayment(req, res) {
        try {
            const { recipient, amount, token, label, message } = req.body;

            console.log(`🎯 Creating payment: ${amount} ${token} to ${recipient}`);

            // Валидация данных
            const validation = storageService.validatePaymentData(recipient, amount, token);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: validation.errors.join(', ')
                });
            }

            // Проверяем адрес
            if (!solanaService.validateAddress(recipient)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid recipient address'
                });
            }

            // Проверяем поддержку токена
            if (!solanaService.isTokenSupported(token)) {
                return res.status(400).json({
                    success: false,
                    error: `Token ${token} not supported. Supported: ${solanaService.getSupportedTokens().join(', ')}`
                });
            }

            // Создаем платеж в storage
            const payment = storageService.createPayment(recipient, amount, token);

            // Генерируем QR код
            const qrCode = await qrService.createPaymentQR(payment.id);

            // Дополняем данные платежа
            const responseData = {
                ...payment,
                url: qrService.createSolanaPayUrl(payment.id),
                qr_code: qrCode,
                fee_wallet: config.fees.wallet,
                fee_amount: config.fees.amount,
                fee_token: config.fees.token,
                label: label || `Payment ${token}`,
                message: message || `Pay ${amount} ${token} + ${config.fees.amount} ${config.fees.token} fee`
            };

            console.log(`✅ Payment created: ${payment.id}`);

            res.json({
                success: true,
                data: responseData
            });

        } catch (error) {
            console.error('❌ Error creating payment:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * GET /api/payment/:id
     * Получить информацию о платеже
     */
    async getPayment(req, res) {
        try {
            const { id } = req.params;
            const payment = storageService.getPayment(id);

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            res.json({
                success: true,
                data: payment
            });

        } catch (error) {
            console.error('❌ Error getting payment:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * GET /api/payment/:id/transaction
     * Solana Pay: получить метаданные транзакции
     */
    async getTransactionMetadata(req, res) {
        try {
            const { id } = req.params;
            const payment = storageService.getPayment(id);

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'expired') {
                return res.status(410).json({ error: 'Payment expired' });
            }

            console.log(`📋 GET metadata for payment: ${id}`);

            res.json({
                label: `Pay ${payment.amount} ${payment.token} + ${config.fees.amount} ${config.fees.token} fee`,
                icon: "https://solana.com/src/img/branding/solanaLogoMark.svg"
            });

        } catch (error) {
            console.error('❌ Error getting transaction metadata:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/payment/:id/transaction
     * Solana Pay: создать транзакцию
     */
    async createTransaction(req, res) {
        try {
            const { id } = req.params;
            const { account } = req.body;

            console.log(`🔧 POST creating transaction for payment: ${id}`);
            console.log(`💳 Payer: ${account}`);

            const payment = storageService.getPayment(id);
            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'expired') {
                return res.status(410).json({ error: 'Payment expired' });
            }

            // Валидируем адрес плательщика
            if (!solanaService.validateAddress(account)) {
                return res.status(400).json({ error: 'Invalid payer address' });
            }

            // Создаем транзакцию с двойным платежом
            const transaction = await solanaService.createDualTransaction(
                account,
                payment.recipient,
                payment.amount,
                payment.token
            );

            // Сериализуем транзакцию
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });
            const base64Transaction = serializedTransaction.toString('base64');

            console.log(`✅ Transaction created with ${transaction.instructions.length} instructions`);
            console.log(`📦 Transaction size: ${serializedTransaction.length} bytes`);

            res.json({
                transaction: base64Transaction,
                message: `Pay ${payment.amount} ${payment.token} + ${config.fees.amount} ${config.fees.token} fee`
            });

        } catch (error) {
            console.error('❌ Error creating transaction:', error);
            res.status(500).json({
                error: 'Transaction creation failed',
                details: error.message
            });
        }
    }

    /**
     * POST /api/payment/:id/verify
     * Верифицировать платеж
     */
    async verifyPayment(req, res) {
        try {
            const { id } = req.params;
            const { signature } = req.body;

            console.log(`🔍 Verifying payment: ${id} with signature: ${signature}`);

            const payment = storageService.getPayment(id);
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            // Здесь можно добавить реальную верификацию в блокчейне
            // Пока просто помечаем как завершенный
            storageService.updatePaymentStatus(id, 'completed', signature);

            res.json({
                success: true,
                status: 'completed',
                signature
            });

        } catch (error) {
            console.error('❌ Error verifying payment:', error);
            res.status(500).json({
                success: false,
                error: 'Verification failed'
            });
        }
    }

    /**
     * GET /api/stats
     * Получить статистику
     */
    async getStats(req, res) {
        try {
            const stats = storageService.getStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ Error getting stats:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
}

export default new PaymentController();