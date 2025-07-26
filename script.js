// script.js

// ... (código existente) ...

// --- DOM Elements Cache ---
const elements = {
    connectButton: document.getElementById('connect-button'),
    disconnectButton: document.getElementById('disconnect-button'),
    walletAddressText: document.getElementById('wallet-address'),
    walletMessageText: document.getElementById('wallet-message'),
    walletBalanceText: document.getElementById('wallet-balance'),
    copyAddressButton: document.getElementById('copy-address-button'), // <-- NUEVO: Botón de copiar
    transferSection: document.getElementById('transfer-section'),
    transferButton: document.getElementById('transfer-button'),
    recipientAddressInput: document.getElementById('recipient-address'),
    amountSolInput: document.getElementById('amount-sol'),
    networkSelect: document.getElementById('network-select'),
    transactionStatusText: document.getElementById('transaction-status'),
};

// ... (código existente) ...

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
    copyAddressButton.classList.add('hidden'); // <-- NUEVO: Ocultar botón de copiar por defecto
    connectButton.style.display = 'block';
    disconnectButton.classList.add('hidden');
    connectButton.disabled = false;
    transferSection.classList.add('hidden');

    if (walletState.publicKey) {
        // Estado: Billetera conectada y clave pública disponible
        walletAddressText.textContent = `Conectado: ${walletState.publicKey.toBase58()}`;
        walletMessageText.textContent = '';
        copyAddressButton.classList.remove('hidden'); // <-- NUEVO: Mostrar botón de copiar
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

// ... (código existente) ...

// --- Event Listeners ---
elements.connectButton.addEventListener('click', connectWallet);
elements.disconnectButton.addEventListener('click', disconnectWallet);
elements.transferButton.addEventListener('click', sendSol);
elements.networkSelect.addEventListener('change', updateConnection);

// <-- NUEVO: Event Listener para el botón de copiar
elements.copyAddressButton.addEventListener('click', async () => {
    if (walletState.publicKey) {
        try {
            await navigator.clipboard.writeText(walletState.publicKey.toBase58());
            elements.walletMessageText.textContent = '¡Dirección copiada al portapapeles!';
            elements.walletMessageText.className = 'message-text success';
            setTimeout(() => {
                elements.walletMessageText.textContent = '';
                elements.walletMessageText.className = 'message-text';
            }, 3000); // Borrar mensaje después de 3 segundos
        } catch (err) {
            console.error('Error al copiar la dirección:', err);
            elements.walletMessageText.textContent = 'Error al copiar la dirección.';
            elements.walletMessageText.className = 'message-text error';
        }
    }
});

// ... (resto del código existente) ...
