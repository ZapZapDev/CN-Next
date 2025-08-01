import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Сервер
    server: {
        port: process.env.PORT || 3001,
        host: process.env.HOST || 'localhost',
        baseUrl: process.env.BASE_URL || 'https://37958ba1d6c8.ngrok-free.app'
    },

    // Solana
    solana: {
        rpcUrl: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
        commitment: 'confirmed'
    },

    // Комиссии
    fees: {
        wallet: process.env.FEE_WALLET || '9E9ME8Xjrnnz5tyLqPWUbXVbPjXusEp9NdjKeugDjW5t',
        amount: parseFloat(process.env.FEE_AMOUNT) || 1.0,
        token: process.env.FEE_TOKEN || 'USDC'
    },

    // Поддерживаемые токены
    tokens: {
        SOL: {
            symbol: 'SOL',
            decimals: 9,
            mint: null // Native SOL
        },
        USDC: {
            symbol: 'USDC',
            decimals: 6,
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        },
        USDT: {
            symbol: 'USDT',
            decimals: 6,
            mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
        }
    }
};

// Валидация конфигурации
export function validateConfig() {
    if (!config.fees.wallet || config.fees.wallet === 'YOUR_WALLET_HERE') {
        throw new Error('❌ Please set FEE_WALLET in .env file');
    }

    if (config.fees.amount <= 0) {
        throw new Error('❌ Fee amount must be positive');
    }

    console.log('✅ Configuration validated');
}