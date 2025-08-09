import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 3001,
    baseUrl: process.env.BASE_URL || 'https://zapzap666.xyz',

    solana: {
        rpcUrl: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
    },

    tokens: {
        SOL: {
            symbol: 'SOL',
            decimals: 9,
            mint: null
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