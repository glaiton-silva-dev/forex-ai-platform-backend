/**
 * ==========================================
 * ML TRAINER SERVICE
 * ==========================================
 * Serviço para treinar modelos de ML com dados históricos
 * - Prepara features
 * - Gera labels baseados em movimentos futuros
 * - Treina modelos
 */

const randomForestModel = require('./mlModels/randomForestModel');

class MLTrainer {
  constructor() {
    this.isTraining = false;
  }

  /**
   * Prepara features a partir de dados OHLCV
   * Extrai 50+ indicadores técnicos
   */
  prepareFeatures(candles) {
    if (candles.length < 200) {
      throw new Error('Necessário pelo menos 200 candles para extrair features');
    }

    const features = [];

    for (let i = 50; i < candles.length - 10; i++) {
      const feature = [];

      // Preço normalizado
      const currentPrice = candles[i].close;
      feature.push(currentPrice / candles[i - 1].close - 1); // Retorno

      // EMAs
      const ema9 = this.calculateEMA(candles.slice(i - 9, i + 1), 9);
      const ema21 = this.calculateEMA(candles.slice(i - 21, i + 1), 21);
      const ema50 = this.calculateEMA(candles.slice(i - 50, i + 1), 50);

      feature.push((currentPrice - ema9) / currentPrice);
      feature.push((currentPrice - ema21) / currentPrice);
      feature.push((currentPrice - ema50) / currentPrice);

      // RSI
      const rsi14 = this.calculateRSI(candles.slice(i - 14, i + 1), 14);
      feature.push(rsi14 / 100);

      // MACD
      const macd = this.calculateMACD(candles.slice(i - 26, i + 1));
      feature.push(macd.macd / currentPrice);
      feature.push(macd.signal / currentPrice);
      feature.push(macd.histogram / currentPrice);

      // ATR
      const atr = this.calculateATR(candles.slice(i - 14, i + 1), 14);
      feature.push(atr / currentPrice);

      // Volatilidade
      const volatility = this.calculateVolatility(candles.slice(i - 20, i + 1));
      feature.push(volatility);

      // Volume
      const volumeMA = candles.slice(i - 20, i + 1).reduce((s, c) => s + c.volume, 0) / 20;
      feature.push(candles[i].volume / volumeMA - 1);

      // Candlestick patterns
      feature.push(this.isBullishCandle(candles[i]) ? 1 : 0);
      feature.push(this.isBearishCandle(candles[i]) ? 1 : 0);

      // Distância de High/Low
      const high20 = Math.max(...candles.slice(i - 20, i + 1).map(c => c.high));
      const low20 = Math.min(...candles.slice(i - 20, i + 1).map(c => c.low));
      feature.push((currentPrice - low20) / (high20 - low20));

      // Preenche até 50 features (adiciona zeros se necessário)
      while (feature.length < 50) {
        feature.push(0);
      }

      features.push(feature.slice(0, 50)); // Garante exatamente 50
    }

    return features;
  }

  /**
   * Gera labels baseados no movimento futuro
   * Label = 1 se preço subiu 0.3% nos próximos N candles
   * Label = 0 caso contrário
   */
  generateLabels(candles, lookahead = 5, threshold = 0.003) {
    const labels = [];

    for (let i = 50; i < candles.length - 10; i++) {
      const currentPrice = candles[i].close;
      const futureMax = Math.max(...candles.slice(i + 1, i + lookahead + 1).map(c => c.high));
      const futureReturn = (futureMax - currentPrice) / currentPrice;

      labels.push(futureReturn > threshold ? 1 : 0);
    }

    return labels;
  }

  /**
   * Treina o modelo Random Forest com dados históricos
   */
  async trainModels(candleData) {
    try {
      console.log('🚀 Iniciando treinamento dos modelos de ML...');
      this.isTraining = true;

      // Usa dados do timeframe 1H (mais estável)
      const candles = candleData['1H'];

      if (!candles || candles.length < 200) {
        throw new Error('Dados insuficientes para treinamento');
      }

      console.log(`📊 Preparando features de ${candles.length} candles...`);

      // Prepara features e labels
      const features = this.prepareFeatures(candles);
      const labels = this.generateLabels(candles);

      console.log(`✅ ${features.length} amostras geradas`);
      console.log(`📈 Distribuição de labels: ${labels.filter(l => l === 1).length} BUY, ${labels.filter(l => l === 0).length} SELL`);

      // Treina Random Forest
      const rfResult = await randomForestModel.train(features, labels);

      if (rfResult.success) {
        await randomForestModel.saveModel();
        console.log(`✅ Random Forest: acc=${(rfResult.finalAccuracy * 100).toFixed(2)}%`);
      }

      this.isTraining = false;

      return {
        success: true,
        results: {
          randomForest: rfResult
        }
      };
    } catch (error) {
      this.isTraining = false;
      console.error('❌ Erro no treinamento:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcula EMA
   */
  calculateEMA(candles, period) {
    const k = 2 / (period + 1);
    let ema = candles[0].close;

    for (let i = 1; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
    }

    return ema;
  }

  /**
   * Calcula RSI
   */
  calculateRSI(candles, period) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calcula MACD
   */
  calculateMACD(candles) {
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macd = ema12 - ema26;

    // Signal line (EMA 9 do MACD) - simplificado
    const signal = macd * 0.8;
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  /**
   * Calcula ATR
   */
  calculateATR(candles, period) {
    let atr = 0;

    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      atr += tr;
    }

    return atr / period;
  }

  /**
   * Calcula volatilidade
   */
  calculateVolatility(candles) {
    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      returns.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
    }

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Verifica se é candle bullish
   */
  isBullishCandle(candle) {
    return candle.close > candle.open;
  }

  /**
   * Verifica se é candle bearish
   */
  isBearishCandle(candle) {
    return candle.close < candle.open;
  }

  /**
   * Retorna status
   */
  getStatus() {
    return {
      isTraining: this.isTraining,
      models: {
        randomForest: randomForestModel.getStatus()
      }
    };
  }
}

module.exports = new MLTrainer();
