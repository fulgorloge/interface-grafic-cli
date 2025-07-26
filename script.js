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
    disconnectButton: document.getElementById('disconnect-button'),
    walletAddressText: document.getElementById('wallet-address'),
    walletMessageText: document.getElementById('wallet-message'),
    walletBalanceText: document.getElementById('wallet-balance'),
    copyAddressButton: document.getElementById('copy-address-button'), 
    transferSection: document.getElementById('transfer-section'),
    transferButton: document.getElementById('transfer-button'),
    recipientAddressInput: document.getElementById('recipient-address'),
    amountSolInput: document.getElementById('amount-sol'),
    networkSelect: document.getElementById('network-select'),
    transactionStatusText: document.getElementById('transaction-status'),
};

// --- Utility Functions ---

/**
 * Detecta y retorna los proveedores de billetera disponibles en el navegador.
 * @returns {Object} Objeto con posibles proveedores: solanaNative (array), metamask, otherEVM.
 */
const detectWalletProviders = () => {
    const providers = {
        solanaNative: [], // Ahora un array para múltiples billeteras Solana
        metamask: undefined,
        otherEVM: undefined
    };

    if (typeof window.solana !== 'undefined') {
        if (window.solana.isPhantom) {
            console.log('Phantom Wallet detectada.');
            providers.solanaNative.push({ name: 'Phantom', provider: window.solana });
        }
        if (window.solana.isSolflare) {
            console.log('Solflare Wallet detectada.');
            providers.solanaNative.push({ name: 'Solflare', provider: window.solana });
        }
        if (window.solana.isBackpack) {
            console.log('Backpack Wallet detectada.');
            providers.solanaNative.push({ name: 'Backpack', provider: window.solana });
        }
        // Si hay una inyección de window.solana pero no es ninguna de las anteriores
        if (providers.solanaNative.length === 0 && window.solana) {
             console.log('Otra billetera Solana (window.solana compatible) detectada.');
             providers.solanaNative.push({ name: 'Solana Wallet (Genérica)', provider: window.solana });
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
    const { connectButton, disconnectButton, walletAddressText, walletMessageText, walletBalanceText, copyAddressButton, transferSection } = elements;

    // Resetear mensajes y estilos
    walletMessageText.className = 'message-text';
    walletAddressText.textContent = 'Estado: Desconectado';
    walletBalanceText.textContent = ''; // Limpiar saldo
    walletBalanceText.classList.remove('balance-display-large');
    copyAddressButton.classList.add('hidden'); // Ocultar botón de copiar por defecto
    connectButton.style.display = 'block';
    disconnectButton.classList.add('hidden');
    connectButton.disabled = false;
    transferSection.classList.add('hidden');

    if (walletState.publicKey) {
        // Estado: Billetera conectada y clave pública disponible
        walletAddressText.textContent = `Conectado: ${walletState.publicKey.toBase58()}`;
        walletMessageText.textContent = '';
        copyAddressButton.classList.remove('hidden'); // Mostrar botón de copiar
        connectButton.style.display = 'none';
        disconnectButton.classList.remove('hidden');
        transferSection.classList.remove('hidden');
        walletBalanceText.classList.add('balance-display-large');
        fetchBalance();
    } else {
        // Estado: No hay billetera conectada
        const detected = detectWalletProviders();
        let message = 'No se ha conectado una billetera Solana. Haz clic en "Conectar Billetera".';
        let buttonText = 'Conectar Billetera';
        let disableButton = false;

        if (detected.solanaNative.length > 0 || detected.metamask) {
            message = 'Selecciona una billetera para conectar.';
            if (detected.solanaNative.length > 0 && detected.metamask) {
                buttonText = 'Elegir Billetera';
            } else if (detected.solanaNative.length > 0) {
                buttonText = `Conectar ${detected.solanaNative[0].name}`;
            } else if (detected.metamask) {
                buttonText = 'Conectar MetaMask';
            }
        } else {
            disableButton = true;
            message = 'No se detectó ninguna billetera compatible. Instala Phantom, Solflare o MetaMask.';
        }

        walletAddressText.textContent = 'Estado: Desconectado';
        walletMessageText.textContent = message;
        connectButton.textContent = buttonText;
        connectButton.disabled = disableButton;
    }
    elements.transactionStatusText.textContent = '';
    elements.transactionStatusText.className = 'transaction-status';
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

/**
 * Obtiene y muestra el balance de SOL de la billetera conectada.
 */
const fetchBalance = async () => {
    const { publicKey } = walletState;
    if (!publicKey) {
        elements.walletBalanceText.textContent = '';
        return;
    }

    elements.walletBalanceText.textContent = 'Cargando saldo...';
    try {
        const { Connection, LAMPORTS_PER_SOL } = solanaWeb3;
        const network = elements.networkSelect.value;
        const connection = new Connection(solanaWeb3.clusterApiUrl(network));

        const balanceLamports = await connection.getBalance(publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

        elements.walletBalanceText.textContent = `Saldo: ${balanceSOL.toFixed(4)} SOL`;
    } catch (error) {
        console.error('Error al obtener el saldo:', error);
        elements.walletBalanceText.textContent = 'Error al cargar saldo.';
    }
};

/**
 * Restablece el estado de la billetera a "desconectado".
 */
const disconnectWallet = () => {
    // Si hay un proveedor nativo y tiene método de desconexión (ej. Phantom), usarlo
    if (walletState.provider && typeof walletState.provider.disconnect === 'function' && walletState.type === 'solana-native') {
        try {
            walletState.provider.disconnect();
            console.log('Billetera nativa desconectada.');
        } catch (error) {
            console.error('Error al desconectar billetera nativa:', error);
        }
    }
    // Para MetaMask, no hay un método de "desconexión" directo de Snap,
    // simplemente limpiamos nuestro estado local.
    walletState.type = 'none';
    walletState.provider = undefined;
    walletState.solanaSnapProvider = undefined;
    walletState.publicKey = undefined;
    updateUI(); // Actualizar la UI para reflejar el estado desconectado
    setTransactionStatus('Billetera desconectada.', 'info');
    console.log('Estado de la billetera limpiado.');
};


// --- Wallet Connection Logic ---

/**
 * Conecta una billetera Solana nativa (Phantom, Solflare, etc.).
 * @param {Object} provider - El objeto del proveedor de la billetera.
 * @param {boolean} onlyIfTrusted - Si se debe intentar la conexión automática (true para auto-conexión, false para conexión manual).
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
            fetchBalance();
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`Falló la conexión ${onlyIfTrusted ? 'automática' : 'manual'} con billetera Solana nativa:`, error);
        walletState.provider = undefined;
        walletState.publicKey = undefined;
        if (!onlyIfTrusted) { // Solo mostrar alert si es un intento de conexión manual
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
        console.log('Solicitando cuentas EVM de MetaMask...');
        await metamaskProvider.request({ method: 'eth_requestAccounts' });
        console.log('MetaMask conectada (lado EVM).');

        console.log(`Solicitando el Snap de Solana (${SOLFLARE_SNAP_ID})...`);
        const snapResult = await metamaskProvider.request({
            method: 'wallet_requestSnaps',
            params: { [SOLFLARE_SNAP_ID]: {} }
        });

        if (!snapResult[SOLFLARE_SNAP_ID]) {
            throw new Error('Solana Snap no fue aprobado o instalado.');
        }

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

        // Crear un objeto proveedor proxy para el Snap de Solana
        walletState.solanaSnapProvider = {
            publicKey: publicKey,
            signTransaction: async (transaction) => {
                console.log('Firmando transacción con Solana Snap...');
                // Convertir la transacción a un formato serializable para el Snap
                const { signature } = await metamaskProvider.request({
                    method: 'wallet_invokeSnap',
                    params: {
                        snapId: SOLFLARE_SNAP_ID,
                        request: {
                            method: 'solana_signTransaction',
                            params: {
                                // Serializar la transacción y convertir a Array para pasar por JSON RPC
                                transaction: Array.from(transaction.serialize({ requireAllSignatures: false }))
                            }
                        }
                    }
                });
                // Añadir la firma a la transacción original
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
        walletState.provider = metamaskProvider; // El proveedor EVM de MetaMask (window.ethereum)
        walletState.publicKey = publicKey; // La clave pública del Snap de Solana
        console.log('MetaMask conectada y Solana Snap listo.');
        setTransactionStatus('MetaMask conectada con Solana Snap.', 'success');
        fetchBalance();
        return true;
    } catch (error) {
        console.error('Error al conectar MetaMask con Solana Snap:', error);
        setTransactionStatus(`Error al conectar MetaMask con Solana Snap: ${error.message}`, 'error');
        alert(`Error al conectar MetaMask con Solana Snap. Asegúrate de tener MetaMask instalada y el Solflare Snap aprobado. Detalles: ${error.message}`);
        walletState.type = 'none'; // Revertir a none si falla la conexión del Snap
        walletState.solanaSnapProvider = undefined;
        walletState.publicKey = undefined;
        return false;
    } finally {
        updateUI(); // Asegurarse de actualizar la UI al final
    }
};

/**
 * Función que maneja el proceso de conexión de billetera (llamada desde el botón).
 */
const connectWallet = async () => {
    elements.connectButton.disabled = true;
    setTransactionStatus('Preparando conexión...', 'info');

    const { solanaNative, metamask } = detectWalletProviders();
    let connected = false;

    // Crear la lista de opciones para el usuario
    let walletOptions = [];
    solanaNative.forEach(w => walletOptions.push({ name: w.name, type: 'solana-native', provider: w.provider }));
    if (metamask) {
        walletOptions.push({ name: 'MetaMask', type: 'metamask', provider: metamask });
    }

    if (walletOptions.length === 0) {
        setTransactionStatus('No se detectó ninguna billetera Solana compatible.', 'error');
        alert('No se detectó ninguna billetera Solana compatible (Phantom, Solflare, MetaMask).');
        updateUI();
        return;
    }

    let choice = null;
    if (walletOptions.length === 1) {
        choice = 1; // Si solo hay una opción, la seleccionamos automáticamente
        console.log(`Conectando automáticamente con la única opción: ${walletOptions[0].name}`);
    } else {
        // Si hay múltiples opciones, pedimos al usuario que elija
        let promptMessage = "Múltiples billeteras detectadas. Elige una opción para conectar:\n\n";
        walletOptions.forEach((option, index) => {
            promptMessage += `${index + 1}. ${option.name} (${option.type === 'metamask' ? 'con Solana Snap' : 'Nativa Solana'})\n`;
        });
        promptMessage += `\nIntroduce el número de tu elección:`;

        const rawChoice = prompt(promptMessage);
        choice = parseInt(rawChoice);

        if (isNaN(choice) || choice < 1 || choice > walletOptions.length) {
            alert('Elección inválida o conexión cancelada.');
            setTransactionStatus('Conexión cancelada o elección inválida.', 'error');
            updateUI();
            return;
        }
    }

    const selectedWallet = walletOptions[choice - 1];

    if (selectedWallet.type === 'metamask') {
        connected = await connectMetaMaskWithSolanaSnap(selectedWallet.provider);
    } else { // 'solana-native'
        connected = await connectSolanaNative(selectedWallet.provider);
    }

    if (connected) {
        setTransactionStatus('Billetera conectada exitosamente.', 'success');
    } else {
        // El mensaje de error ya se estableció en las funciones de conexión
    }
    updateUI();
};

/**
 * Función que maneja el envío de SOL.
 */
const sendSol = async () => {
    setTransactionStatus('Procesando transacción...', 'info');
    elements.transferButton.disabled = true;

    const payerPublicKey = walletState.publicKey;
    // El proveedor para firmar será el solanaSnapProvider si MetaMask está en uso, de lo contrario, el provider nativo
    const signerProvider = walletState.solanaSnapProvider || walletState.provider;

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
        const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3;

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

        // Verificar saldo antes de enviar (opcional, pero buena práctica)
        const balanceLamports = await connection.getBalance(payerPublicKey);
        if (balanceLamports < lamports) {
            setTransactionStatus('Fondos insuficientes en la billetera para esta transacción.', 'error');
            elements.transferButton.disabled = false;
            return;
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: payerPublicKey,
                toPubkey: toPublicKey,
                lamports: lamports,
            })
        );

        transaction.feePayer = payerPublicKey; // Establecer al pagador de la tarifa
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;

        // La billetera conectada firmará la transacción
        const signedTransaction = await signerProvider.signTransaction(transaction);

        // Enviar la transacción firmada
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());

        setTransactionStatus(`Transacción enviada. Esperando confirmación... Firma: ${signature.substring(0, 10)}...`, 'info');
        console.log(`Transacción enviada: ${signature}`);

        // Esperar confirmación
        await connection.confirmTransaction({
            signature: signature,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight
        }, 'confirmed'); // 'confirmed' es suficiente para la mayoría de los casos

        setTransactionStatus(`¡Transacción exitosa! Firma: ${signature}`, 'success');
        console.log('Transacción exitosa:', signature);
        fetchBalance(); // Actualizar el saldo después de la transacción

    } catch (error) {
        console.error('Error al transferir SOL:', error);
        let errorMessage = error.message;
        if (error.code === 4001) {
            errorMessage = 'Transacción rechazada por el usuario en la billetera.';
        } else if (error.message && error.message.includes('insufficient funds')) {
             errorMessage = 'Fondos insuficientes en la billetera para la transacción.';
        } else if (error.message && error.message.includes('invalid public key')) {
             errorMessage = 'La dirección del destinatario no es una dirección Solana válida.';
        }
        setTransactionStatus(`Error en la transacción: ${errorMessage}`, 'error');
    } finally {
        elements.transferButton.disabled = false;
    }
};

/**
 * Función que maneja el cambio de red (actualiza el balance si está conectada).
 */
const updateConnection = () => {
    if (walletState.publicKey) {
        fetchBalance(); // Recargar el saldo cuando la red cambia
    }
};


// --- Event Listeners ---

// Lógica de carga inicial para intentar conexión automática
window.addEventListener('load', async () => {
    const { solanaNative } = detectWalletProviders();

    if (solanaNative.length > 0) {
        // Intentar conexión automática con la primera billetera Solana nativa detectada
        console.log(`Intentando conexión automática con ${solanaNative[0].name}...`);
        await connectSolanaNative(solanaNative[0].provider, true); // true para onlyIfTrusted
    }
    updateUI(); // Actualizar la UI después del intento de conexión inicial
});

elements.connectButton.addEventListener('click', connectWallet);
elements.disconnectButton.addEventListener('click', disconnectWallet);
elements.transferButton.addEventListener('click', sendSol);
elements.networkSelect.addEventListener('change', updateConnection);

elements.copyAddressButton.addEventListener('click', async () => {
    if (walletState.publicKey) {
        try {
            await navigator.clipboard.writeText(walletState.publicKey.toBase58());
            elements.walletMessageText.textContent = '¡Dirección copiada al portapapeles!';
            elements.walletMessageText.className = 'message-text text-success'; // Usar clase de éxito
            setTimeout(() => {
                elements.walletMessageText.textContent = '';
                elements.walletMessageText.className = 'message-text';
            }, 3000); // Borrar mensaje después de 3 segundos
        } catch (err) {
            console.error('Error al copiar la dirección:', err);
            elements.walletMessageText.textContent = 'Error al copiar la dirección.';
            elements.walletMessageText.className = 'message-text text-error'; // Usar clase de error
        }
    }
});
