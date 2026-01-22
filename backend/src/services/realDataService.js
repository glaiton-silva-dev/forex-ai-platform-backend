/**
 * ========================================
 * REAL DATA SERVICE
 * ========================================
 *
 * Serviço para obter dados reais de mercado
 * Fontes: Twelve Data, Alpha Vantage, Binance
 */

const axios = require('axios');

class RealDataService {
  constructor() {
    // APIs gratuitas
    this.twelveDataKey = process.env.TWELVE_DATA_API_KEY || '';
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    this.finnhubKey = process.env.FINNHUB_API_KEY || '';

    // Cache para reduzir chamadas de API
    this.cache = new Map();
    this.cacheExpiry = 60000; // 1 minuto

    // Rate limiting
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 segundo entre requests
    this.alphaVantageLastRequest = 0;
    this.alphaVantageMinInterval = 12000; // 12 segundos (5 requests/min)

    // Mapeamento de símbolos
    this.symbolMap = {
      'EURUSD': { twelveData: 'EUR/USD', alphaVantage: { from: 'EUR', to: 'USD' }, binance: null, type: 'forex' },
      'GBPUSD': { twelveData: 'GBP/USD', alphaVantage: { from: 'GBP', to: 'USD' }, binance: null, type: 'forex' },
      'USDJPY': { twelveData: 'USD/JPY', alphaVantage: { from: 'USD', to: 'JPY' }, binance: null, type: 'forex' },
      'AUDUSD': { twelveData: 'AUD/USD', alphaVantage: { from: 'AUD', to: 'USD' }, binance: null, type: 'forex' },
      'USDCAD': { twelveData: 'USD/CAD', alphaVantage: { from: 'USD', to: 'CAD' }, binance: null, type: 'forex' },
      'EURGBP': { twelveData: 'EUR/GBP', alphaVantage: { from: 'EUR', to: 'GBP' }, binance: null, type: 'forex' },
      'EURJPY': { twelveData: 'EUR/JPY', alphaVantage: { from: 'EUR', to: 'JPY' }, binance: null, type: 'forex' },
      'GBPJPY': { twelveData: 'GBP/JPY', alphaVantage: { from: 'GBP', to: 'JPY' }, binance: null, type: 'forex' },
      'XAUUSD': { twelveData: 'XAU/USD', alphaVantage: null, binance: 'PAXGUSDT', type: 'commodity' },
      'BTCUSD': { twelveData: 'BTC/USD', alphaVantage: null, binance: 'BTCUSDT', type: 'crypto' },
      'ETHUSD': { twelveData: 'ETH/USD', alphaVantage: null, binance: 'ETHUSDT', type: 'crypto' },
      'US30': { twelveData: 'DJI', alphaVantage: null, binance: null, type: 'index' }
    };

    console.log('📊 Real Data Service inicializado');
    if (this.alphaVantageKey) {
      console.log('   ✓ Alpha Vantage API configurada');
    }
    if (this.twelveDataKey) {
      console.log('   ✓ Twelve Data API configurada');
    }
    console.log('   ✓ Binance API (sempre disponível para crypto)');
  }

  /**
   * Rate limit para Alpha Vantage (5 requests/min)
   */
  async waitForAlphaVantageRateLimit() {
    const now = Date.now();
    const elapsed = now - this.alphaVantageLastRequest;
    if (elapsed < this.alphaVantageMinInterval) {
      const waitTime = this.alphaVantageMinInterval - elapsed;
      console.log(`⏳ Aguardando Alpha Vantage rate limit (${Math.ceil(waitTime/1000)}s)...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.alphaVantageLastRequest = Date.now();
  }

  /**
   * Obtém dados de candles do Alpha Vantage (FOREX)
   */
  async getAlphaVantageForexCandles(symbol, interval = '15min', outputSize = 'compact') {
    const symbolInfo = this.symbolMap[symbol];
    if (!symbolInfo?.alphaVantage) {
      throw new Error(`${symbol} não suportado pelo Alpha Vantage`);
    }

    const cacheKey = `alpha_${symbol}_${interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`📦 Cache hit: ${symbol}`);
      return cached;
    }

    if (!this.alphaVantageKey) {
      throw new Error('ALPHA_VANTAGE_API_KEY não configurada');
    }

    await this.waitForAlphaVantageRateLimit();

    const { from, to } = symbolInfo.alphaVantage;

    // Mapeia intervalo
    const intervalMap = {
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '60min': '60min'
    };
    const avInterval = intervalMap[interval] || '15min';

    try {
      console.log(`🔄 Alpha Vantage: Buscando ${symbol} (${from}/${to})...`);

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'FX_INTRADAY',
          from_symbol: from,
          to_symbol: to,
          interval: avInterval,
          outputsize: outputSize, // 'compact' = 100, 'full' = full history
          apikey: this.alphaVantageKey
        },
        timeout: 15000
      });

      // Verifica erro de rate limit
      if (response.data.Note) {
        throw new Error('Alpha Vantage rate limit atingido');
      }

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      const timeSeriesKey = `Time Series FX (Intraday)`;
      const timeSeries = response.data[timeSeriesKey];

      if (!timeSeries) {
        console.log('Alpha Vantage response:', JSON.stringify(response.data).slice(0, 200));
        throw new Error('Dados não encontrados na resposta');
      }

      // Converte para formato padrão
      const candles = Object.entries(timeSeries).map(([datetime, values]) => ({
        time: new Date(datetime).getTime(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: 1000 // Forex não tem volume real
      })).reverse(); // Mais antigo primeiro

      this.setCache(cacheKey, candles);
      console.log(`✅ Alpha Vantage: ${symbol} - ${candles.length} candles [REAL]`);
      return candles;

    } catch (error) {
      console.error(`❌ Alpha Vantage erro (${symbol}):`, error.message);
      throw error;
    }
  }

  /**
   * Obtém preço atual do Alpha Vantage
   */
  async getAlphaVantageForexPrice(symbol) {
    const symbolInfo = this.symbolMap[symbol];
    if (!symbolInfo?.alphaVantage) {
      throw new Error(`${symbol} não suportado pelo Alpha Vantage`);
    }

    const cacheKey = `alpha_price_${symbol}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.alphaVantageKey) {
      throw new Error('ALPHA_VANTAGE_API_KEY não configurada');
    }

    await this.waitForAlphaVantageRateLimit();

    const { from, to } = symbolInfo.alphaVantage;

    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: from,
          to_currency: to,
          apikey: this.alphaVantageKey
        },
        timeout: 10000
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      const rateData = response.data['Realtime Currency Exchange Rate'];
      if (!rateData) {
        throw new Error('Dados de preço não encontrados');
      }

      const price = parseFloat(rateData['5. Exchange Rate']);
      this.setCache(cacheKey, price);
      console.log(`✅ Alpha Vantage Price: ${symbol} = ${price} [REAL]`);
      return price;

    } catch (error) {
      console.error(`❌ Alpha Vantage price erro (${symbol}):`, error.message);
      throw error;
    }
  }

  /**
   * Aguarda rate limit
   */
  async waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  /**
   * Verifica cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  /**
   * Salva no cache
   */
  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Obtém dados de candles do Twelve Data
   */
  async getTwelveDataCandles(symbol, interval = '15min', outputSize = 100) {
    const cacheKey = `twelve_${symbol}_${interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.twelveDataKey) {
      throw new Error('TWELVE_DATA_API_KEY não configurada');
    }

    await this.waitForRateLimit();

    const symbolInfo = this.symbolMap[symbol];
    const apiSymbol = symbolInfo?.twelveData || symbol;

    try {
      const response = await axios.get('https://api.twelvedata.com/time_series', {
        params: {
          symbol: apiSymbol,
          interval: interval,
          outputsize: outputSize,
          apikey: this.twelveDataKey
        },
        timeout: 10000
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message);
      }

      const candles = response.data.values.map(candle => ({
        time: new Date(candle.datetime).getTime(),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume || 0)
      })).reverse(); // API retorna do mais recente para o mais antigo

      this.setCache(cacheKey, candles);
      console.log(`✅ Twelve Data: ${symbol} - ${candles.length} candles obtidos`);
      return candles;

    } catch (error) {
      console.error(`❌ Twelve Data erro (${symbol}):`, error.message);
      throw error;
    }
  }

  /**
   * Obtém preço atual do Twelve Data
   */
  async getTwelveDataPrice(symbol) {
    const cacheKey = `price_${symbol}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.twelveDataKey) {
      throw new Error('TWELVE_DATA_API_KEY não configurada');
    }

    await this.waitForRateLimit();

    const symbolInfo = this.symbolMap[symbol];
    const apiSymbol = symbolInfo?.twelveData || symbol;

    try {
      const response = await axios.get('https://api.twelvedata.com/price', {
        params: {
          symbol: apiSymbol,
          apikey: this.twelveDataKey
        },
        timeout: 5000
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message);
      }

      const price = parseFloat(response.data.price);
      this.setCache(cacheKey, price);
      return price;

    } catch (error) {
      console.error(`❌ Twelve Data price erro (${symbol}):`, error.message);
      throw error;
    }
  }

  /**
   * Obtém dados da Binance para crypto
   */
  async getBinanceCandles(symbol, interval = '15m', limit = 100) {
    const symbolInfo = this.symbolMap[symbol];
    if (!symbolInfo?.binance) {
      throw new Error(`${symbol} não disponível na Binance`);
    }

    const cacheKey = `binance_${symbol}_${interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    await this.waitForRateLimit();

    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: symbolInfo.binance,
          interval: interval,
          limit: limit
        },
        timeout: 10000
      });

      const candles = response.data.map(candle => ({
        time: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      this.setCache(cacheKey, candles);
      console.log(`✅ Binance: ${symbol} - ${candles.length} candles obtidos`);
      return candles;

    } catch (error) {
      console.error(`❌ Binance erro (${symbol}):`, error.message);
      throw error;
    }
  }

  /**
   * Obtém preço atual da Binance
   */
  async getBinancePrice(symbol) {
    const symbolInfo = this.symbolMap[symbol];
    if (!symbolInfo?.binance) {
      throw new Error(`${symbol} não disponível na Binance`);
    }

    const cacheKey = `binance_price_${symbol}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: { symbol: symbolInfo.binance },
        timeout: 5000
      });

      const price = parseFloat(response.data.price);
      this.setCache(cacheKey, price);
      return price;

    } catch (error) {
      console.error(`❌ Binance price erro (${symbol}):`, error.message);
      throw error;
    }
  }

  /**
   * Método principal - obtém candles de qualquer fonte
   */
  async getCandles(symbol, timeframe = '15M', count = 100) {
    const symbolInfo = this.symbolMap[symbol];

    // Converte timeframe para formato das APIs
    const intervalMap = {
      '1M': { twelveData: '1min', binance: '1m', alphaVantage: '1min' },
      '5M': { twelveData: '5min', binance: '5m', alphaVantage: '5min' },
      '15M': { twelveData: '15min', binance: '15m', alphaVantage: '15min' },
      '30M': { twelveData: '30min', binance: '30m', alphaVantage: '30min' },
      '1H': { twelveData: '1h', binance: '1h', alphaVantage: '60min' },
      '4H': { twelveData: '4h', binance: '4h', alphaVantage: '60min' },
      '1D': { twelveData: '1day', binance: '1d', alphaVantage: '60min' }
    };

    const intervals = intervalMap[timeframe] || intervalMap['15M'];

    // 1. Tenta Binance primeiro para crypto (grátis e sem limite)
    if ((symbolInfo?.type === 'crypto' || symbolInfo?.binance) && symbolInfo.binance) {
      try {
        return await this.getBinanceCandles(symbol, intervals.binance, count);
      } catch (error) {
        console.log(`⚠️ Binance falhou para ${symbol}`);
      }
    }

    // 2. Tenta Twelve Data (se configurado)
    if (this.twelveDataKey) {
      try {
        return await this.getTwelveDataCandles(symbol, intervals.twelveData, count);
      } catch (error) {
        console.log(`⚠️ Twelve Data falhou para ${symbol}`);
      }
    }

    // 3. Tenta Alpha Vantage para forex (você tem a chave!)
    if (this.alphaVantageKey && symbolInfo?.alphaVantage) {
      try {
        return await this.getAlphaVantageForexCandles(symbol, intervals.alphaVantage, 'compact');
      } catch (error) {
        console.log(`⚠️ Alpha Vantage falhou para ${symbol}: ${error.message}`);
      }
    }

    throw new Error(`Não foi possível obter dados para ${symbol}`);
  }

  /**
   * Obtém preço atual
   */
  async getCurrentPrice(symbol) {
    const symbolInfo = this.symbolMap[symbol];

    // Tenta Binance primeiro para crypto
    if (symbolInfo?.type === 'crypto' && symbolInfo.binance) {
      try {
        return await this.getBinancePrice(symbol);
      } catch (error) {
        console.log(`⚠️ Binance price falhou para ${symbol}`);
      }
    }

    // Tenta Twelve Data
    if (this.twelveDataKey) {
      try {
        return await this.getTwelveDataPrice(symbol);
      } catch (error) {
        console.log(`⚠️ Twelve Data price falhou para ${symbol}`);
      }
    }

    throw new Error(`Não foi possível obter preço para ${symbol}`);
  }

  /**
   * Obtém dados de múltiplos símbolos
   */
  async getMultipleCandles(symbols, timeframe = '15M', count = 100) {
    const results = {};

    for (const symbol of symbols) {
      try {
        results[symbol] = await this.getCandles(symbol, timeframe, count);
      } catch (error) {
        console.error(`❌ Erro ao obter ${symbol}:`, error.message);
        results[symbol] = null;
      }
    }

    return results;
  }

  /**
   * Obtém indicadores técnicos do Twelve Data
   */
  async getTechnicalIndicator(symbol, indicator, interval = '15min', params = {}) {
    if (!this.twelveDataKey) {
      throw new Error('TWELVE_DATA_API_KEY não configurada');
    }

    const cacheKey = `indicator_${symbol}_${indicator}_${interval}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    await this.waitForRateLimit();

    const symbolInfo = this.symbolMap[symbol];
    const apiSymbol = symbolInfo?.twelveData || symbol;

    try {
      const response = await axios.get(`https://api.twelvedata.com/${indicator}`, {
        params: {
          symbol: apiSymbol,
          interval: interval,
          apikey: this.twelveDataKey,
          ...params
        },
        timeout: 10000
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message);
      }

      this.setCache(cacheKey, response.data);
      return response.data;

    } catch (error) {
      console.error(`❌ Indicator erro (${symbol} ${indicator}):`, error.message);
      throw error;
    }
  }

  /**
   * Obtém RSI
   */
  async getRSI(symbol, interval = '15min', period = 14) {
    return this.getTechnicalIndicator(symbol, 'rsi', interval, { time_period: period });
  }

  /**
   * Obtém MACD
   */
  async getMACD(symbol, interval = '15min') {
    return this.getTechnicalIndicator(symbol, 'macd', interval);
  }

  /**
   * Obtém Bollinger Bands
   */
  async getBollingerBands(symbol, interval = '15min', period = 20) {
    return this.getTechnicalIndicator(symbol, 'bbands', interval, { time_period: period });
  }

  /**
   * Obtém ATR
   */
  async getATR(symbol, interval = '15min', period = 14) {
    return this.getTechnicalIndicator(symbol, 'atr', interval, { time_period: period });
  }

  /**
   * Verifica status das APIs
   */
  async checkApiStatus() {
    const status = {
      twelveData: false,
      binance: false
    };

    // Testa Binance (sempre grátis)
    try {
      await axios.get('https://api.binance.com/api/v3/ping', { timeout: 5000 });
      status.binance = true;
    } catch (error) {
      status.binance = false;
    }

    // Testa Twelve Data
    if (this.twelveDataKey) {
      try {
        const response = await axios.get('https://api.twelvedata.com/api_usage', {
          params: { apikey: this.twelveDataKey },
          timeout: 5000
        });
        status.twelveData = true;
        status.twelveDataUsage = response.data;
      } catch (error) {
        status.twelveData = false;
      }
    }

    return status;
  }
}

module.exports = RealDataService;
