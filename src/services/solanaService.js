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
        console.log('Creating transaction:', { payerAddress, recipientAddress, amount, token });

        const payer = new PublicKey(payerAddress);
        const recipient = new PublicKey(recipientAddress);
        const transaction = new Transaction();

        if (token === 'SOL') {
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
            console.log('Adding SOL transfer:', lamports, 'lamports');

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

            console.log('Adding SPL token transfer:', tokenAmount, 'tokens');

            const payerTokenAccount = await getAssociatedTokenAddress(mint, payer);
            const recipientTokenAccount = await getAssociatedTokenAddress(mint, recipient);

            // Check if recipient ATA exists
            try {
                const recipientAccountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
                if (!recipientAccountInfo) {
                    console.log('Creating ATA for recipient');
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            payer,
                            recipientTokenAccount,
                            recipient,
                            mint
                        )
                    );
                }
            } catch (error) {
                console.log('Error checking ATA, adding creation instruction anyway');
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

        // КРИТИЧНО: получаем свежий blockhash
        console.log('Getting recent blockhash...');
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payer;

        console.log('Transaction created with blockhash:', blockhash);
        console.log('Instructions count:', transaction.instructions.length);
        console.log('Fee payer:', payer.toBase58());

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

    // Новая функция: проверка входящих транзакций для адреса
    async checkIncomingTransactions(recipientAddress, expectedAmount, token, sinceTime) {
        try {
            console.log('Checking incoming transactions for:', recipientAddress, 'amount:', expectedAmount, token);

            const publicKey = new PublicKey(recipientAddress);

            // Получаем подтвержденные транзакции
            const signatures = await this.connection.getSignaturesForAddress(
                publicKey,
                {
                    limit: 20,
                    commitment: 'confirmed'
                }
            );

            console.log(`Found ${signatures.length} recent transactions`);

            for (const sig of signatures) {
                // Проверяем только транзакции после создания платежа
                if (sig.blockTime && sig.blockTime < sinceTime) {
                    continue;
                }

                console.log('Checking transaction:', sig.signature);

                const txInfo = await this.connection.getTransaction(sig.signature, {
                    commitment: 'confirmed'
                });

                if (!txInfo || txInfo.meta?.err) {
                    continue;
                }

                const isMatch = await this.checkTransactionMatch(
                    txInfo,
                    recipientAddress,
                    expectedAmount,
                    token
                );

                if (isMatch) {
                    console.log('✅ MATCHING TRANSACTION FOUND:', sig.signature);
                    return {
                        success: true,
                        signature: sig.signature,
                        blockTime: sig.blockTime,
                        slot: sig.slot
                    };
                }
            }

            console.log('No matching transactions found');
            return {
                success: false,
                error: 'No matching transaction found'
            };

        } catch (error) {
            console.error('Error checking incoming transactions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Проверяем соответствует ли транзакция ожидаемому платежу
    async checkTransactionMatch(txInfo, recipientAddress, expectedAmount, token) {
        try {
            const recipient = new PublicKey(recipientAddress);

            if (token === 'SOL') {
                // Проверяем SOL транзакции
                const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);

                // Проверяем изменения баланса
                const postBalances = txInfo.meta.postBalances;
                const preBalances = txInfo.meta.preBalances;

                for (let i = 0; i < txInfo.transaction.message.accountKeys.length; i++) {
                    const accountKey = txInfo.transaction.message.accountKeys[i];

                    if (accountKey.equals(recipient)) {
                        const balanceChange = postBalances[i] - preBalances[i];
                        console.log(`SOL balance change for recipient: ${balanceChange} lamports (expected: ${expectedLamports})`);

                        // Проверяем с небольшой погрешностью (±1%)
                        const tolerance = Math.max(1000, expectedLamports * 0.01);
                        if (Math.abs(balanceChange - expectedLamports) <= tolerance) {
                            return true;
                        }
                    }
                }
            } else {
                // Проверяем SPL токены
                const tokenConfig = config.tokens[token];
                const mint = new PublicKey(tokenConfig.mint);
                const expectedTokenAmount = Math.floor(expectedAmount * Math.pow(10, tokenConfig.decimals));

                // Проверяем изменения токен аккаунтов
                const tokenBalances = txInfo.meta.postTokenBalances || [];
                const preTokenBalances = txInfo.meta.preTokenBalances || [];

                for (const postBalance of tokenBalances) {
                    if (postBalance.mint === mint.toBase58() && postBalance.owner === recipient.toBase58()) {
                        const preBalance = preTokenBalances.find(
                            pb => pb.accountIndex === postBalance.accountIndex
                        );

                        const preAmount = preBalance ? parseInt(preBalance.uiTokenAmount.amount) : 0;
                        const postAmount = parseInt(postBalance.uiTokenAmount.amount);
                        const tokenChange = postAmount - preAmount;

                        console.log(`${token} balance change for recipient: ${tokenChange} (expected: ${expectedTokenAmount})`);

                        // Проверяем точное соответствие для токенов
                        if (tokenChange === expectedTokenAmount) {
                            return true;
                        }
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking transaction match:', error);
            return false;
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