class StorageService {
    constructor() {
        // В памяти хранилище (для продакшена используй Redis/Database)
        this.payments = new Map();
        this.cleanup();
    }

    /**
     * Создать новый платеж
     */
    createPayment(recipient, amount, token) {
        const paymentId = this._generatePaymentId();
        const payment = {
            id: paymentId,
            recipient,
            amount: parseFloat(amount),
            token,
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 минут
            feeWallet: null,
            feeAmount: null,
            signature: null,
            verifiedAt: null
        };

        this.payments.set(paymentId, payment);
        console.log(`💾 Payment stored: ${paymentId}`);
        return payment;
    }

    /**
     * Получить платеж по ID
     */
    getPayment(paymentId) {
        const payment = this.payments.get(paymentId);
        if (!payment) {
            console.log(`❌ Payment not found: ${paymentId}`);
            return null;
        }

        // Проверяем не истек ли платеж
        if (this._isExpired(payment)) {
            payment.status = 'expired';
            console.log(`⏰ Payment expired: ${paymentId}`);
        }

        return payment;
    }

    /**
     * Обновить статус платежа
     */
    updatePaymentStatus(paymentId, status, signature = null) {
        const payment = this.payments.get(paymentId);
        if (!payment) {
            return false;
        }

        payment.status = status;
        if (signature) {
            payment.signature = signature;
            payment.verifiedAt = new Date();
        }

        console.log(`🔄 Payment status updated: ${paymentId} → ${status}`);
        return true;
    }

    /**
     * Получить все платежи (для отладки)
     */
    getAllPayments() {
        return Array.from(this.payments.values());
    }

    /**
     * Получить статистику
     */
    getStats() {
        const all = Array.from(this.payments.values());
        const stats = {
            total: all.length,
            pending: all.filter(p => p.status === 'pending' && !this._isExpired(p)).length,
            completed: all.filter(p => p.status === 'completed').length,
            expired: all.filter(p => p.status === 'expired' || this._isExpired(p)).length,
            failed: all.filter(p => p.status === 'failed').length
        };

        console.log(`📊 Payment stats:`, stats);
        return stats;
    }

    /**
     * Очистка просроченных платежей
     */
    cleanup() {
        setInterval(() => {
            const now = new Date();
            let cleaned = 0;

            for (const [id, payment] of this.payments.entries()) {
                if (payment.expiresAt < now) {
                    this.payments.delete(id);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} expired payments`);
            }
        }, 5 * 60 * 1000); // Каждые 5 минут
    }

    /**
     * Генерировать уникальный ID платежа
     */
    _generatePaymentId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `pay_${timestamp}_${random}`;
    }

    /**
     * Проверить истек ли платеж
     */
    _isExpired(payment) {
        return new Date() > payment.expiresAt;
    }

    /**
     * Валидировать данные платежа
     */
    validatePaymentData(recipient, amount, token) {
        const errors = [];

        if (!recipient || typeof recipient !== 'string') {
            errors.push('Invalid recipient address');
        }

        if (!amount || isNaN(amount) || amount <= 0) {
            errors.push('Invalid amount');
        }

        if (!token || typeof token !== 'string') {
            errors.push('Invalid token');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

export default new StorageService();