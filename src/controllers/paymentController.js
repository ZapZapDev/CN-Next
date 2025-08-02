import solanaService from '../services/solanaService.js';
import qrService from '../services/qrService.js';
import storageService from '../services/storageService.js';

class PaymentController {
    async createPayment(req, res) {
        try {
            console.log('Creating payment with data:', req.body);
            const { recipient, amount, token } = req.body;

            if (!recipient || !amount || !token) {
                console.log('Missing required fields:', { recipient: !!recipient, amount: !!amount, token: !!token });
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
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
                    error: 'Token not supported'
                });
            }

            console.log('Creating payment in storage');
            const payment = storageService.createPayment(recipient, amount, token);
            console.log('Payment created:', payment.id);

            console.log('Generating QR code');
            const qrCode = await qrService.createPaymentQR(payment.id);
            console.log('QR code generated successfully');

            const response = {
                success: true,
                data: {
                    ...payment,
                    qr_code: qrCode
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

    async getTransaction(req, res) {
        try {
            const { id } = req.params;
            console.log('Getting transaction metadata for payment:', id);

            const payment = storageService.getPayment(id);

            if (!payment) {
                console.log('Payment not found:', id);
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'expired') {
                console.log('Payment expired:', id);
                return res.status(410).json({ error: 'Payment expired' });
            }

            console.log('Returning metadata for payment:', id);
            res.json({
                label: `Pay ${payment.amount} ${payment.token}`,
                icon: "https://solana.com/src/img/branding/solanaLogoMark.svg"
            });

        } catch (error) {
            console.error('Get transaction error:', error.message);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createTransaction(req, res) {
        try {
            const { id } = req.params;
            const { account } = req.body;
            console.log('Creating transaction for payment:', id, 'payer:', account);

            const payment = storageService.getPayment(id);
            if (!payment) {
                console.log('Payment not found:', id);
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'expired') {
                console.log('Payment expired:', id);
                return res.status(410).json({ error: 'Payment expired' });
            }

            if (!solanaService.validateAddress(account)) {
                console.log('Invalid payer address:', account);
                return res.status(400).json({ error: 'Invalid payer address' });
            }

            console.log('Creating Solana transaction');
            const transaction = await solanaService.createTransaction(
                account,
                payment.recipient,
                payment.amount,
                payment.token
            );

            const serializedTransaction = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false
            });

            console.log('Transaction created successfully, size:', serializedTransaction.length, 'bytes');

            res.json({
                transaction: serializedTransaction.toString('base64'),
                message: `Pay ${payment.amount} ${payment.token}`
            });

        } catch (error) {
            console.error('Create transaction error:', error.message);
            console.error('Stack:', error.stack);
            res.status(500).json({
                error: 'Transaction creation failed'
            });
        }
    }

    async verifyPayment(req, res) {
        try {
            const { id } = req.params;
            const { signature } = req.body;
            console.log('Verifying payment:', id, 'signature:', signature);

            const payment = storageService.getPayment(id);
            if (!payment) {
                console.log('Payment not found for verification:', id);
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            console.log('Verifying transaction on blockchain');
            const verification = await solanaService.verifyTransaction(signature);

            if (verification.success) {
                console.log('Payment verified successfully:', id);
                storageService.updatePaymentStatus(id, 'completed', signature);
            } else {
                console.log('Payment verification failed:', id, verification.error);
            }

            res.json(verification);

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