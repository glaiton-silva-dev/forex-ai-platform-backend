/**
 * ========================================
 * MARKET DATA SERVICE (ENHANCED)
 * ========================================
 *
 * Serviço híbrido para obter dados de mercado:
 * - Modo REAL: Integrado com OANDA API
 * - Modo SIMULATED: Dados gerados para testes
 */

const oandaService = require('./oandaService');
const alphaVantageService = require('./alphaVantageService');

class MarketDataService {
  constructor() {
    this.basePrice = 1.0850; // EURUSD base para simulação
    this.useRealData = false; // Flag para alternar entre real/simulado
    this.dataSource = null; // 'oanda' ou 'alphavantage'
  }

  /**
   * Inicializa o serviço e detecta qual fonte de dados usar
   */
  async initialize() {
    // Prioridade: Alpha Vantage > OANDA > Simulado
    if (alphaVantageService.isConfigured()) {
      this.useRealData = true;
      this.dataSource = 'alphavantage';
      console.log('✅ Alpha Vantage configurado - Usando dados REAIS');
    } else if (oandaService.isConfigured()) {
      this.useRealData = true;
      this.dataSource = 'oanda';
      console.log('✅ OANDA configurado - Usando dados REAIS');
    } else {
      this.useRealData = false;
      this.dataSource = 'simulated';
      console.log('⚠️  Nenhuma API configurada - Usando dados SIMULADOS');
      console.log('   Configure ALPHA_VANTAGE_API_KEY ou OANDA_API_KEY no .env');
    }
  }

  /**
   * Retorna dados de mercado para todos os timeframes
   * AUTOMÁTICO: Usa Alpha Vantage > OANDA > Simulado
   */
  async getMarketData(pair) {
    console.log(`Obtendo dados de mercado para ${pair}...`);

    // Tenta usar dados reais
    if (this.useRealData) {
      try {
        // Alpha Vantage
        if (this.dataSource === 'alphavantage') {
          const data = await alphaVantageService.getMultiTimeframeData(pair, ['5M', '15M', '1H', '4H']);

          // Verifica se conseguiu pelo menos 2 timeframes
          const validTimeframes = Object.keys(data).filter(tf => data[tf] && data[tf].length > 0);

          if (validTimeframes.length >= 2) {
            console.log(`✅ Alpha Vantage: ${validTimeframes.length} timeframes obtidos (${validTimeframes.join(', ')})`);

            // Preenche timeframes faltantes com dados simulados
            const simulatedData = this.getSimulatedData(pair);
            const mergedData = { ...simulatedData, ...data };

            return mergedData;
          } else {
            console.warn(`⚠️  Alpha Vantage: apenas ${validTimeframes.length} timeframes válidos, usando simulação completa`);
            return this.getSimulatedData(pair);
          }
        }

        // OANDA
        if (this.dataSource === 'oanda') {
          const instrument = this.convertToOandaFormat(pair);
          const result = await oandaService.getMultiTimeframeData(instrument);

          if (result.success) {
            console.log(`✅ Dados reais obtidos do OANDA para ${pair}`);
            return result.data;
          } else {
            console.warn('❌ Falha ao obter dados do OANDA, usando simulação');
            return this.getSimulatedData(pair);
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao acessar ${this.dataSource}:`, error.message);
        return this.getSimulatedData(pair);
      }
    }

    // Fallback: dados simulados
    return this.getSimulatedData(pair);
  }

  /**
   * Gera dados simulados (fallback ou modo teste)
   */
  getSimulatedData(pair) {
    console.log(`📊 Gerando dados simulados para ${pair}`);

    const data = {
      '5M': this.generateCandles(300, '5M'),   // 300 candles de 5min (25h)
      '15M': this.generateCandles(200, '15M'), // 200 candles de 15min (50h)
      '1H': this.generateCandles(200, '1H'),   // 200 candles de 1h (8 dias)
      '4H': this.generateCandles(200, '4H')    // 200 candles de 4h (33 dias)
    };

    return data;
  }

  /**
   * Busca preço atual em tempo real
   */
  async getCurrentPrice(pair) {
    if (this.useRealData) {
      try {
        const instrument = this.convertToOandaFormat(pair);
        const result = await oandaService.getCurrentPrice(instrument);

        if (result.success) {
          return {
            bid: result.data.bid,
            ask: result.data.ask,
            mid: (result.data.bid + result.data.ask) / 2,
            spread: result.data.spread,
            timestamp: result.data.timestamp
          };
        }
      } catch (error) {
        console.error('Erro ao obter preço atual:', error.message);
      }
    }

    // Fallback: último candle simulado
    const data = this.getSimulatedData(pair);
    const lastCandle = data['5M'][data['5M'].length - 1];
    return {
      bid: lastCandle.close - 0.00002,
      ask: lastCandle.close + 0.00002,
      mid: lastCandle.close,
      spread: 0.00004,
      timestamp: lastCandle.timestamp
    };
  }

  /**
   * Converte símbolo para formato OANDA
   * EURUSD -> EUR_USD
   */
  convertToOandaFormat(symbol) {
    if (symbol.includes('_')) return symbol;

    // Remove espaços e converte
    const clean = symbol.replace(/\s+/g, '').toUpperCase();

    if (clean.length === 6) {
      return clean.slice(0, 3) + '_' + clean.slice(3);
    }

    return symbol;
  }

  /**
   * Gera candles simulados com movimento realista
   */
  generateCandles(count, timeframe) {
    const candles = [];
    let currentPrice = this.basePrice;

    // Define tendência geral (simulação)
    const trend = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH';
    const trendStrength = 0.0001 * (timeframe === '4H' ? 3 : timeframe === '1H' ? 2 : 1);

    for (let i = 0; i < count; i++) {
      // Movimento aleatório com bias de tendência
      const randomMove = (Math.random() - 0.5) * 0.0005;
      const trendMove = trend === 'BULLISH' ? trendStrength : -trendStrength;

      currentPrice += randomMove + trendMove;

      // Gera OHLC realista
      const volatility = 0.0003 * (timeframe === '4H' ? 2 : 1);
      const open = currentPrice;
      const high = open + Math.random() * volatility;
      const low = open - Math.random() * volatility;
      const close = low + Math.random() * (high - low);

      const volume = Math.floor(Math.random() * 5000000) + 1000000;

      candles.push({
        timestamp: Date.now() - (count - i) * this.getTimeframeMs(timeframe),
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
        volume
      });

      currentPrice = close;
    }

    // Adiciona alguns padrões Smart Money propositalmente
    this.injectSmartMoneyPatterns(candles);

    return candles;
  }

  /**
   * Injeta alguns padrões Smart Money nos dados para criar setups
   */
  injectSmartMoneyPatterns(candles) {
    if (candles.length < 50) return;

    // Injeta sweep de liquidez (últimos 20 candles)
    const sweepIndex = candles.length - 15;
    const prevHigh = Math.max(...candles.slice(sweepIndex - 10, sweepIndex).map(c => c.high));

    candles[sweepIndex].high = prevHigh + 0.0002;
    candles[sweepIndex].close = prevHigh - 0.0003; // Fechou abaixo (sweep bearish)

    // Injeta order block
    const obIndex = candles.length - 10;
    candles[obIndex].open = candles[obIndex].close + 0.0005; // Candle de baixa forte
    candles[obIndex + 1].close = candles[obIndex + 1].open + 0.001; // Movimento forte pós OB

    // Injeta FVG (Fair Value Gap)
    const fvgIndex = candles.length - 7;
    candles[fvgIndex].high = candles[fvgIndex - 1].low - 0.0001; // Cria gap
  }

  /**
   * Converte timeframe em milissegundos
   */
  getTimeframeMs(timeframe) {
    const map = {
      '5M': 5 * 60 * 1000,
      '15M': 15 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000
    };
    return map[timeframe] || 60000;
  }

  /**
   * Retorna preço do último candle
   */
  getLastPrice(candles) {
    if (!candles || candles.length === 0) return null;
    return candles[candles.length - 1].close;
  }

  /**
   * Força uso de dados reais (para testes)
   */
  forceRealData(enabled = true) {
    this.useRealData = enabled && oandaService.isConfigured();
    console.log(`Modo de dados: ${this.useRealData ? 'REAL' : 'SIMULADO'}`);
  }

  /**
   * Retorna status do serviço
   */
  getStatus() {
    return {
      useRealData: this.useRealData,
      oandaConfigured: oandaService.isConfigured(),
      mode: this.useRealData ? 'REAL' : 'SIMULATED'
    };
  }
}

module.exports = MarketDataService;
