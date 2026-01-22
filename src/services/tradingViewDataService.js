/**
 * ========================================
 * MARKET DATA SERVICE
 * ========================================
 *
 * Obtém dados de mercado em tempo real de múltiplas fontes:
 * 1. Binance (crypto - grátis, sem limite)
 * 2. Twelve Data API (forex, commodities, indices)
 * 3. TradingView (fallback)
 * 4. Simulação (último recurso)
 */

const axios = require('axios');
let TradingView;
try {
  TradingView = require('@mathieuc/tradingview');
} catch (e) {
  console.log('⚠️  TradingView library não disponível');
  TradingView = null;
}

class TradingViewDataService {
  constructor() {
    // TradingView client (pode falhar)
    this.client = TradingView ? new TradingView.Client() : null;
    this.activeCharts = new Map();

    // APIs externas
    this.twelveDataKey = process.env.TWELVE_DATA_API_KEY || '';
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || '';

    // Cache - 5 minutos para economizar chamadas da API
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos

    // Rate limiting para Twelve Data (8 chamadas/minuto = 1 a cada 8s)
    this.lastApiCall = 0;
    this.minInterval = 8000; // 8 segundos entre requests do Twelve Data
    this.twelveDataCallsThisMinute = 0;
    this.lastMinuteReset = Date.now();

    // Símbolos mapeados
    this.symbolMap = {
      'EURUSD': { twelveData: 'EUR/USD', binance: null, type: 'forex' },
      'GBPUSD': { twelveData: 'GBP/USD', binance: null, type: 'forex' },
      'USDJPY': { twelveData: 'USD/JPY', binance: null, type: 'forex' },
      'AUDUSD': { twelveData: 'AUD/USD', binance: null, type: 'forex' },
      'USDCAD': { twelveData: 'USD/CAD', binance: null, type: 'forex' },
      'EURGBP': { twelveData: 'EUR/GBP', binance: null, type: 'forex' },
      'EURJPY': { twelveData: 'EUR/JPY', binance: null, type: 'forex' },
      'GBPJPY': { twelveData: 'GBP/JPY', binance: null, type: 'forex' },
      'XAUUSD': { twelveData: 'XAU/USD', binance: 'PAXGUSDT', type: 'commodity' },
      'BTCUSD': { twelveData: 'BTC/USD', binance: 'BTCUSDT', type: 'crypto' },
      'ETHUSD': { twelveData: 'ETH/USD', binance: 'ETHUSDT', type: 'crypto' },
      'US30': { twelveData: 'DJI', binance: null, type: 'index' }
    };

    console.log('📊 TradingView Data Service inicializado');
    if (this.twelveDataKey) console.log('   ✓ Twelve Data API: Configurada');
    if (this.client) console.log('   ✓ TradingView: Disponível');
    console.log('   ✓ Binance: Sempre disponível (crypto)');
  }

  /**
   * Rate limit helper - Twelve Data permite 8 chamadas/minuto
   */
  async rateLimitTwelveData() {
    const now = Date.now();

    // Reset contador a cada minuto
    if (now - this.lastMinuteReset > 60000) {
      this.twelveDataCallsThisMinute = 0;
      this.lastMinuteReset = now;
    }

    // Se já fez 7 chamadas neste minuto, espera o próximo minuto
    if (this.twelveDataCallsThisMinute >= 7) {
      const waitTime = 60000 - (now - this.lastMinuteReset) + 1000;
      console.log(`⏳ Twelve Data rate limit - aguardando ${Math.ceil(waitTime/1000)}s...`);
      await new Promise(r => setTimeout(r, waitTime));
      this.twelveDataCallsThisMinute = 0;
      this.lastMinuteReset = Date.now();
    }

    this.twelveDataCallsThisMinute++;
  }

  /**
   * Rate limit genérico
   */
  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastApiCall;
    if (elapsed < 1000) {
      await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
    this.lastApiCall = Date.now();
  }

  /**
   * Cache helpers
   */
  getCached(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.time < this.cacheExpiry) {
      return item.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, time: Date.now() });
  }

  /**
   * Mapeia pares do formato interno para TradingView
   */
  mapPairToTradingView(pair) {
    const mapping = {
      // Forex
      'EURUSD': 'FX:EURUSD',
      'GBPUSD': 'FX:GBPUSD',
      'USDJPY': 'FX:USDJPY',
      'AUDUSD': 'FX:AUDUSD',
      'USDCAD': 'FX:USDCAD',
      'EURGBP': 'FX:EURGBP',
      'EURJPY': 'FX:EURJPY',
      'GBPJPY': 'FX:GBPJPY',

      // Crypto
      'BTCUSD': 'BINANCE:BTCUSDT',
      'ETHUSD': 'BINANCE:ETHUSDT',

      // Commodities
      'XAUUSD': 'OANDA:XAUUSD', // Gold

      // Indices
      'US30': 'TVC:DJI', // Dow Jones
      'SPX': 'TVC:SPX',  // S&P 500
      'NAS100': 'TVC:NDX' // NASDAQ
    };

    return mapping[pair] || `FX:${pair}`;
  }

  /**
   * Mapeia timeframe do formato interno para TradingView
   */
  mapTimeframe(timeframe) {
    const mapping = {
      '1M': '1',
      '5M': '5',
      '15M': '15',
      '30M': '30',
      '1H': '60',
      '4H': '240',
      '1D': 'D',
      '1W': 'W'
    };

    return mapping[timeframe] || '15';
  }

  /**
   * ===========================================
   * BINANCE API (crypto - grátis, sem limite)
   * ===========================================
   */
  async getBinanceCandles(symbol, interval, limit = 500) {
    const symbolInfo = this.symbolMap[symbol];
    if (!symbolInfo?.binance) return null;

    const cacheKey = `binance_${symbol}_${interval}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: symbolInfo.binance,
          interval: interval,
          limit: limit
        },
        timeout: 10000
      });

      const candles = response.data.map(c => ({
        time: c[0],
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5])
      }));

      this.setCache(cacheKey, candles);
      console.log(`✅ Binance: ${symbol} ${interval} - ${candles.length} candles [REAL]`);
      return candles;
    } catch (error) {
      console.error(`❌ Binance erro (${symbol}):`, error.message);
      return null;
    }
  }

  /**
   * ===========================================
   * TWELVE DATA API (forex, indices, commodities)
   * ===========================================
   */
  async getTwelveDataCandles(symbol, interval, outputSize = 500) {
    if (!this.twelveDataKey) return null;

    const cacheKey = `twelve_${symbol}_${interval}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log(`📦 Cache hit: ${symbol} ${interval}`);
      return cached;
    }

    await this.rateLimitTwelveData();

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
        timeout: 15000
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message);
      }

      const candles = response.data.values.map(c => ({
        time: new Date(c.datetime).getTime(),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume || 1000)
      })).reverse();

      this.setCache(cacheKey, candles);
      console.log(`✅ Twelve Data: ${symbol} ${interval} - ${candles.length} candles [REAL]`);
      return candles;
    } catch (error) {
      console.error(`❌ Twelve Data erro (${symbol}):`, error.message);
      return null;
    }
  }

  /**
   * ===========================================
   * ALPHA VANTAGE API (forex - você já tem a chave!)
   * ===========================================
   */
  async getAlphaVantageCandles(symbol, interval) {
    if (!this.alphaVantageKey) return null;

    const symbolInfo = this.symbolMap[symbol];
    if (symbolInfo?.type !== 'forex') return null;

    const cacheKey = `alpha_${symbol}_${interval}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log(`📦 Cache: ${symbol} ${interval}`);
      return cached;
    }

    // Mapeia símbolos para Alpha Vantage
    const forexMap = {
      'EURUSD': { from: 'EUR', to: 'USD' },
      'GBPUSD': { from: 'GBP', to: 'USD' },
      'USDJPY': { from: 'USD', to: 'JPY' },
      'AUDUSD': { from: 'AUD', to: 'USD' },
      'USDCAD': { from: 'USD', to: 'CAD' },
      'EURGBP': { from: 'EUR', to: 'GBP' },
      'EURJPY': { from: 'EUR', to: 'JPY' },
      'GBPJPY': { from: 'GBP', to: 'JPY' }
    };

    const pair = forexMap[symbol];
    if (!pair) return null;

    // Mapeia intervalo
    const intervalMap = {
      '5min': '5min',
      '15min': '15min',
      '30min': '30min',
      '1h': '60min',
      '4h': '60min' // Alpha Vantage máximo é 60min
    };
    const avInterval = intervalMap[interval] || '15min';

    await this.rateLimit();

    try {
      console.log(`🔄 Alpha Vantage: Buscando ${symbol}...`);

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'FX_INTRADAY',
          from_symbol: pair.from,
          to_symbol: pair.to,
          interval: avInterval,
          outputsize: 'compact',
          apikey: this.alphaVantageKey
        },
        timeout: 15000
      });

      // Verifica rate limit
      if (response.data.Note) {
        console.log('⚠️ Alpha Vantage: Rate limit atingido');
        return null;
      }

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      const timeSeries = response.data['Time Series FX (Intraday)'];
      if (!timeSeries) {
        console.log('⚠️ Alpha Vantage: Sem dados para', symbol);
        return null;
      }

      const candles = Object.entries(timeSeries).map(([datetime, values]) => ({
        time: new Date(datetime).getTime(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: 1000
      })).reverse();

      this.setCache(cacheKey, candles);
      console.log(`✅ Alpha Vantage: ${symbol} ${avInterval} - ${candles.length} candles [REAL]`);
      return candles;
    } catch (error) {
      console.error(`❌ Alpha Vantage erro (${symbol}):`, error.message);
      return null;
    }
  }

  /**
   * ===========================================
   * MÉTODO PRINCIPAL - getMarketData
   * ===========================================
   * Tenta obter dados reais de múltiplas fontes
   */
  async getMarketData(pair) {
    console.log(`\n📊 Obtendo dados de mercado para ${pair}...`);

    const symbolInfo = this.symbolMap[pair] || { type: 'forex' };
    const timeframes = ['5M', '15M', '1H', '4H'];
    const allData = {};

    // Mapeia timeframes para APIs
    const tfMap = {
      '5M': { binance: '5m', twelveData: '5min' },
      '15M': { binance: '15m', twelveData: '15min' },
      '1H': { binance: '1h', twelveData: '1h' },
      '4H': { binance: '4h', twelveData: '4h' }
    };

    let realDataCount = 0;

    for (const tf of timeframes) {
      const intervals = tfMap[tf];
      let candles = null;

      // 1. Tenta Binance primeiro para crypto (grátis, sem limite)
      if (symbolInfo.type === 'crypto' || symbolInfo.binance) {
        candles = await this.getBinanceCandles(pair, intervals.binance);
        if (candles) {
          allData[tf] = candles;
          realDataCount++;
          continue;
        }
      }

      // 2. Tenta Twelve Data para forex/commodities/indices
      if (this.twelveDataKey) {
        candles = await this.getTwelveDataCandles(pair, intervals.twelveData);
        if (candles) {
          allData[tf] = candles;
          realDataCount++;
          continue;
        }
      }

      // 3. Tenta Alpha Vantage para forex
      if (this.alphaVantageKey && symbolInfo.type === 'forex') {
        candles = await this.getAlphaVantageCandles(pair, intervals.twelveData);
        if (candles) {
          allData[tf] = candles;
          realDataCount++;
          continue;
        }
      }

      // 4. Tenta TradingView se disponível
      if (this.client) {
        try {
          candles = await this.getCandlesForTimeframe(pair, tf);
          if (candles && candles.length > 0) {
            allData[tf] = candles;
            realDataCount++;
            continue;
          }
        } catch (e) {
          // TradingView falhou, continua para simulação
        }
      }

      // 4. Último recurso: dados simulados
      console.log(`⚠️  Usando dados simulados para ${pair} ${tf}`);
      allData[tf] = this.generateCandlesForTimeframe(pair, tf);
    }

    // Log resumo
    if (realDataCount === timeframes.length) {
      console.log(`✅ ${pair}: 100% dados REAIS`);
    } else if (realDataCount > 0) {
      console.log(`⚠️  ${pair}: ${realDataCount}/${timeframes.length} timeframes com dados reais`);
    } else {
      console.log(`❌ ${pair}: Usando dados simulados (configure TWELVE_DATA_API_KEY)`);
    }

    return allData;
  }

  /**
   * Gera candles para um timeframe específico
   */
  generateCandlesForTimeframe(pair, timeframe) {
    const basePrice = this.getBasePrice(pair);
    const now = Date.now();
    const intervalMs = {
      '5M': 5 * 60 * 1000,
      '15M': 15 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000
    };
    return this.generateCandles(basePrice, 500, intervalMs[timeframe] || 15 * 60 * 1000, now);
  }

  /**
   * Obtém candles de um timeframe específico
   */
  async getCandlesForTimeframe(pair, timeframe) {
    return new Promise((resolve, reject) => {
      const tvSymbol = this.mapPairToTradingView(pair);
      const tvTimeframe = this.mapTimeframe(timeframe);

      try {
        const chart = this.client.Session.Market.Chart();

        chart.setMarket(tvSymbol, {
          timeframe: tvTimeframe,
        });

        const candles = [];
        let resolved = false;

        // Timeout de 10 segundos
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { chart.delete(); } catch (e) {}
            reject(new Error(`Timeout ao buscar ${pair} ${timeframe}`));
          }
        }, 10000);

        chart.onUpdate(() => {
          if (resolved) return;

          try {
            const periods = chart.periods;

            if (periods && periods.length > 0) {
              // Converte para o formato esperado
              periods.forEach(period => {
                candles.push({
                  time: period.time,
                  open: period.open,
                  high: period.high,
                  low: period.low,
                  close: period.close,
                  volume: period.volume || 1000
                });
              });

              // Limita a 500 candles mais recentes
              const recentCandles = candles.slice(-500);

              clearTimeout(timeout);
              resolved = true;
              try { chart.delete(); } catch (e) {}
              resolve(recentCandles);
            }
          } catch (err) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try { chart.delete(); } catch (e) {}
              reject(err);
            }
          }
        });

        chart.onError((err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try { chart.delete(); } catch (e) {}
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Gera dados simulados (fallback)
   */
  generateSimulatedData(pair) {
    console.log(`📊 Gerando dados simulados para ${pair}`);

    const basePrice = this.getBasePrice(pair);
    const now = Date.now();

    return {
      '5M': this.generateCandles(basePrice, 500, 5 * 60 * 1000, now),
      '15M': this.generateCandles(basePrice, 500, 15 * 60 * 1000, now),
      '1H': this.generateCandles(basePrice, 500, 60 * 60 * 1000, now),
      '4H': this.generateCandles(basePrice, 500, 4 * 60 * 60 * 1000, now)
    };
  }

  /**
   * Obtém preço base para simulação
   */
  getBasePrice(pair) {
    const prices = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 148.50,
      'AUDUSD': 0.6550,
      'USDCAD': 1.3550,
      'BTCUSD': 45000,
      'XAUUSD': 2050,
      'US30': 38000
    };
    return prices[pair] || 1.0000;
  }

  /**
   * Gera candles simulados
   */
  generateCandles(basePrice, count, intervalMs, endTime) {
    const candles = [];
    let price = basePrice;

    for (let i = count; i > 0; i--) {
      const time = endTime - (i * intervalMs);

      // Variação aleatória
      const change = (Math.random() - 0.5) * (basePrice * 0.002);
      price += change;

      const open = price;
      const high = price + Math.abs(change * 0.5);
      const low = price - Math.abs(change * 0.5);
      const close = price + (Math.random() - 0.5) * Math.abs(change);

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.floor(1000 + Math.random() * 5000)
      });

      price = close;
    }

    return candles;
  }

  /**
   * Limpa recursos
   */
  cleanup() {
    for (const [key, chart] of this.activeCharts) {
      try {
        chart.delete();
      } catch (err) {
        // Ignora erros ao limpar
      }
    }
    this.activeCharts.clear();
  }

  /**
   * Retorna status do serviço de dados
   */
  getStatus() {
    return {
      mode: this.twelveDataKey ? 'REAL' : 'SIMULATED',
      sources: {
        twelveData: !!this.twelveDataKey,
        tradingView: !!this.client,
        binance: true
      },
      cache: {
        entries: this.cache.size,
        expiryMs: this.cacheExpiry
      },
      rateLimit: {
        callsThisMinute: this.twelveDataCallsThisMinute,
        maxCallsPerMinute: 8
      }
    };
  }
}

module.exports = TradingViewDataService;
