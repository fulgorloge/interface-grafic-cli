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
            errorMessage = 'Fondos insuficientes. Recarga tu billetera.';
        } else if (err.code === 4001 || err.message === 'User rejected the request.') {
             errorMessage = 'Transacción cancelada por el usuario.';
        }
        showStatus(errorMessage, 'error');
    } finally {
        sendSolBtn.disabled = false;
        sendSolSpinner.style.display = 'none';
    }
}

// --- Lógica de Conversión Fiat ---

// Función para actualizar el precio actual de SOL
async function fetchCurrentSolPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        if (data && data.solana && data.solana.usd) {
            solPriceUsd = data.solana.usd;
            updateBalance(); // Actualiza el balance en fiat con el nuevo precio
        }
    } catch (error) {
        console.error('Error fetching current SOL price:', error);
        // Si falla, se mantiene el precio anterior o 0
    }
}

function convertFiatToCrypto() {
    if (solPriceUsd === 0) {
        cryptoAmountInput.value = 'Cargando precio...';
        return;
    }
    const fiatVal = parseFloat(fiatAmountInput.value);
    if (!isNaN(fiatVal) && fiatVal > 0) {
        cryptoAmountInput.value = (fiatVal / solPriceUsd).toFixed(6);
    } else {
        cryptoAmountInput.value = '';
    }
}

function convertCryptoToFiat() {
    if (solPriceUsd === 0) {
        fiatAmountInput.value = 'Cargando precio...';
        return;
    }
    const cryptoVal = parseFloat(cryptoAmountInput.value);
    if (!isNaN(cryptoVal) && cryptoVal > 0) {
        fiatAmountInput.value = (cryptoVal * solPriceUsd).toFixed(2);
    } else {
        fiatAmountInput.value = '';
    }
}

// --- Lógica de Gráfico de Precios (Lightweight Charts + CoinGecko) ---

// Función para obtener datos históricos de CoinGecko
async function fetchChartDataFromCoinGecko(days) {
    const coingeckoId = 'solana'; // ID de Solana en CoinGecko
    const currency = 'usd'; // Moneda base
    
    // Usamos el endpoint ohlc para datos de velas
    const urlOhlc = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/ohlc?vs_currency=${currency}&days=${days}`;
    // Y el endpoint market_chart para datos de volumen (el ohlc no lo incluye)
    const urlMarketChart = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=${currency}&days=${days}`;

    try {
        chartLoadingOverlay.style.display = 'flex'; // Mostrar overlay de carga

        const [ohlcResponse, marketChartResponse] = await Promise.all([
            fetch(urlOhlc),
            fetch(urlMarketChart)
        ]);

        const ohlcData = await ohlcResponse.json();
        const marketChartData = await marketChartResponse.json();

        // Formatear datos OHLC para Lightweight Charts (time en segundos, OHLC)
        const formattedCandleData = ohlcData.map(item => ({
            time: item[0] / 1000, // Timestamp en ms a segundos
            open: item[1],
            high: item[2],
            low: item[3],
            close: item[4],
        }));
        
        // Formatear datos de volumen
        // market_chart.total_volumes tiene [timestamp_ms, volume]
        const formattedVolumeData = marketChartData.total_volumes.map(item => ({
            time: item[0] / 1000, // Timestamp en ms a segundos
            value: item[1],
            // Determinar color basado en si la vela de ese tiempo fue alcista o bajista
            // Esto requiere encontrar la vela correspondiente para ese tiempo
            color: (formattedCandleData.find(c => c.time === item[0] / 1000)?.open < formattedCandleData.find(c => c.time === item[0] / 1000)?.close ? getComputedStyle(document.body).getPropertyValue('--accent-main') : getComputedStyle(document.body).getPropertyValue('--error-color')) + '30'
        }));
        
        chartLoadingOverlay.style.display = 'none'; // Ocultar overlay de carga
        return { candles: formattedCandleData, volume: formattedVolumeData };
        
    } catch (error) {
        console.error('Error fetching chart data from CoinGecko:', error);
        chartLoadingOverlay.style.display = 'none'; // Ocultar overlay
        showStatus('Error al cargar datos del gráfico.', 'error');
        return { candles: [], volume: [] }; // Retorna arrays vacíos en caso de error
    }
}


function initializeChart() {
    const chartElement = document.getElementById('sol-price-chart');
    if (!chartElement) return;

    // LightweightCharts es global porque se carga vía CDN en index.html
    chartLoadingOverlay = document.getElementById('chart-loading-overlay'); // Asigna el overlay

    // Limpiar gráfico si ya existe para evitar duplicados al recargar
    if (chart) {
        chart.remove();
    }

    chart = LightweightCharts.create(chartElement, {
        width: chartElement.clientWidth,
        height: chartElement.clientHeight,
        layout: {
            background: { type: 'solid', color: getComputedStyle(document.body).getPropertyValue('--input-bg') },
            textColor: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
        },
        grid: {
            vertLines: { color: getComputedStyle(document.body).getPropertyValue('--border-color') + '20' },
            horzLines: { color: getComputedStyle(document.body).getPropertyValue('--border-color') + '20' },
        },
        timeScale: {
            borderColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
        },
        priceScale: {
            borderColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        watermark: {
            visible: true,
            fontSize: 48,
            horzAlign: 'center',
            vertAlign: 'center',
            color: getComputedStyle(document.body).getPropertyValue('--border-color') + '40',
            text: 'QuickSOL',
        }
    });

    candlestickSeries = chart.addCandlestickSeries({
        upColor: getComputedStyle(document.body).getPropertyValue('--accent-main'),
        downColor: getComputedStyle(document.body).getPropertyValue('--error-color'),
        borderVisible: false,
        wickUpColor: getComputedStyle(document.body).getPropertyValue('--accent-main'),
        wickDownColor: getComputedStyle(document.body).getPropertyValue('--error-color'),
    });

    volumeSeries = chart.addHistogramSeries({
        color: getComputedStyle(document.body).getPropertyValue('--accent-main') + '30', // Color base, se ajusta por dato
        priceFormat: {
            type: 'volume',
        },
        overlay: true,
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });

    // Manejar el redimensionamiento
    new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target.id !== 'sol-price-chart') return;
        const { width, height } = entries[0].contentRect;
        chart.resize(width, height);
    }).observe(chartElement);

    loadChartData(1); // Cargar datos de 1 día inicialmente
}

async function loadChartData(days) {
    chartLoadingOverlay.style.display = 'flex'; // Mostrar overlay de carga
    const { candles, volume } = await fetchChartDataFromCoinGecko(days);
    
    candlestickSeries.setData(candles);
    volumeSeries.setData(volume); // Setear datos de volumen
    chartLoadingOverlay.style.display = 'none'; // Ocultar overlay de carga
}

// --- Lógica de Tema ---
function applyTheme(theme) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(theme);
    localStorage.setItem('theme', theme);

    // Actualizar icono del toggle
    if (theme === 'dark-theme') {
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>'; // Icono de sol para ir al tema claro
    } else {
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>'; // Icono de luna para ir al tema oscuro
    }

    // Actualizar colores del gráfico si el gráfico ya existe
    if (chart) {
        chart.applyOptions({
            layout: {
                background: { type: 'solid', color: getComputedStyle(document.body).getPropertyValue('--input-bg') },
                textColor: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
            },
            grid: {
                vertLines: { color: getComputedStyle(document.body).getPropertyValue('--border-color') + '20' },
                horzLines: { color: getComputedStyle(document.body).getPropertyValue('--border-color') + '20' },
            },
            timeScale: {
                borderColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
            },
            priceScale: {
                borderColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
            },
            watermark: {
                color: getComputedStyle(document.body).getPropertyValue('--border-color') + '40',
            }
        });
        candlestickSeries.applyOptions({
            upColor: getComputedStyle(document.body).getPropertyValue('--accent-main'),
            downColor: getComputedStyle(document.body).getPropertyValue('--error-color'),
            wickUpColor: getComputedStyle(document.body).getPropertyValue('--accent-main'),
            wickDownColor: getComputedStyle(document.body).getPropertyValue('--error-color'),
        });
        // Re-aplicar datos para que el volumen se pinte con los colores correctos si cambian
        // lightweight-charts puede manejar esto si pasamos los datos con los colores ya definidos en 'volumeData'
        const currentActiveTimeframe = document.querySelector('.btn-chart-timeframe.active')?.dataset.timeframe || '1';
        loadChartData(parseInt(currentActiveTimeframe));
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar tema guardado o aplicar oscuro por defecto
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    applyTheme(savedTheme);

    connectPhantomBtn.addEventListener('click', () => connectWallet('phantom'));
    connectSolflareBtn.addEventListener('click', () => connectWallet('solflare'));
    disconnectWalletBtn.addEventListener('click', disconnectWallet);
    sendSolBtn.addEventListener('click', sendSol);

    fiatAmountInput.addEventListener('input', convertFiatToCrypto);
    cryptoAmountInput.addEventListener('input', convertCryptoToFiat);

    // Inicializar el gráfico y los datos de precio
    initializeChart();
    await fetchCurrentSolPrice(); // Obtener el precio actual de SOL para el conversor y balance
    setInterval(fetchCurrentSolPrice, 60000); // Actualizar precio cada minuto

    // Event listeners para botones de marco de tiempo del gráfico
    const timeframeButtons = document.querySelectorAll('.btn-chart-timeframe');
    timeframeButtons.forEach(button => {
        button.addEventListener('click', () => {
            timeframeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadChartData(parseInt(
