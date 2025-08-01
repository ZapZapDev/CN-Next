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
        this.connection = new Connection(config.solana.rpcUrl, config.solana.commitment);
        this.usdcMint = new PublicKey(config.tokens.USDC.mint);
    }

    /**
     * Создать транзакцию с основным платежом + комиссией
     */
    async createDualTransaction(payerAddress, recipientAddress, amount, token) {
        try {
            console.log(`🔧 Creating ${token} transaction with fee...`);

            const payer = new PublicKey(payerAddress);
            const recipient = new PublicKey(recipientAddress);
            const feeWallet = new PublicKey(config.fees.wallet);

            const transaction = new Transaction();

            // 1. Добавляем основной платеж
            await this._addMainPayment(transaction, payer, recipient, amount, token);

            // 2. Добавляем комиссию (всегда USDC)
            await this._addFeePayment(transaction, payer, feeWallet);

            // 3. Получаем recent blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = payer;

            console.log(`✅ Transaction created with ${transaction.instructions.length} instructions`);
            return transaction;

        } catch (error) {
            console.error('❌ Error creating transaction:', error);
            throw error;
        }
    }

    /**
     * Добавить основной платеж в транзакцию
     */
    async _addMainPayment(transaction, payer, recipient, amount, token) {
        if (token === 'SOL') {
            // SOL перевод
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: payer,
                    toPubkey: recipient,
                    lamports
                })
            );
            console.log(`💰 Added SOL transfer: ${amount} SOL`);

        } else {
            // SPL Token перевод
            const tokenConfig = config.tokens[token];
            if (!tokenConfig) {
                throw new Error(`Unsupported token: ${token}`);
            }

            const mint = new PublicKey(tokenConfig.mint);
            const tokenAmount = Math.floor(amount * Math.pow(10, tokenConfig.decimals));

            const payerTokenAccount = await getAssociatedTokenAddress(mint, payer);
            const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipient);

            // Создаем ATA для получателя если нужно
            await this._ensureTokenAccount(transaction, payer, recipient, mint, recipientTokenAccount);

            // Добавляем перевод токенов
            transaction.add(
                createTransferInstruction(
                    payerTokenAccount,
                    recipientTokenAccount,
                    payer,
                    tokenAmount
                )
            );
            console.log(`💰 Added ${token} transfer: ${amount} ${token}`);
        }
    }

    /**
     * Добавить комиссию в транзакцию
     */
    async _addFeePayment(transaction, payer, feeWallet) {
        const feeAmount = Math.floor(config.fees.amount * Math.pow(10, config.tokens.USDC.decimals));

        const payerUsdcAccount = await getAssociatedTokenAddress(this.usdcMint, payer);
        const feeUsdcAccount = await getAssociatedTokenAddress(this.usdcMint, feeWallet);

        // Создаем ATA для fee кошелька если нужно
        await this._ensureTokenAccount(transaction, payer, feeWallet, this.usdcMint, feeUsdcAccount);

        // Добавляем fee перевод
        transaction.add(
            createTransferInstruction(
                payerUsdcAccount,
                feeUsdcAccount,
                payer,
                feeAmount
            )
        );
        console.log(`💳 Added fee transfer: ${config.fees.amount} USDC`);
    }

    /**
     * Убедиться что токен аккаунт существует
     */
    async _ensureTokenAccount(transaction, payer, owner, mint, tokenAccount) {
        try {
            const accountInfo = await this.connection.getAccountInfo(tokenAccount);
            if (!accountInfo) {
                // Аккаунт не существует - создаем
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        payer,
                        tokenAccount,
                        owner,
                        mint
                    )
                );
                console.log(`🔧 Added ATA creation for ${owner.toBase58()}`);
            }
        } catch (error) {
            // В случае ошибки добавляем инструкцию создания
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    payer,
                    tokenAccount,
                    owner,
                    mint
                )
            );
            console.log(`🔧 Added ATA creation (fallback) for ${owner.toBase58()}`);
        }
    }

    /**
     * Валидировать Solana адрес
     */
    validateAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Проверить поддерживается ли токен
     */
    isTokenSupported(token) {
        return token in config.tokens;
    }

    /**
     * Получить информацию о токене
     */
    getTokenInfo(token) {
        return config.tokens[token] || null;
    }

    /**
     * Получить список поддерживаемых токенов
     */
    getSupportedTokens() {
        return Object.keys(config.tokens);
    }
}

export default new SolanaService();