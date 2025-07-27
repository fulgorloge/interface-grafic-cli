// Accede a la librería de Solana (cargada globalmente en index.html)
const solanaWeb3 = SolanaWeb3;

let provider; // Wallet adapter (Phantom o Solflare)
let publicKey; // Public key del usuario

// --- Elementos del DOM ---
const statusMessage = document.getElementById('status-message');
const walletAddressElem = document.getElementById('wallet-address');
const solBalanceElem = document.getElementById('sol-balance');
const fiatBalanceElem = document.getElementById('fiat-balance');
const disconnectWalletBtn = document.getElementById('disconnect-wallet');
const connectPhantomBtn = document.getElementById('connect-phantom');
const connectSolflareBtn = document.getElementById('connect-solflare');
const recipientAddressInput = document.getElementById('recipient-address');
const sendAmountInput = document.getElementById('send-amount');
const sendSolBtn = document.getElementById('send-sol-btn');
const sendSolSpinner = document.getElementById('send-sol-spinner');
const transactionStatusElem = document.getElementById('transaction-status');
const recipientAddressError = document.getElementById('recipient-address-error');
const sendAmountError = document.getElementById('send-amount-error');
const fiatAmountInput = document.getElementById('fiat-amount');
const cryptoAmountInput = document.getElementById('crypto-amount');
const transactionHistoryElem = document.getElementById('transaction-history');
const themeToggleBtn = document.getElementById('theme-toggle');

// --- Variables Globales para el Gráfico ---
let chart;
let candlestickSeries;
let volumeSeries;
let chartLoadingOverlay; // Para el overlay de carga del gráfico

// --- Precios (para conversión fiat) ---
let solPriceUsd = 0; // Se actualizará al obtener datos del gráfico o por CoinGecko

// --- Funciones de Utilidad ---

// Función para mostrar mensajes de estado
function showStatus(message, type = 'info') {
    transactionStatusElem.innerHTML = message; // Usar innerHTML para enlaces
    transactionStatusElem.className = `transaction-status status-${type}`;
    transactionStatusElem.style.display = 'block';
}

// Limpiar errores de validación
function clearValidationErrors() {
    recipientAddressError.textContent = '';
    sendAmountError.textContent = '';
}

// Formatear direcciones para visualización
function formatAddress(address) {
    if (!address) return 'No conectada';
    const addr = address.toString();
    return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;
}

// --- Lógica de Conexión de Billetera ---

async function connectWallet(walletName) {
    try {
        if (walletName === 'phantom') {
            if (window.phantom?.solana?.isPhantom) {
                provider = window.phantom.solana;
            } else {
                showStatus('Phantom no encontrado. Instala la extensión.', 'error');
                window.open('https://phantom.app/', '_blank');
                return;
            }
        } else if (walletName === 'solflare') {
            if (window.solflare?.isSolflare) {
                provider = window.solflare;
            } else {
                showStatus('Solflare no encontrado. Instala la extensión.', 'error');
                window.open('https://solflare.com/', '_blank');
                return;
            }
        }

        if (provider) {
            const resp = await provider.connect();
            publicKey = resp.publicKey;
            statusMessage.textContent = 'Billetera conectada exitosamente.';
            walletAddressElem.textContent = formatAddress(publicKey);
            disconnectWalletBtn.style.display = 'block';
            connectPhantomBtn.style.display = 'none';
            connectSolflareBtn.style.display = 'none';
            await updateBalance();
            // await loadTransactionHistory(); // Descomentar cuando implementes el historial real
            clearValidationErrors(); // Limpiar errores al conectar
        } else {
            showStatus('Proveedor de billetera no encontrado.', 'error');
        }
    } catch (err) {
        console.error("Error al conectar la billetera:", err);
        showStatus(`Error al conectar: ${err.message || 'Desconocido'}`, 'error');
    }
}

async function disconnectWallet() {
    try {
        if (provider && publicKey) {
            await provider.disconnect();
            publicKey = null;
            provider = null;
            statusMessage.textContent = 'Billetera desconectada.';
            walletAddressElem.textContent = 'No conectada';
            solBalanceElem.textContent = '0.00 SOL';
            fiatBalanceElem.textContent = '~$0.00 USD';
            disconnectWalletBtn.style.display = 'none';
            connectPhantomBtn.style.display = 'block';
            connectSolflareBtn.style.display = 'block';
            transactionStatusElem.style.display = 'none';
            transactionHistoryElem.innerHTML = '<p class="text-secondary">Conecta tu billetera para ver el historial.</p>';
        }
    } catch (err) {
        console.error("Error al desconectar:", err);
        showStatus(`Error al desconectar: ${err.message || 'Desconocido'}`, 'error');
    }
}

async function updateBalance() {
    if (!publicKey) {
        solBalanceElem.textContent = '0.00 SOL';
        fiatBalanceElem.textContent = '~$0.00 USD';
        return;
    }

    try {
        // Instanciar la conexión a Solana
        const connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl('mainnet-beta'),
            'confirmed'
        );
        const balanceLamports = await connection.getBalance(publicKey);
        const balanceSOL = balanceLamports / solanaWeb3.LAMPORTS_PER_SOL;
        solBalanceElem.textContent = `${balanceSOL.toFixed(4)} SOL`;

        if (solPriceUsd > 0) {
            fiatBalanceElem.textContent = `~$${(balanceSOL * solPriceUsd).toFixed(2)} USD`;
        } else {
            fiatBalanceElem.textContent = `Cargando precio...`;
        }

    } catch (err) {
        console.error("Error al obtener balance:", err);
        showStatus(`Error al cargar balance: ${err.message || 'Desconocido'}`, 'error');
    }
}

// --- Lógica de Envío de SOL ---

async function sendSol() {
    clearValidationErrors();
    transactionStatusElem.style.display = 'none';

    if (!publicKey || !provider) {
        showStatus('Por favor, conecta tu billetera primero.', 'warning');
        return;
    }

    const recipientAddress = recipientAddressInput.value.trim();
    const sendAmount = parseFloat(sendAmountInput.value);

    let isValid = true;

    // Validar dirección
    try {
        new solanaWeb3.PublicKey(recipientAddress);
    } catch (e) {
        recipientAddressError.textContent = 'Dirección de destinatario inválida.';
        isValid = false;
    }

    // Validar cantidad
    if (isNaN(sendAmount) || sendAmount <= 0) {
        sendAmountError.textContent = 'Ingresa una cantidad válida para enviar.';
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    sendSolBtn.disabled = true;
    sendSolSpinner.style.display = 'inline-block';
    showStatus('Enviando transacción...', 'info');

    try {
        const connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl('mainnet-beta'),
            'confirmed'
        );

        const lamportsToSend = sendAmount * solanaWeb3.LAMPORTS_PER_SOL;

        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: new solanaWeb3.PublicKey(recipientAddress),
                lamports: lamportsToSend,
            })
        );

        // Obtener el blockhash reciente
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signedTransaction = await provider.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());

        showStatus(`Transacción enviada. Confirmando...`);
        await connection.confirmTransaction({ signature, blockhash }, 'finalized');

        showStatus(`Transacción confirmada: <a href="https://solscan.io/tx/${signature}" target="_blank" style="color: inherit; text-decoration: underline;">Ver en Solscan</a>`, 'success');

        // Limpiar campos y actualizar balance
        recipientAddressInput.value = '';
        sendAmountInput.value = '';
        await updateBalance();

    } catch (err) {
        console.error("Error al enviar SOL:", err);
        let errorMessage = `Error de transacción: ${err.message || 'Desconocido'}.`;
        if (err.message && err.message.includes('insufficient funds')) {
