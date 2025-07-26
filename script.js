// script.js

// --- Global State Management ---
const walletState = {
    type: 'none', // 'solana-native', 'metamask', 'none'
    provider: undefined, // El objeto del proveedor nativo (e.g., window.solana, window.ethereum)
    solanaSnapProvider: undefined, // El objeto del Snap de Solana si se usa MetaMask
    publicKey: undefined // La clave pública de la billetera conectada (PublicKey de solanaWeb3)
};

// ID del Snap de Solflare (debe ser el correcto para el Snap que quieres usar)
const SOLFLARE_SNAP_ID = 'npm:@solflare/solana-snap';

// --- DOM Elements Cache ---
const elements = {
    connectButton: document.getElementById('connect-button'),
    walletAddressText: document.getElementById('wallet-address'),
    walletMessageText: document.getElementById('wallet-message'),
    transferSection: document.getElementById('transfer-section'),
    transferButton: document.getElementById('transfer-button'),
    recipientAddressInput: document.getElementById('recipient-address'),
    amountSolInput: document.getElementById('amount-sol'),
    networkSelect: document.getElementById('network-select'),
    transactionStatusText: document.getElementById('transaction-status'), // <-- Esta coma es crucial y fue una de las correcciones iniciales
};

// --- Utility Functions ---

/**
 * Detecta y retorna los proveedores de billetera disponibles en el navegador.
 * @returns {Object} Objeto con posibles proveedores: solanaNative, metamask, otherEVM.
 */
const detectWalletProviders = () => {
    const providers = {
        solanaNative: undefined,
        metamask: undefined,
        otherEVM: undefined
    };

    if (typeof window.solana !== 'undefined') {
        const solanaProvider = window.solana;
        if (solanaProvider.isPhantom) {
            console.log('Phantom Wallet detectada.');
            providers.solanaNative = solanaProvider;
        } else if (solanaProvider.isSolflare) {
            console.log('Solflare Wallet detectada.');
            providers.solanaNative = solanaProvider;
        } else {
            console.log('Otra billetera Solana nativa detectada.');
            providers.solanaNative = solanaProvider;
        }
    }

    if (typeof window.ethereum !== 'undefined') {
        if (window.ethereum.isMetaMask) {
            console.log('MetaMask detectada.');
            providers.metamask = window.ethereum;
        } else {
            console.log('Otra billetera EVM (no MetaMask) detectada.');
            providers.otherEVM = window.ethereum;
        }
    }
    return providers;
};

/**
 * Actualiza la interfaz de usuario según el estado de conexión de la billetera.
 */
const updateUI = () => {
    const { connectButton, walletAddressText, walletMessageText, transferSection } = elements;

    // Resetear mensajes y estilos
    walletMessageText.className = 'message-text';
    walletAddressText.textContent = 'Estado: Desconectado';
    connectButton.style.display = 'block';
    connectButton.disabled = false;
    transferSection.classList.add('hidden'); // Ocultar la sección de transferencia por defecto

    if (walletState.publicKey) {
        // Billetera conectada y clave pública disponible
        walletAddressText.textContent = `Conectado: ${walletState.publicKey.toBase58()}`;
        walletMessageText.textContent = ''; // Limpiar mensaje de billetera
        connectButton.style.display = 'none'; // Ocultar botón de conectar
        transferSection.classList.remove('hidden'); // Mostrar sección de transferencia
    } else if (walletState.type === 'metamask' && walletState.provider) {
        // MetaMask detectada pero Snap no conectado o no tiene clave pública
        walletAddressText.textContent = 'MetaMask detectada.';
        walletMessageText.textContent = 'Necesitas el Snap de Solana (ej. Solflare Snap) en MetaMask. Haz clic en "Conectar" para intentar instalarlo y conectar.';
        connectButton.textContent = 'Conectar MetaMask (instalar Snap si es necesario)';
    } else {
        // No hay billetera conectada o detectada
        const detected = detectWalletProviders();
        if (!detected.solanaNative && !detected.metamask) {
            connectButton.disabled = true; // Deshabilitar si no hay billeteras compatibles
            walletMessageText.textContent = 'No se detectó ninguna billetera compatible. Instala Phantom, Solflare o MetaMask.';
        } else {
            walletMessageText.textContent = 'No se ha conectado una billetera Solana. Haz clic en "Conectar Billetera".';
            connectButton.textContent = 'Conectar Billetera';
        }
    }
    elements.transactionStatusText.textContent = ''; // Limpiar estado de transacción
    elements.transactionStatusText.className = 'transaction-status'; // Resetear estilos
};

/**
 * Muestra un mensaje de estado de transacción con color.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - Tipo de mensaje: 'info', 'success', 'error'.
 */
const setTransactionStatus = (message, type = 'info') => {
    elements.transactionStatusText.textContent = message;
    elements.transactionStatusText.className = `transaction-status text-${type}`;
};

// --- Wallet Connection Logic ---

/**
 * Conecta una billetera Solana nativa (Phantom, Solflare).
 * @param {Object} provider - El objeto del proveedor de la billetera.
 * @param {boolean} onlyIfTrusted - Si se debe intentar la conexión automática.
 * @returns {boolean} True si la conexión fue exitosa, false en caso contrario.
 */
const connectSolanaNative = async (provider, onlyIfTrusted = false) => {
    try {
        await provider.connect({ onlyIfTrusted });
        if (provider.publicKey) {
            walletState.type = 'solana-native';
            walletState.provider = provider;
            walletState.publicKey = provider.publicKey;
            console.log(`Billetera Solana nativa conectada: ${provider.publicKey.toBase58()}`);
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`Falló la conexión ${onlyIfTrusted ? 'automática' : 'manual'} con billetera Solana nativa:`, error);
        walletState.provider = undefined;
        walletState.publicKey = undefined;
        // No alertar en auto-connect silencioso, solo en manual
        if (!onlyIfTrusted) {
            alert(`Error al conectar billetera Solana nativa: ${error.message}`);
        }
        return false;
    }
};

/**
 * Conecta MetaMask e intenta instalar/conectar el Snap de Solana.
 * @param {Object} metamaskProvider - El objeto window.ethereum (MetaMask).
 * @returns {boolean} True si la conexión del Snap fue exitosa, false en caso contrario.
 */
const connectMetaMaskWithSolanaSnap = async (metamaskProvider) => {
    setTransactionStatus('Conectando MetaMask y Snap de Solana...', 'info');
    try {
        // 1. Conectar MetaMask (la parte EVM)
        console.log('Solicitando cuentas EVM de MetaMask...');
        await metamaskProvider.request({ method: 'eth_requestAccounts' });
        console.log('MetaMask conectada (lado EVM).');

        // 2. Solicitar el Snap de Solana
        console.log(`Solicitando el Snap de Solana (${SOLFLARE_SNAP_ID})...`);
        const snapResult = await metamaskProvider.request({
            method: 'wallet_requestSnaps',
            params: { [SOLFLARE_SNAP_ID]: {} }
        });

        if (!snapResult[SOLFLARE_SNAP_ID]) {
            throw new Error('Solana Snap no fue aprobado o instalado.');
        }

        // 3. Invocar el método de conexión del Snap de Solana
        console.log('Invocando método de conexión del Solana Snap...');
        const solanaSnapPublicKey = await metamaskProvider.request({
            method: 'wallet_invokeSnap',
            params: {
                snapId: SOLFLARE_SNAP_ID,
                request: { method: 'solana_connect' }
            }
        });

        if (!solanaSnapPublicKey || !solanaSnapPublicKey.publicKey) {
            throw new Error('El Snap de Solana no devolvió una clave pública.');
        }

        const publicKey = new solanaWeb3.PublicKey(solanaSnapPublicKey.publicKey);

        // --- Crear un proveedor para el Snap que imita a una billetera Solana ---
        walletState.solanaSnapProvider = {
            publicKey: publicKey,
            signTransaction: async (transaction) => {
                console.log('Firmando transacción con Solana Snap...');
                const { signature } = await metamaskProvider.request({
                    method: 'wallet_invokeSnap',
                    params: {
                        snapId: SOLFLARE_SNAP_ID,
                        request: {
                            method: 'solana_signTransaction',
                            params: {
                                transaction: Array.from(transaction.serialize({ requireAllSignatures: false }))
                            }
                        }
                    }
                });
                // Buffer.from es lo que causaba el error si el polyfill no estaba correctamente configurado
                transaction.addSignature(publicKey, Buffer.from(signature, 'base64'));
                return transaction;
            },
            signMessage: async (message) => {
                console.log('Firmando mensaje con Solana Snap...');
                const { signature } = await metamaskProvider.request({
                    method: 'wallet_invokeSnap',
                    params: {
                        snapId: SOLFLARE_SNAP_ID,
                        request: {
                            method: 'solana_signMessage',
                            params: { message: Buffer.from(message).toString('base64') }
                        }
                    }
                });
                return Buffer.from(signature, 'base64');
            }
        };

        walletState.type = 'metamask';
        walletState.provider = metamaskProvider; // El proveedor EVM de MetaMask
        walletState.publicKey = publicKey; // La clave pública del Snap
        console.log('MetaMask conectada y Solana Snap listo.');
        setTransactionStatus('MetaMask conectada con Solana Snap.', 'success');
        return true;
    } catch (error) {
        console.error('Error al conectar MetaMask con Solana Snap:', error);
        setTransactionStatus(`Error al conectar MetaMask con Solana Snap: ${error.message}`, 'error');
        alert(`Error al conectar MetaMask con Solana Snap. Asegúrate de tener MetaMask instalada y el Solflare Snap aprobado. Detalles: ${error.message}`);
        walletState.type = 'metamask'; // Mantener el tipo para el mensaje en UI
        walletState.solanaSnapProvider = undefined; // Resetear
        walletState.publicKey = undefined; // Resetear
        return false;
    } finally {
        updateUI(); // Asegurar que la UI se actualice después del intento de conexión
    }
};

// --- Event Listeners ---

// Lógica de carga inicial para intentar conexión automática
window.addEventListener('load', async () => {
    const { solanaNative, metamask } = detectWalletProviders();

    if (solanaNative) {
        await connectSolanaNative(solanaNative, true); // Intentar conexión silenciosa
    } else if (metamask) {
        walletState.type = 'metamask';
        walletState.provider = metamask;
        // Para MetaMask, la conexión del Snap no es automática al cargar, se hace con el botón
    }
    updateUI();
});

// Listener para el botón de conexión manual
elements.connectButton.addEventListener('click', async () => {
    elements.connectButton.disabled = true; // Deshabilitar el botón durante la conexión
    setTransactionStatus('Intentando conectar billetera...', 'info');

    const { solanaNative, metamask } = detectWalletProviders();
    let connected = false;

    if (solanaNative) {
        connected = await connectSolanaNative(solanaNative);
    } else if (metamask) {
        connected = await connectMetaMaskWithSolanaSnap(metamask);
    } else {
        setTransactionStatus('No se detectó ninguna billetera Solana compatible (Phantom, Solflare, MetaMask).', 'error');
        alert('No se detectó ninguna billetera Solana compatible (Phantom, Solflare, MetaMask).');
    }

    if (connected) {
        setTransactionStatus('Billetera conectada exitosamente.', 'success');
    } else {
        // El mensaje de error ya se estableció en las funciones de conexión
    }
    updateUI(); // Actualizar la UI después del intento de conexión
});

// Listener para el botón de transferencia SOL
elements.transferButton.addEventListener('click', async () => {
    setTransactionStatus('Procesando transacción...', 'info');
    elements.transferButton.disabled = true; // Deshabilitar botón durante la transacción

    const payerPublicKey = walletState.publicKey;
    const signerProvider = walletState.solanaSnapProvider || walletState.provider; // Usar Snap provider si existe, sino el nativo

    if (!payerPublicKey || !signerProvider) {
        setTransactionStatus('Error: Ninguna billetera Solana compatible conectada o no hay clave pública disponible.', 'error');
        elements.transferButton.disabled = false;
        return;
    }

    const recipientAddress = elements.recipientAddressInput.value.trim();
    const amountSOL = parseFloat(elements.amountSolInput.value);
    const network = elements.networkSelect.value;

    if (!recipientAddress || isNaN(amountSOL) || amountSOL <= 0) {
        setTransactionStatus('Por favor, introduce una dirección de destinatario válida y una cantidad mayor a cero.', 'error');
        elements.transferButton.disabled = false;
        return;
    }

    try {
        // IMPORTANTE: Aquí se utilizan las clases de solanaWeb3, por eso es CRÍTICO que se cargue antes en el HTML
        const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3;

        // Validar dirección del destinatario
        let toPublicKey;
        try {
            toPublicKey = new PublicKey(recipientAddress);
        } catch (e) {
            setTransactionStatus('La dirección del destinatario no es una dirección Solana válida.', 'error');
            elements.transferButton.disabled = false;
            return;
        }

        const connection = new Connection(solanaWeb3.clusterApiUrl(network));
        const lamports = amountSOL * LAMPORTS_PER_SOL;

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: payerPublicKey,
                toPubkey: toPublicKey,
                lamports: lamports,
            })
        );

        transaction.feePayer = payerPublicKey;
        transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

        // Firma la transacción usando el proveedor correcto
        const signedTransaction = await signerProvider.signTransaction(transaction);

        // Envía la transacción firmada a la red Solana
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());

        // Espera la confirmación de la transacción en la red
        setTransactionStatus(`Transacción enviada. Esperando confirmación... Firma: ${signature.substring(0, 10)}...`, 'info');
        await connection.confirmTransaction(signature, 'confirmed'); // 'confirmed' o 'finalized'

        setTransactionStatus(`¡Transacción exitosa! Firma: ${signature}`, 'success');
        console.log('Transacción exitosa:', signature);
    } catch (error) {
        console.error('Error al transferir SOL:', error);
        let errorMessage = error.message;
        if (error.code === 4001) {
            errorMessage = 'Transacción rechazada por el usuario en la billetera.';
        } else if (error.message && error.message.includes('insufficient funds')) {
             errorMessage = 'Fondos insuficientes en la billetera para la transacción.';
        }
        setTransactionStatus(`Error en la transacción: ${errorMessage}`, 'error');
    } finally {
        elements.transferButton.disabled = false; // Habilitar el botón de nuevo
    }
});
