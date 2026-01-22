/**
 * ==========================================
 * ORDER EXECUTION SERVICE
 * ==========================================
 * Serviço para execução de ordens no OANDA
 * - Market orders
 * - Limit orders
 * - Stop Loss / Take Profit
 * - Gestão de posições
 */

const axios = require('axios');

class OrderExecutionService {
  constructor() {
    this.apiKey = process.env.OANDA_API_KEY;
    this.accountId = process.env.OANDA_ACCOUNT_ID;
    this.hostname = process.env.OANDA_HOSTNAME || 'api-fxpractice.oanda.com';
    this.baseURL = `https://${this.hostname}/v3`;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Verifica se está configurado
   */
  isConfigured() {
    return !!(this.apiKey && this.accountId);
  }

  /**
   * Executa ordem MARKET
   * @param {Object} orderData
   * @param {string} orderData.instrument - Ex: EUR_USD
   * @param {string} orderData.type - BUY ou SELL
   * @param {number} orderData.units - Quantidade (positivo = buy, negativo = sell)
   * @param {number} orderData.stopLoss - Preço de stop loss
   * @param {number} orderData.takeProfit - Preço de take profit
   */
  async placeMarketOrder(orderData) {
    try {
      const { instrument, type, units, stopLoss, takeProfit } = orderData;

      // Converte BUY/SELL para unidades positivas/negativas
      const finalUnits = type === 'BUY' ? Math.abs(units) : -Math.abs(units);

      const orderPayload = {
        order: {
          type: 'MARKET',
          instrument: instrument,
          units: finalUnits.toString(),
          timeInForce: 'FOK', // Fill or Kill
          positionFill: 'DEFAULT'
        }
      };

      // Adiciona Stop Loss se fornecido
      if (stopLoss) {
        orderPayload.order.stopLossOnFill = {
          price: stopLoss.toFixed(5),
          timeInForce: 'GTC'
        };
      }

      // Adiciona Take Profit se fornecido
      if (takeProfit) {
        orderPayload.order.takeProfitOnFill = {
          price: takeProfit.toFixed(5),
          timeInForce: 'GTC'
        };
      }

      const response = await axios.post(
        `${this.baseURL}/accounts/${this.accountId}/orders`,
        orderPayload,
        { headers: this.headers }
      );

      return {
        success: true,
        data: {
          orderId: response.data.orderFillTransaction?.id,
          tradeId: response.data.orderFillTransaction?.tradeOpened?.tradeID,
          fillPrice: parseFloat(response.data.orderFillTransaction?.price),
          units: response.data.orderFillTransaction?.units,
          instrument: instrument,
          type: type,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          timestamp: response.data.orderFillTransaction?.time
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
   * Executa ordem LIMIT
   * @param {Object} orderData
   */
  async placeLimitOrder(orderData) {
    try {
      const { instrument, type, units, price, stopLoss, takeProfit } = orderData;

      const finalUnits = type === 'BUY' ? Math.abs(units) : -Math.abs(units);

      const orderPayload = {
        order: {
          type: 'LIMIT',
          instrument: instrument,
          units: finalUnits.toString(),
          price: price.toFixed(5),
          timeInForce: 'GTC', // Good Till Cancelled
          positionFill: 'DEFAULT'
        }
      };

      if (stopLoss) {
        orderPayload.order.stopLossOnFill = {
          price: stopLoss.toFixed(5),
          timeInForce: 'GTC'
        };
      }

      if (takeProfit) {
        orderPayload.order.takeProfitOnFill = {
          price: takeProfit.toFixed(5),
          timeInForce: 'GTC'
        };
      }

      const response = await axios.post(
        `${this.baseURL}/accounts/${this.accountId}/orders`,
        orderPayload,
        { headers: this.headers }
      );

      return {
        success: true,
        data: {
          orderId: response.data.orderCreateTransaction?.id,
          instrument: instrument,
          type: type,
          price: price,
          units: units,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          timestamp: response.data.orderCreateTransaction?.time
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
   * Fecha uma posição
   * @param {string} instrument - Ex: EUR_USD
   * @param {string} longOrShort - 'long' ou 'short'
   */
  async closePosition(instrument, longOrShort = 'long') {
    try {
      const response = await axios.put(
        `${this.baseURL}/accounts/${this.accountId}/positions/${instrument}/close`,
        {
          [longOrShort + 'Units']: 'ALL'
        },
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Cancela uma ordem pendente
   * @param {string} orderId
   */
  async cancelOrder(orderId) {
    try {
      const response = await axios.put(
        `${this.baseURL}/accounts/${this.accountId}/orders/${orderId}/cancel`,
        {},
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Modifica Stop Loss / Take Profit de uma trade aberta
   * @param {string} tradeId
   * @param {number} stopLoss
   * @param {number} takeProfit
   */
  async modifyTrade(tradeId, stopLoss, takeProfit) {
    try {
      const payload = {};

      if (stopLoss) {
        payload.stopLoss = {
          price: stopLoss.toFixed(5),
          timeInForce: 'GTC'
        };
      }

      if (takeProfit) {
        payload.takeProfit = {
          price: takeProfit.toFixed(5),
          timeInForce: 'GTC'
        };
      }

      const response = await axios.put(
        `${this.baseURL}/accounts/${this.accountId}/trades/${tradeId}/orders`,
        payload,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Busca detalhes de uma trade específica
   * @param {string} tradeId
   */
  async getTradeDetails(tradeId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/accounts/${this.accountId}/trades/${tradeId}`,
        { headers: this.headers }
      );

      return {
        success: true,
        data: response.data.trade
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Executa ordem baseada no sinal da IA
   * @param {Object} signal - Sinal gerado pelo decisionEngine
   */
  async executeAISignal(signal) {
    try {
      // Valida se o sinal foi aprovado
      if (signal.decision !== 'TRADE_APPROVED') {
        return {
          success: false,
          error: 'Sinal não aprovado para execução',
          reason: signal.failed_criteria
        };
      }

      // Prepara dados da ordem
      const orderData = {
        instrument: signal.instrument,
        type: signal.type, // BUY ou SELL
        units: 10000, // Padrão: 1 lote mini (ajustar conforme gestão de risco)
        stopLoss: signal.stop_loss,
        takeProfit: signal.take_profit
      };

      // Executa Market ou Limit
      let result;
      if (signal.order_type === 'MARKET') {
        result = await this.placeMarketOrder(orderData);
      } else if (signal.order_type === 'LIMIT') {
        orderData.price = signal.entry_price;
        result = await this.placeLimitOrder(orderData);
      }

      if (result.success) {
        return {
          success: true,
          execution: result.data,
          signal: signal
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new OrderExecutionService();
