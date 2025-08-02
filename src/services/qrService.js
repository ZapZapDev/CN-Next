import QRCode from 'qrcode';
import { config } from '../config/index.js';

class QRService {
    // Создает Solana Pay URL для интерактивных транзакций
    createSolanaPayUrl(paymentId) {
        const transactionUrl = `${config.baseUrl}/api/payment/${paymentId}/transaction`;
        return `solana:${transactionUrl}`;
    }

    // Создает простой transfer URL для базовых переводов
    createSimpleTransferUrl(recipient, amount, token, label, message) {
        let url = `solana:${recipient}`;
        const params = new URLSearchParams();

        if (amount && token === 'SOL') {
            params.append('amount', amount.toString());
        }

        if (label) {
            params.append('label', label);
        }

        if (message) {
            params.append('message', message);
        }

        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

        return url;
    }

    async generateQR(data) {
        try {
            console.log('Generating Solana Pay QR code for:', data);
            const qrOptions = {
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 400,
                errorCorrectionLevel: 'M'
            };

            const qrCode = await QRCode.toDataURL(data, qrOptions);
            console.log('Solana Pay QR code generated successfully');
            return qrCode;
        } catch (error) {
            console.error('QR generation failed:', error.message);
            throw new Error('Failed to generate QR code');
        }
    }

    async createPaymentQR(paymentId, payment) {
        console.log('Creating Solana Pay QR for payment:', paymentId);

        // Для SPL токенов всегда используем интерактивный режим
        if (payment.token !== 'SOL') {
            const solanaPayUrl = this.createSolanaPayUrl(paymentId);
            return this.generateQR(solanaPayUrl);
        }

        // Для SOL можем использовать простой transfer или интерактивный
        // Используем интерактивный для консистентности
        const solanaPayUrl = this.createSolanaPayUrl(paymentId);
        return this.generateQR(solanaPayUrl);
    }

    // Генерирует простой QR для базовых SOL переводов (опционально)
    async createSimpleSOLQR(recipient, amount, label, message) {
        const solanaPayUrl = this.createSimpleTransferUrl(recipient, amount, 'SOL', label, message);
        return this.generateQR(solanaPayUrl);
    }
}

export default new QRService();