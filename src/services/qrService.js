import QRCode from 'qrcode';
import { config } from '../config/index.js';

class QRService {
    createSolanaPayUrl(paymentId) {
        const url = `${config.baseUrl}/api/payment/${paymentId}/transaction`;
        console.log('Created Solana Pay URL:', url);
        return url;
    }

    async generateQR(data) {
        try {
            console.log('Generating QR code for URL:', data);
            const qrOptions = {
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 256
            };

            const qrCode = await QRCode.toDataURL(data, qrOptions);
            console.log('QR code generated successfully, length:', qrCode.length);
            return qrCode;
        } catch (error) {
            console.error('QR generation failed:', error.message);
            throw new Error('Failed to generate QR code');
        }
    }

    async createPaymentQR(paymentId) {
        console.log('Creating payment QR for ID:', paymentId);
        const solanaPayUrl = this.createSolanaPayUrl(paymentId);
        return this.generateQR(solanaPayUrl);
    }
}

export default new QRService();