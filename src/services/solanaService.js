import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { config } from '../config/index.js';

class SolanaService {
    constructor() {
        this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    }

    async createTransaction(payerAddress, recipientAddress, amount, token) {
        const payer = new PublicKey(payerAddress);
        const recipient = new PublicKey(recipientAddress);
        const transaction = new Transaction();

        if (token === 'SOL') {
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: payer,
                    toPubkey: recipient,
                    lamports
                })
            );
        } else {
            const tokenConfig = config.tokens[token];
            const mint = new PublicKey(tokenConfig.mint);
            const tokenAmount = Math.floor(amount * Math.pow(10, tokenConfig.decimals));

            const payerTokenAccount = await getAssociatedTokenAddress(mint, payer);
            const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipient);

            // Check if recipient ATA exists
            const recipientAccountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
            if (!recipientAccountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        payer,
                        recipientTokenAccount,
                        recipient,
                        mint
                    )
                );
            }

            transaction.add(
                createTransferInstruction(
                    payerTokenAccount,
                    recipientTokenAccount,
                    payer,
                    tokenAmount
                )
            );
        }

        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payer;

        return transaction;
    }

    async verifyTransaction(signature) {
        try {
            const txInfo = await this.connection.getTransaction(signature, {
                commitment: 'confirmed'
            });

            if (!txInfo) {
                return {
                    success: false,
                    error: 'Transaction not found'
                };
            }

            if (txInfo.meta?.err) {
                return {
                    success: false,
                    error: 'Transaction failed'
                };
            }

            return {
                success: true,
                signature,
                blockTime: txInfo.blockTime,
                slot: txInfo.slot
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    validateAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }

    isTokenSupported(token) {
        return token in config.tokens;
    }

    getTokenInfo(token) {
        return config.tokens[token] || null;
    }

    getSupportedTokens() {
        return Object.keys(config.tokens);
    }
}

export default new SolanaService();