import solanaService from '../services/solanaService.js';
import qrService from '../services/qrService.js';
import storageService from '../services/storageService.js';

class PaymentController {
    async createPayment(req, res) {
        try {
            console.log('Creating payment with data:', req.body);
            const { recipient, amount, token, label, message } = req.body;

            if (!recipient || !amount || !token) {
                console.log('Missing required fields:', { recipient: !!recipient, amount: !!amount, token: !!token });
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: recipient, amount, token'
                });
            }

            console.log('Validating address:', recipient);
            if (!solanaService.validateAddress(recipient)) {
                console.log('Invalid recipient address');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid recipient address'
                });
            }

            console.log('Checking token support:', token);
            if (!solanaService.isTokenSupported(token)) {
                console.log('Token not supported:', token);
                return res.status(400).json({
                    success: false,
                    error: `Token ${token} not supported`
                });
            }

            console.log('Creating payment in storage');
            const payment = storageService.createPayment(recipient, amount, token, label, message);
            console.log('Payment created:', payment.id);

            console.log('Generating Solana Pay QR code');
            const qrCode = await qrService.createPaymentQR(payment.id, payment);
            console.log('Solana Pay QR code generated successfully');

            const response = {
                success: true,
                data: {
                    ...payment,
                    qr_code: qrCode,
                    solana_pay_url: qrService.createSolanaPayUrl(payment.id)
                }
            };

            console.log('Sending response for payment:', payment.id);
            res.json(response);

        } catch (error) {
            console.error('Create payment error:', error.message);
            console.error('Stack:', error.stack);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    // GET endpoint для Solana Pay - возвращает метаданные
    async getTransaction(req, res) {
        try {
            const { id } = req.params;
            console.log('Solana Pay GET request for payment:', id);

            const payment = storageService.getPayment(id);

            if (!payment) {
                console.log('Payment not found:', id);
                return res.status(404).json({
                    error: 'Payment not found'
                });
            }

            if (payment.status === 'expired') {
                console.log('Payment expired:', id);
                return res.status(410).json({
                    error: 'Payment expired'
                });
            }

            const label = payment.label || `Pay ${payment.amount} ${payment.token}`;
            const icon = "https://solana.com/src/img/branding/solanaLogoMark.svg";

            console.log('Returning Solana Pay metadata for payment:', id);
            res.json({
                label,
                icon
            });

        } catch (error) {
            console.error('Solana Pay GET error:', error.message);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    // POST endpoint для Solana Pay - создает и возвращает транзакцию
    async createTransaction(req, res) {
        try {
            const { id } = req.params;
            const { account } = req.body;
            console.log('Solana Pay POST request for payment:', id, 'from account:', account);

            const payment = storageService.getPayment(id);
            if (!payment) {
                console.log('Payment not found:', id);
                return res.status(404).json({
                    error: 'Payment not found'
                });
            }

            if (payment.status === 'expired') {
                console.log('Payment expired:', id);
                return res.status(410).json({
                    error: 'Payment expired'
                });
            }

            if (!account) {
                console.log('Missing account in request body');
                return res.status(400).json({
                    error: 'Missing account field'
                });
            }

            if (!solanaService.validateAddress(account)) {
                console.log('Invalid account address:', account);
                return res.status(400).json({
                    error: 'Invalid account address'
                });
            }

            console.log('Creating Solana transaction for Solana Pay');
            const transaction = await solanaService.createTransaction(
                account,
                payment.recipient,
                payment.amount,
                payment.token
            );

            // Сериализуем транзакцию для кошелька
            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });

            console.log('Transaction created for Solana Pay, size:', serializedTransaction.length, 'bytes');

            const message = payment.message || `Payment of ${payment.amount} ${payment.token}`;

            // Возвращаем в формате Solana Pay
            res.json({
                transaction: serializedTransaction.toString('base64'),
                message
            });

        } catch (error) {
            console.error('Solana Pay POST error:', error.message);
            console.error('Stack:', error.stack);
            res.status(500).json({
                error: 'Failed to create transaction'
            });
        }
    }

    async verifyPayment(req, res) {
        try {
            const { id } = req.params;
            console.log('Checking payment status for:', id);

            const payment = storageService.getPayment(id);
            if (!payment) {
                console.log('Payment not found for verification:', id);
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            // Если платеж уже подтвержден, возвращаем результат
            if (payment.signature && payment.status === 'completed') {
                console.log('Payment already completed:', id, payment.signature);
                return res.json({
                    success: true,
                    signature: payment.signature,
                    blockTime: payment.verifiedAt,
                    status: 'completed'
                });
            }

            // Проверяем блокчейн на предмет входящих транзакций
            console.log('Scanning blockchain for incoming transactions...');
            const sinceTime = Math.floor(payment.createdAt.getTime() / 1000);

            const blockchainCheck = await solanaService.checkIncomingTransactions(
                payment.recipient,
                payment.amount,
                payment.token,
                sinceTime
            );

            if (blockchainCheck.success) {
                console.log('✅ Payment found on blockchain:', id, blockchainCheck.signature);

                // Обновляем статус платежа
                storageService.updatePaymentStatus(id, 'completed', blockchainCheck.signature);

                return res.json({
                    success: true,
                    signature: blockchainCheck.signature,
                    blockTime: blockchainCheck.blockTime,
                    slot: blockchainCheck.slot,
                    status: 'completed'
                });
            }

            // Платеж еще не найден
            console.log('Payment not found on blockchain yet:', id);
            return res.json({
                success: false,
                status: payment.status,
                message: 'Payment not confirmed yet'
            });

        } catch (error) {
            console.error('Verify payment error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Verification failed'
            });
        }
    }
}

export default new PaymentController();