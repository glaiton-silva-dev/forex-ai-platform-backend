/**
 * ==========================================
 * OANDA API SERVICE
 * ==========================================
 * Serviço para integração com OANDA API v20
 * - Cotações em tempo real
 * - Dados históricos (candles)
 * - Streaming de preços
 */

const axios = require('axios');

class OandaService {
  constructor() {
    this.apiKey = process.env.OANDA_API_KEY;
    this.accountId = process.env.OANDA_ACCOUNT_ID;
    this.environment = process.env.OANDA_ENVIRONMENT || 'practice';
    this.hostname = process.env.OANDA_HOSTNAME || 'api-fxpractice.oanda.com';
    this.baseURL = `https://${this.hostname}/v3`;

    // Headers padrão
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept-Datetime-Format': 'UNIX'
    };
  }

  /**
   * Verifica se o serviço está configurado corretamente
   */
  isConfigured() {
    return !!(this.apiKey && this.accountId);
  }

  /**
   * Busca informações da conta
   */
  async getAccountInfo() {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}`,
        { headers: this.headers }
      );
      return {
        success: true,
        data: response.data.account
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Busca preço atual de um instrumento
   */
  async getCurrentPrice(instrument) {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}/pricing`,
        {
          headers: this.headers,
          params: { instruments: instrument }
        }
      );

      const price = response.data.prices[0];
      return {
        success: true,
        data: {
          instrument: price.instrument,
          bid: parseFloat(price.bids[0].price),
          ask: parseFloat(price.asks[0].price),
          spread: parseFloat(price.asks[0].price) - parseFloat(price.bids[0].price),
          timestamp: price.time
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Busca candles históricos
   * @param {string} instrument - Ex: EUR_USD
   * @param {string} granularity - M5, M15, H1, H4, D, etc
   * @param {number} count - Quantidade de candles
   */
  async getCandles(instrument, granularity, count = 500) {
    try {
      const response = await axios.get(
        `${this.baseURL}/instruments/${instrument}/candles`,
        {
          headers: this.headers,
          params: {
            granularity: granularity,
            count: count,
            price: 'MBA' // Mid, Bid, Ask
          }
        }
      );

      const candles = response.data.candles.map(candle => ({
        timestamp: new Date(candle.time).getTime(),
        open: parseFloat(candle.mid.o),
        high: parseFloat(candle.mid.h),
        low: parseFloat(candle.mid.l),
        close: parseFloat(candle.mid.c),
        volume: parseInt(candle.volume)
      }));

      return {
        success: true,
        data: candles
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Busca dados multi-timeframe para análise institucional
   * @param {string} instrument - Par de moedas
   */
  async getMultiTimeframeData(instrument) {
    try {
      // Mapeamento de timeframes
      const timeframes = {
        '5M': 'M5',
        '15M': 'M15',
        '1H': 'H1',
        '4H': 'H4'
      };

      const results = {};

      // Buscar dados para cada timeframe
      for (const [key, granularity] of Object.entries(timeframes)) {
        const candleCount = key === '4H' ? 200 : key === '1H' ? 300 : 500;
        const result = await this.getCandles(instrument, granularity, candleCount);

        if (result.success) {
          results[key] = result.data;
        } else {
          console.error(`Erro ao buscar dados ${key}:`, result.error);
          results[key] = [];
        }
      }

      return {
        success: true,
        instrument: instrument,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Converte símbolo para formato OANDA
   * Ex: EURUSD -> EUR_USD
   */
  convertSymbol(symbol) {
    if (symbol.includes('_')) return symbol;
    return symbol.slice(0, 3) + '_' + symbol.slice(3);
  }

  /**
   * Lista instrumentos disponíveis
   */
  async getAvailableInstruments() {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}/instruments`,
        { headers: this.headers }
      );

      const instruments = response.data.instruments
        .filter(i => i.type === 'CURRENCY')
        .map(i => ({
          name: i.name,
          displayName: i.displayName,
          pipLocation: i.pipLocation,
          marginRate: i.marginRate
        }));

      return {
        success: true,
        data: instruments
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Busca posições abertas
   */
  async getOpenPositions() {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}/openPositions`,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data.positions
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Busca ordens pendentes
   */
  async getPendingOrders() {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}/pendingOrders`,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data.orders
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new OandaService();
