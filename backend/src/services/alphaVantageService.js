/**
 * ========================================
 * ALPHA VANTAGE SERVICE
 * ========================================
 * Serviço para buscar dados reais de Forex via Alpha Vantage API
 */

const axios = require('axios');

class AlphaVantageService {
  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
  }

  /**
   * Rate limiting: Alpha Vantage permite 5 requests/min (free tier)
   */
  async waitForRateLimit() {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    const minInterval = 12000; // 12 segundos entre requests (5 por minuto)

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limit: aguardando ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Converte par de moedas para formato Alpha Vantage
   * EURUSD -> EUR/USD
   */
  formatPair(pair) {
    if (pair.includes('/')) return pair;

    const from = pair.substring(0, 3);
    const to = pair.substring(3, 6);
    return `${from}/${to}`;
  }

  /**
   * Converte timeframe para função Alpha Vantage
   */
  getIntervalFunction(timeframe) {
    const map = {
      '1M': { function: 'FX_INTRADAY', interval: '1min' },
      '5M': { function: 'FX_INTRADAY', interval: '5min' },
      '15M': { function: 'FX_INTRADAY', interval: '15min' },
      '30M': { function: 'FX_INTRADAY', interval: '30min' },
      '1H': { function: 'FX_INTRADAY', interval: '60min' },
      '4H': { function: 'FX_DAILY', interval: null }, // Vamos processar do daily
      'D': { function: 'FX_DAILY', interval: null }
    };

    return map[timeframe] || map['15M'];
  }

  /**
   * Busca dados intraday
   */
  async getIntradayData(pair, timeframe = '15M') {
    await this.waitForRateLimit();

    const formattedPair = this.formatPair(pair);
    const [from_currency, to_currency] = formattedPair.split('/');
    const { function: func, interval } = this.getIntervalFunction(timeframe);

    try {
      console.log(`📊 Alpha Vantage: Buscando ${pair} (${timeframe})...`);

      const params = {
        function: func,
        from_symbol: from_currency,
        to_symbol: to_currency,
        apikey: this.apiKey,
        outputsize: 'full' // Máximo de dados
      };

      if (interval) {
        params.interval = interval;
      }

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 10000
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        console.warn('⚠️  Alpha Vantage: Limite de API atingido:', response.data['Note']);
        return null;
      }

      // Processar dados
      const timeSeriesKey = Object.keys(response.data).find(key =>
        key.includes('Time Series')
      );

      if (!timeSeriesKey) {
        console.error('❌ Resposta inesperada:', Object.keys(response.data));
        return null;
      }

      const timeSeries = response.data[timeSeriesKey];
      const candles = this.parseTimeSeries(timeSeries);

      console.log(`✅ Alpha Vantage: ${candles.length} candles obtidos`);
      return candles;

    } catch (error) {
      console.error('❌ Erro Alpha Vantage:', error.message);
      return null;
    }
  }

  /**
   * Parseia time series para formato padrão
   */
  parseTimeSeries(timeSeries) {
    const candles = [];

    for (const [timestamp, data] of Object.entries(timeSeries)) {
      candles.push({
        time: new Date(timestamp).getTime(),
        timestamp: timestamp,
        open: parseFloat(data['1. open']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: parseFloat(data['4. close']),
        volume: 0 // Forex não tem volume real na Alpha Vantage
      });
    }

    // Ordenar por tempo (mais antigo primeiro)
    return candles.sort((a, b) => a.time - b.time);
  }

  /**
   * Busca cotação em tempo real (FX_QUOTE)
   */
  async getQuote(pair) {
    await this.waitForRateLimit();

    const formattedPair = this.formatPair(pair);
    const [from_currency, to_currency] = formattedPair.split('/');

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency,
          to_currency,
          apikey: this.apiKey
        },
        timeout: 10000
      });

      const realtimeData = response.data['Realtime Currency Exchange Rate'];

      if (!realtimeData) {
        return null;
      }

      return {
        pair: pair,
        bid: parseFloat(realtimeData['8. Bid Price']),
        ask: parseFloat(realtimeData['9. Ask Price']),
        price: parseFloat(realtimeData['5. Exchange Rate']),
        timestamp: realtimeData['6. Last Refreshed']
      };

    } catch (error) {
      console.error('❌ Erro ao buscar cotação:', error.message);
      return null;
    }
  }

  /**
   * Busca dados para múltiplos timeframes
   */
  async getMultiTimeframeData(pair, timeframes = ['5M', '15M', '1H', '4H']) {
    const data = {};

    for (const tf of timeframes) {
      const candles = await this.getIntradayData(pair, tf);
      if (candles) {
        data[tf] = candles;
      }
    }

    return data;
  }

  /**
   * Verifica se API está configurada
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey !== '';
  }
}

module.exports = new AlphaVantageService();
