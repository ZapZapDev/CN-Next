import solanaService from '../services/solanaService.js';
import qrService from '../services/qrService.js';
import storageService from '../services/storageService.js';
import { config } from '../config/index.js';

class PaymentController {
    /**
     * Создает новый платеж и возвращает Solana Pay URL
     */
    async createPayment(req, res) {
        try {
            console.log('🛒 Creating new payment:', req.body);

            const {
                recipient,
                amount,
                token = 'USDC',
                label,
                message,
                orderId
            } = req.body;

            // Валидация входных данных
            if (!recipient || !amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: recipient, amount'
                });
            }

            if (!solanaService.validateAddress(recipient)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid recipient address'
                });
            }

            if (!solanaService.isTokenSupported(token)) {
                return res.status(400).json({
                    success: false,
                    error: `Token ${token} not supported. Supported: ${solanaService.getSupportedTokens().join(', ')}`
                });
            }

            const paymentAmount = parseFloat(amount);
            if (paymentAmount <= 0 || paymentAmount > config.payment.maxAmount) {
                return res.status(400).json({
                    success: false,
                    error: `Amount must be between ${config.payment.minAmount} and ${config.payment.maxAmount}`
                });
            }

            // Создаем платеж используя storageService
            const payment = storageService.createPayment(
                recipient,
                paymentAmount,
                token,
                label || `CryptoNow: ${paymentAmount} ${token} + ${config.cryptonow.feeAmount} ${token} fee`,
                message || `Payment of ${paymentAmount} ${token} with ${config.cryptonow.feeAmount} ${token} CryptoNow fee`
            );

            // ИСПРАВЛЕНИЕ: Создаем правильный Solana Pay URL с префиксом solana:
            const transactionUrl = `${config.baseUrl}/api/payment/${payment.id}/transaction`;
            const solanaPayUrl = `solana:${transactionUrl}`;

            // Генерируем QR-код с правильным Solana Pay URL
            console.log('🎨 Generating QR for URL:', solanaPayUrl);
            const qrCode = await qrService.generateQR(solanaPayUrl);

            console.log('✅ Payment created:', {
                id: payment.id,
                recipient: recipient.slice(0, 8) + '...',
                amount: `${paymentAmount} ${token}`,
                fee: `${config.cryptonow.feeAmount} ${token}`,
                solanaPayUrl: solanaPayUrl,
                transactionUrl: transactionUrl,
                qrGenerated: !!qrCode
            });

            res.json({
                success: true,
                data: {
                    id: payment.id,
                    merchant: recipient,
                    amount: paymentAmount,
                    token,
                    label: payment.label,
                    message: payment.message,
                    solana_pay_url: solanaPayUrl, // С префиксом solana:
                    transaction_url: transactionUrl, // Без префикса для отладки
                    qr_code: qrCode, // QR-код с правильным Solana Pay URL
                    fee_info: {
                        amount: config.cryptonow.feeAmount,
                        wallet: config.cryptonow.feeWallet,
                        token
                    },
                    status: payment.status,
                    createdAt: payment.createdAt,
                    expiresAt: payment.expiresAt,
                    orderId: orderId || null
                }
            });

        } catch (error) {
            console.error('❌ Create payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * GET /api/payment/:id/transaction
     * Solana Pay: возвращает метаданные платежа
     */
    async getTransaction(req, res) {
        try {
            const { id } = req.params;
            console.log('📱 Solana Pay GET request for payment:', id);

            const payment = storageService.getPayment(id);
            if (!payment) {
                console.log('❌ Payment not found:', id);
                return res.status(404).json({
                    error: 'Payment not found'
                });
            }

            if (payment.status === 'expired') {
                console.log('⏰ Payment expired:', id);
                return res.status(410).json({
                    error: 'Payment expired'
                });
            }

            const response = {
                label: payment.label,
                icon: config.cryptonow.icon || "https://solana.com/src/img/branding/solanaLogoMark.svg"
            };

            console.log('📋 Returning payment metadata:', response);
            res.json(response);

        } catch (error) {
            console.error('❌ Get transaction error:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    /**
     * POST /api/payment/:id/transaction
     * Solana Pay: создает и возвращает транзакцию
     */
    async createTransaction(req, res) {
        try {
            const { id } = req.params;
            const { account } = req.body;

            console.log('💳 Solana Pay POST transaction request:', {
                paymentId: id,
                account: account?.slice(0, 8) + '...'
            });

            const payment = storageService.getPayment(id);
            if (!payment) {
                return res.status(404).json({
                    error: 'Payment not found'
                });
            }

            if (payment.status === 'expired') {
                return res.status(410).json({
                    error: 'Payment expired'
                });
            }

            if (payment.status === 'completed') {
                return res.status(409).json({
                    error: 'Payment already completed'
                });
            }

            if (!account) {
                return res.status(400).json({
                    error: 'Missing account field'
                });
            }

            if (!solanaService.validateAddress(account)) {
                return res.status(400).json({
                    error: 'Invalid account address'
                });
            }

            // Создаем DUAL транзакцию
            console.log('🔨 Creating DUAL Solana transaction...');
            const transaction = await solanaService.createTransaction(
                account,
                payment.recipient,
                payment.amount,
                payment.token
            );

            // Сериализуем для кошелька
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });

            // Обновляем статус платежа
            storageService.updatePaymentStatus(id, 'pending', account);

            const response = {
                transaction: serializedTransaction.toString('base64'),
                message: payment.message
            };

            console.log('✅ DUAL Transaction created and serialized:', {
                paymentId: id,
                size: `${serializedTransaction.length} bytes`,
                instructions: transaction.instructions.length,
                payer: account.slice(0, 8) + '...',
                mainTransfer: `${payment.amount} ${payment.token}`,
                feeTransfer: `${config.cryptonow.feeAmount} ${payment.token}`
            });

            res.json(response);

        } catch (error) {
            console.error('❌ Create transaction error:', error);
            res.status(500).json({
                error: 'Failed to create transaction'
            });
        }
    }

    /**
     * Проверяет статус платежа
     */
    async verifyPayment(req, res) {
        try {
            const { id } = req.params;
            const { signature } = req.body;

            console.log('🔍 Verifying payment:', { id, signature });

            const payment = storageService.getPayment(id);
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            if (payment.status === 'completed') {
                return res.json({
                    success: true,
                    status: 'completed',
                    signature: payment.signature,
                    verifiedAt: payment.verifiedAt
                });
            }

            // Проверяем транзакцию в блокчейне
            if (signature) {
                const verification = await solanaService.verifyTransaction(signature);

                if (verification.success) {
                    // Обновляем платеж как завершенный
                    storageService.updatePaymentStatus(id, 'completed', signature);

                    console.log('✅ Payment verified and completed:', id);

                    return res.json({
                        success: true,
                        status: 'completed',
                        signature,
                        blockTime: verification.blockTime,
                        slot: verification.slot
                    });
                }
            }

            res.json({
                success: false,
                status: payment.status,
                message: 'Payment not confirmed yet'
            });

        } catch (error) {
            console.error('❌ Verify payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Verification failed'
            });
        }
    }

    /**
     * Возвращает статус платежа
     */
    async getPaymentStatus(req, res) {
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
                data: {
                    id: payment.id,
                    status: payment.status,
                    merchant: payment.recipient,
                    amount: payment.amount,
                    token: payment.token,
                    signature: payment.signature,
                    createdAt: payment.createdAt,
                    verifiedAt: payment.verifiedAt,
                    expiresAt: payment.expiresAt
                }
            });

        } catch (error) {
            console.error('❌ Get payment status error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
}

export default new PaymentController();