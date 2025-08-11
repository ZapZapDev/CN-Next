import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 3001,
    baseUrl: process.env.BASE_URL || 'https://zapzap666.xyz',

    solana: {
        rpcUrl: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
        network: 'mainnet-beta'
    },

    // CryptoNow platform settings
    cryptonow: {
        // ЗАМЕНИТЕ НА ВАШ КОШЕЛЕК ДЛЯ КОМИССИЙ
        feeWallet: process.env.CRYPTONOW_FEE_WALLET || 'CVgddgrLcuMovYTk4hvRA11SfM9adPx5EGYLh7AZS92X',
        feeAmount: parseFloat(process.env.CRYPTONOW_FEE_AMOUNT) || 1.0, // 1 USDC по умолчанию

        // Branding
        name: 'CryptoNow',
        icon: 'https://cryptonow.com/icon.png', // замените на ваш
        website: 'https://cryptonow.com'
    },

    // Поддерживаемые токены
    tokens: {
        SOL: {
            symbol: 'SOL',
            name: 'Solana',
            decimals: 9,
            mint: null // Native SOL
        },
        USDC: {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC mainnet
        },
        USDT: {
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6,
            mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT mainnet
        }
    },

    // Payment settings
    payment: {
        defaultExpirationMinutes: 30,
        maxAmount: 1000000, // $1M limit
        minAmount: 0.01
    }
};