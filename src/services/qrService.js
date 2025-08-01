import QRCode from 'qrcode';
import { config } from '../config/index.js';

class QRService {
    /**
     * Создать Solana Pay URL
     */
    createSolanaPayUrl(paymentId) {
        const baseUrl = config.server.baseUrl;
        return `solana:${baseUrl}/api/payment/${paymentId}/transaction`;
    }

    /**
     * Генерировать QR код
     */
    async generateQR(data, options = {}) {
        try {
            const qrOptions = {
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 256,
                ...options
            };

            const qrCodeDataUrl = await QRCode.toDataURL(data, qrOptions);
            console.log(`✅ QR code generated for: ${data.substring(0, 50)}...`);
            return qrCodeDataUrl;

        } catch (error) {
            console.error('❌ Error generating QR code:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Создать QR код для платежа
     */
    async createPaymentQR(paymentId, options = {}) {
        const solanaPayUrl = this.createSolanaPayUrl(paymentId);
        return this.generateQR(solanaPayUrl, options);
    }

    /**
     * Валидировать URL для QR кода
     */
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

export default new QRService();