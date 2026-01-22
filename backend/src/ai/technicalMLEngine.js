/**
 * ========================================
 * TECHNICAL ML ENGINE - Motor de Machine Learning Técnico
 * ========================================
 *
 * Implementa modelos de Machine Learning para análise técnica:
 * - Random Forest (TensorFlow.js - REAL)
 * - LSTM (TensorFlow.js - REAL)
 * - Gradient Boosting (simulado)
 *
 * Com sistema de aprendizado contínuo que:
 * - Aprende com feedback de trades reais
 * - Ajusta pesos dinamicamente
 * - Re-treina automaticamente
 *
 * Analisa 50+ indicadores técnicos institucionais
 * e retorna probabilidade de movimento (BUY/SELL)
 */

const randomForestModel = require('./mlModels/randomForestModel');
const lstmModel = require('./mlModels/lstmModel');
const continuousLearning = require('./mlModels/continuousLearning');

class TechnicalMLEngine {
  constructor() {
    this.models = {
      randomForest: randomForestModel,
      lstm: lstmModel,
      gradientBoosting: null
    };

    // Pesos iniciais - serão atualizados pelo sistema de aprendizado contínuo
    this.weights = {
      randomForest: 0.30,
      lstm: 0.35,
      gradientBoosting: 0.35
    };

    this.minProbability = 65; // Mínimo 65% para sinal válido
    this.useRealML = false; // Flag para usar ML real
    this.continuousLearning = continuousLearning;
  }

  /**
   * Inicializa e carrega modelos treinados
   */
  async initialize() {
    console.log('🤖 Inicializando Technical ML Engine (v2.0 - Real Learning)...');

    // Inicializa sistema de aprendizado contínuo
    await this.continuousLearning.initialize();

    // Carrega pesos atualizados do sistema de aprendizado
    const dynamicWeights = this.continuousLearning.getModelWeights();
    if (dynamicWeights.lastUpdated) {
      this.weights = {
        randomForest: dynamicWeights.randomForest,
        lstm: dynamicWeights.lstm,
        gradientBoosting: dynamicWeights.gradientBoosting
      };
      console.log('📊 Pesos dinâmicos carregados do aprendizado contínuo');
    }

    // Tenta carregar Random Forest treinado
    const rfLoaded = await this.models.randomForest.loadModel();

    if (rfLoaded.success) {
      this.useRealML = true;
      console.log('✅ Random Forest carregado - Usando ML REAL');
    } else {
      console.log('⚠️  Random Forest não treinado - Usando predições simuladas');
    }

    // Tenta carregar LSTM treinado
    const lstmLoaded = await this.models.lstm.loadModel();

    if (lstmLoaded.success) {
      this.useRealML = true;
      console.log('✅ LSTM carregado - Usando ML REAL');
    } else {
      console.log('⚠️  LSTM não treinado - Usando predições simuladas');
    }

    console.log('📊 Pesos dos modelos:');
    console.log(`   Random Forest: ${(this.weights.randomForest * 100).toFixed(1)}%`);
    console.log(`   LSTM: ${(this.weights.lstm * 100).toFixed(1)}%`);
    console.log(`   Gradient Boosting: ${(this.weights.gradientBoosting * 100).toFixed(1)}%`);
  }

  /**
   * Análise completa com múltiplos modelos
   */
  async analyze(candles, timeframe) {
    try {
      // Calcula todos os indicadores técnicos
      const indicators = this.calculateAllIndicators(candles, timeframe);

      // Prepara features para os modelos
      const features = this.prepareFeatures(indicators);

      // Executa predições de cada modelo (todos são async agora)
      const predictions = {
        randomForest: await this.predictRandomForest(features),
        gradientBoosting: this.predictGradientBoosting(features),
        lstm: await this.predictLSTM(features, candles) // Passa candles para LSTM real
      };

      // Combina predições com pesos
      const finalPrediction = this.combinePredictions(predictions);

      const result = {
        timeframe,
        timestamp: new Date(),
        indicators,
        predictions,
        finalPrediction,
        confidence: finalPrediction.probability,
        direction: finalPrediction.direction,
        validSignal: finalPrediction.probability >= this.minProbability
      };

      // Log para debug
      console.log(`📈 ML Analysis: ${timeframe} - ${result.confidence}% ${result.direction}`);

      return result;
    } catch (error) {
      console.error('❌ Erro no Technical ML Engine:', error.message);
      // Retorna resultado fallback
      return {
        timeframe,
        timestamp: new Date(),
        indicators: {},
        predictions: {},
        finalPrediction: { probability: 50, direction: 'NEUTRAL' },
        confidence: 50,
        direction: 'NEUTRAL',
        validSignal: false,
        error: error.message
      };
    }
  }

  /**
   * Calcula todos os 50+ indicadores técnicos institucionais
   */
  calculateAllIndicators(candles, timeframe) {
    if (candles.length < 200) {
      throw new Error('Insuficientes candles para análise técnica (mínimo 200)');
    }

    const indicators = {
      // ===== TREND INDICATORS =====
      ema9: this.calculateEMA(candles, 9),
      ema21: this.calculateEMA(candles, 21),
      ema50: this.calculateEMA(candles, 50),
      ema200: this.calculateEMA(candles, 200),
      sma20: this.calculateSMA(candles, 20),
      sma50: this.calculateSMA(candles, 50),

      // ===== MOMENTUM INDICATORS =====
      rsi14: this.calculateRSI(candles, 14),
      rsi7: this.calculateRSI(candles, 7),
      rsi21: this.calculateRSI(candles, 21),
      macd: this.calculateMACD(candles),
      stochastic: this.calculateStochastic(candles, 14, 3),
      cci: this.calculateCCI(candles, 20),
      roc: this.calculateROC(candles, 12),
      momentum: this.calculateMomentum(candles, 10),

      // ===== VOLATILITY INDICATORS =====
      atr14: this.calculateATR(candles, 14),
      atr21: this.calculateATR(candles, 21),
      bollingerBands: this.calculateBollingerBands(candles, 20, 2),
      keltnerChannels: this.calculateKeltnerChannels(candles, 20, 2),
      donchianChannels: this.calculateDonchianChannels(candles, 20),

      // ===== VOLUME INDICATORS =====
      volumeSMA: this.calculateVolumeSMA(candles, 20),
      volumeRatio: this.calculateVolumeRatio(candles),
      obv: this.calculateOBV(candles),
      vwap: this.calculateVWAP(candles),
      mfi: this.calculateMFI(candles, 14),

      // ===== INSTITUTIONAL INDICATORS =====
      institutionalTrend: this.calculateInstitutionalTrend(candles),
      trendStrength: this.calculateTrendStrength(candles),
      volatilityRelative: this.calculateRelativeVolatility(candles),
      pricePosition: this.calculatePricePosition(candles),
      candlePattern: this.detectCandlePatterns(candles),

      // ===== FIBONACCI & SUPPORT/RESISTANCE =====
      fibonacciLevels: this.calculateFibonacciLevels(candles),
      pivotPoints: this.calculatePivotPoints(candles),
      supportResistance: this.detectSupportResistance(candles),

      // ===== MULTI-TIMEFRAME INDICATORS =====
      higherTFTrend: this.getHigherTimeframeTrend(timeframe),
      dailyRange: this.calculateDailyRange(candles),
      weeklyHighLow: this.calculateWeeklyHighLow(candles),

      // ===== SPREAD & EFFICIENCY =====
      spreadAnalysis: this.analyzeSpread(candles),
      marketEfficiency: this.calculateMarketEfficiency(candles),

      // ===== DIVERGENCES =====
      rsiDivergence: this.detectRSIDivergence(candles),
      macdDivergence: this.detectMACDDivergence(candles)
    };

    return indicators;
  }

  // ============================================
  // TREND INDICATORS
  // ============================================

  calculateEMA(candles, period) {
    const values = candles.map(c => c.close);
    const multiplier = 2 / (period + 1);
    const ema = [values[0]];

    for (let i = 1; i < values.length; i++) {
      ema.push((values[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }

    const current = ema[ema.length - 1];
    const previous = ema[ema.length - 2];
    const currentPrice = values[values.length - 1];

    return {
      value: current,
      slope: current - previous,
      above: currentPrice > current,
      trend: current > previous ? 'BULLISH' : 'BEARISH',
      distance: ((currentPrice - current) / current) * 100
    };
  }

  calculateSMA(candles, period) {
    const values = candles.map(c => c.close);
    const sma = [];

    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    const current = sma[sma.length - 1];
    const previous = sma[sma.length - 2];
    const currentPrice = values[values.length - 1];

    return {
      value: current,
      slope: current - previous,
      above: currentPrice > current,
      trend: current > previous ? 'BULLISH' : 'BEARISH'
    };
  }

  // ============================================
  // MOMENTUM INDICATORS
  // ============================================

  calculateRSI(candles, period = 14) {
    const closes = candles.map(c => c.close);
    const changes = [];

    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // Primeira média
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }

    avgGain /= period;
    avgLoss /= period;

    // RSI suavizado
    for (let i = period; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = (avgGain * (period - 1) + changes[i]) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
      }
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return {
      value: rsi,
      overbought: rsi > 70,
      oversold: rsi < 30,
      bullish: rsi > 50 && rsi < 70,
      bearish: rsi < 50 && rsi > 30,
      signal: rsi > 60 ? 'BUY' : rsi < 40 ? 'SELL' : 'NEUTRAL'
    };
  }

  calculateMACD(candles, fast = 12, slow = 26, signal = 9) {
    const ema12 = this.calculateEMA(candles, fast);
    const ema26 = this.calculateEMA(candles, slow);

    const macdLine = ema12.value - ema26.value;

    // Simplificação: signal line seria EMA do MACD
    const signalLine = macdLine * 0.9; // Aproximação
    const histogram = macdLine - signalLine;

    return {
      macdLine,
      signalLine,
      histogram,
      bullishCross: macdLine > signalLine && histogram > 0,
      bearishCross: macdLine < signalLine && histogram < 0,
      signal: histogram > 0 ? 'BUY' : 'SELL'
    };
  }

  calculateStochastic(candles, kPeriod = 14, dPeriod = 3) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const currentClose = closes[closes.length - 1];
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // D é média móvel de K (simplificado)
    const d = k * 0.9;

    return {
      k,
      d,
      overbought: k > 80,
      oversold: k < 20,
      signal: k > 50 ? 'BUY' : 'SELL'
    };
  }

  calculateCCI(candles, period = 20) {
    const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
    const recent = typicalPrices.slice(-period);

    const sma = recent.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = recent.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    const currentTP = typicalPrices[typicalPrices.length - 1];
    const cci = (currentTP - sma) / (0.015 * meanDeviation);

    return {
      value: cci,
      overbought: cci > 100,
      oversold: cci < -100,
      signal: cci > 0 ? 'BUY' : 'SELL'
    };
  }

  calculateROC(candles, period = 12) {
    const closes = candles.map(c => c.close);
    const current = closes[closes.length - 1];
    const past = closes[closes.length - 1 - period];

    const roc = ((current - past) / past) * 100;

    return {
      value: roc,
      positive: roc > 0,
      signal: roc > 0 ? 'BUY' : 'SELL',
      strength: Math.abs(roc)
    };
  }

  calculateMomentum(candles, period = 10) {
    const closes = candles.map(c => c.close);
    const current = closes[closes.length - 1];
    const past = closes[closes.length - 1 - period];

    const momentum = current - past;

    return {
      value: momentum,
      positive: momentum > 0,
      signal: momentum > 0 ? 'BUY' : 'SELL'
    };
  }

  // ============================================
  // VOLATILITY INDICATORS
  // ============================================

  calculateATR(candles, period = 14) {
    const trs = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trs.push(tr);
    }

    const recentTRs = trs.slice(-period);
    const atr = recentTRs.reduce((a, b) => a + b, 0) / period;

    return {
      value: atr,
      percentage: (atr / candles[candles.length - 1].close) * 100,
      volatility: atr > 0.001 ? 'HIGH' : 'LOW'
    };
  }

  calculateBollingerBands(candles, period = 20, stdDev = 2) {
    const closes = candles.map(c => c.close);
    const recent = closes.slice(-period);

    const sma = recent.reduce((a, b) => a + b, 0) / period;
    const variance = recent.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    const upper = sma + (std * stdDev);
    const lower = sma - (std * stdDev);
    const current = closes[closes.length - 1];

    return {
      upper,
      middle: sma,
      lower,
      width: upper - lower,
      percentB: (current - lower) / (upper - lower),
      outsideUpper: current > upper,
      outsideLower: current < lower,
      signal: current < lower ? 'BUY' : current > upper ? 'SELL' : 'NEUTRAL'
    };
  }

  calculateKeltnerChannels(candles, period = 20, multiplier = 2) {
    const ema = this.calculateEMA(candles, period);
    const atr = this.calculateATR(candles, period);

    const middle = ema.value;
    const upper = middle + (atr.value * multiplier);
    const lower = middle - (atr.value * multiplier);
    const current = candles[candles.length - 1].close;

    return {
      upper,
      middle,
      lower,
      outsideUpper: current > upper,
      outsideLower: current < lower
    };
  }

  calculateDonchianChannels(candles, period = 20) {
    const recent = candles.slice(-period);
    const upper = Math.max(...recent.map(c => c.high));
    const lower = Math.min(...recent.map(c => c.low));
    const middle = (upper + lower) / 2;

    const current = candles[candles.length - 1].close;

    return {
      upper,
      middle,
      lower,
      atUpper: current >= upper * 0.99,
      atLower: current <= lower * 1.01
    };
  }

  // ============================================
  // VOLUME INDICATORS
  // ============================================

  calculateVolumeSMA(candles, period = 20) {
    const volumes = candles.map(c => c.volume || 0);
    const recent = volumes.slice(-period);
    const avg = recent.reduce((a, b) => a + b, 0) / period;
    const current = volumes[volumes.length - 1];

    return {
      value: avg,
      current,
      aboveAverage: current > avg,
      ratio: current / avg
    };
  }

  calculateVolumeRatio(candles) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const ratio = (last.volume || 0) / (prev.volume || 1);

    return {
      value: ratio,
      increasing: ratio > 1,
      spike: ratio > 2
    };
  }

  calculateOBV(candles) {
    let obv = 0;

    for (let i = 1; i < candles.length; i++) {
      if (candles[i].close > candles[i - 1].close) {
        obv += candles[i].volume || 0;
      } else if (candles[i].close < candles[i - 1].close) {
        obv -= candles[i].volume || 0;
      }
    }

    return {
      value: obv,
      trend: obv > 0 ? 'BULLISH' : 'BEARISH'
    };
  }

  calculateVWAP(candles) {
    let sumPV = 0;
    let sumV = 0;

    const recent = candles.slice(-50);

    for (const candle of recent) {
      const typical = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 0;

      sumPV += typical * volume;
      sumV += volume;
    }

    const vwap = sumPV / sumV;
    const current = candles[candles.length - 1].close;

    return {
      value: vwap,
      above: current > vwap,
      distance: ((current - vwap) / vwap) * 100,
      signal: current > vwap ? 'BULLISH' : 'BEARISH'
    };
  }

  calculateMFI(candles, period = 14) {
    const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
    const moneyFlows = candles.map((c, i) => typicalPrices[i] * (c.volume || 0));

    let positiveFlow = 0;
    let negativeFlow = 0;

    const recent = candles.slice(-period);

    for (let i = 1; i < recent.length; i++) {
      const current = (recent[i].high + recent[i].low + recent[i].close) / 3;
      const previous = (recent[i - 1].high + recent[i - 1].low + recent[i - 1].close) / 3;
      const flow = current * (recent[i].volume || 0);

      if (current > previous) positiveFlow += flow;
      else negativeFlow += flow;
    }

    const mfi = 100 - (100 / (1 + (positiveFlow / negativeFlow)));

    return {
      value: mfi,
      overbought: mfi > 80,
      oversold: mfi < 20,
      signal: mfi < 30 ? 'BUY' : mfi > 70 ? 'SELL' : 'NEUTRAL'
    };
  }

  // ============================================
  // INSTITUTIONAL INDICATORS
  // ============================================

  calculateInstitutionalTrend(candles) {
    const ema9 = this.calculateEMA(candles, 9);
    const ema21 = this.calculateEMA(candles, 21);
    const ema50 = this.calculateEMA(candles, 50);
    const ema200 = this.calculateEMA(candles, 200);

    const aligned =
      ema9.value > ema21.value &&
      ema21.value > ema50.value &&
      ema50.value > ema200.value;

    const alignedBearish =
      ema9.value < ema21.value &&
      ema21.value < ema50.value &&
      ema50.value < ema200.value;

    return {
      bullish: aligned,
      bearish: alignedBearish,
      neutral: !aligned && !alignedBearish,
      signal: aligned ? 'BUY' : alignedBearish ? 'SELL' : 'NEUTRAL',
      strength: aligned || alignedBearish ? 90 : 30
    };
  }

  calculateTrendStrength(candles) {
    const closes = candles.map(c => c.close);
    const recent = closes.slice(-50);

    let upMoves = 0;
    let downMoves = 0;

    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) upMoves++;
      else downMoves++;
    }

    const strength = Math.abs(upMoves - downMoves) / recent.length * 100;

    return {
      value: strength,
      direction: upMoves > downMoves ? 'BULLISH' : 'BEARISH',
      strong: strength > 30
    };
  }

  calculateRelativeVolatility(candles) {
    const atr14 = this.calculateATR(candles, 14);
    const atr50 = this.calculateATR(candles, 50);

    const ratio = atr14.value / atr50.value;

    return {
      value: ratio,
      increasing: ratio > 1,
      high: ratio > 1.5,
      low: ratio < 0.7
    };
  }

  calculatePricePosition(candles) {
    const recent = candles.slice(-50);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const current = candles[candles.length - 1].close;

    const position = ((current - low) / (high - low)) * 100;

    return {
      value: position,
      atTop: position > 90,
      atBottom: position < 10,
      zone: position > 60 ? 'PREMIUM' : position < 40 ? 'DISCOUNT' : 'EQUILIBRIUM'
    };
  }

  detectCandlePatterns(candles) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const body = Math.abs(last.close - last.open);
    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;

    const patterns = [];

    // Hammer
    if (lowerWick > body * 2 && upperWick < body * 0.3) {
      patterns.push({ name: 'HAMMER', signal: 'BUY', strength: 70 });
    }

    // Shooting Star
    if (upperWick > body * 2 && lowerWick < body * 0.3) {
      patterns.push({ name: 'SHOOTING_STAR', signal: 'SELL', strength: 70 });
    }

    // Engulfing Bullish
    if (prev.close < prev.open && last.close > last.open &&
        last.close > prev.open && last.open < prev.close) {
      patterns.push({ name: 'ENGULFING_BULLISH', signal: 'BUY', strength: 80 });
    }

    // Engulfing Bearish
    if (prev.close > prev.open && last.close < last.open &&
        last.close < prev.open && last.open > prev.close) {
      patterns.push({ name: 'ENGULFING_BEARISH', signal: 'SELL', strength: 80 });
    }

    return patterns;
  }

  // ============================================
  // FIBONACCI & SUPPORT/RESISTANCE
  // ============================================

  calculateFibonacciLevels(candles) {
    const recent = candles.slice(-100);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const range = high - low;

    return {
      '0': low,
      '23.6': low + range * 0.236,
      '38.2': low + range * 0.382,
      '50': low + range * 0.5,
      '61.8': low + range * 0.618,
      '78.6': low + range * 0.786,
      '100': high
    };
  }

  calculatePivotPoints(candles) {
    const last = candles[candles.length - 1];
    const pivot = (last.high + last.low + last.close) / 3;

    return {
      pivot,
      r1: 2 * pivot - last.low,
      r2: pivot + (last.high - last.low),
      r3: last.high + 2 * (pivot - last.low),
      s1: 2 * pivot - last.high,
      s2: pivot - (last.high - last.low),
      s3: last.low - 2 * (last.high - pivot)
    };
  }

  detectSupportResistance(candles) {
    const levels = [];
    const recent = candles.slice(-100);

    // Agrupa preços similares
    const tolerance = 0.001; // 0.1%
    const priceMap = {};

    for (const candle of recent) {
      const high = candle.high;
      const low = candle.low;

      // Registra toques em níveis
      for (const price of [high, low]) {
        const key = Math.round(price / tolerance) * tolerance;
        priceMap[key] = (priceMap[key] || 0) + 1;
      }
    }

    // Identifica níveis com múltiplos toques
    for (const [price, touches] of Object.entries(priceMap)) {
      if (touches >= 3) {
        levels.push({
          price: parseFloat(price),
          touches,
          type: touches >= 5 ? 'STRONG' : 'MODERATE'
        });
      }
    }

    return levels;
  }

  // ============================================
  // MULTI-TIMEFRAME & DAILY/WEEKLY
  // ============================================

  getHigherTimeframeTrend(currentTF) {
    // Simulação - em produção, buscaria dados reais
    return {
      trend: 'BULLISH',
      strength: 75
    };
  }

  calculateDailyRange(candles) {
    const today = candles.slice(-24); // Últimas 24 horas (se 1H)
    const high = Math.max(...today.map(c => c.high));
    const low = Math.min(...today.map(c => c.low));

    return {
      high,
      low,
      range: high - low,
      current: candles[candles.length - 1].close
    };
  }

  calculateWeeklyHighLow(candles) {
    const week = candles.slice(-168); // Últimos 7 dias (se 1H)
    const high = Math.max(...week.map(c => c.high));
    const low = Math.min(...week.map(c => c.low));

    return { high, low };
  }

  // ============================================
  // SPREAD & EFFICIENCY
  // ============================================

  analyzeSpread(candles) {
    const spreads = candles.slice(-20).map(c => c.high - c.low);
    const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    const current = candles[candles.length - 1].high - candles[candles.length - 1].low;

    return {
      current,
      average: avgSpread,
      ratio: current / avgSpread,
      wide: current > avgSpread * 1.5
    };
  }

  calculateMarketEfficiency(candles) {
    const recent = candles.slice(-50);
    const directDistance = Math.abs(recent[recent.length - 1].close - recent[0].close);

    let pathDistance = 0;
    for (let i = 1; i < recent.length; i++) {
      pathDistance += Math.abs(recent[i].close - recent[i - 1].close);
    }

    const efficiency = directDistance / pathDistance;

    return {
      value: efficiency,
      trending: efficiency > 0.5,
      ranging: efficiency < 0.3
    };
  }

  // ============================================
  // DIVERGENCES
  // ============================================

  detectRSIDivergence(candles) {
    if (candles.length < 30) return { detected: false };

    const rsi = this.calculateRSI(candles, 14);
    const prices = candles.map(c => c.close);

    // Simplificação: verifica últimos 20 candles
    const recent = candles.slice(-20);
    const recentPrices = recent.map(c => c.close);

    // Bullish divergence: preço fazendo lower low, RSI fazendo higher low
    const priceLL = recentPrices[recentPrices.length - 1] < recentPrices[0];
    const rsiHL = rsi.value > 30; // Simplificado

    if (priceLL && rsiHL) {
      return { detected: true, type: 'BULLISH', signal: 'BUY' };
    }

    // Bearish divergence: preço fazendo higher high, RSI fazendo lower high
    const priceHH = recentPrices[recentPrices.length - 1] > recentPrices[0];
    const rsiLH = rsi.value < 70; // Simplificado

    if (priceHH && rsiLH) {
      return { detected: true, type: 'BEARISH', signal: 'SELL' };
    }

    return { detected: false };
  }

  detectMACDDivergence(candles) {
    // Implementação similar ao RSI divergence
    return { detected: false };
  }

  // ============================================
  // FEATURE PREPARATION & MODEL PREDICTION
  // ============================================

  /**
   * Prepara features normalizadas para os modelos ML
   */
  prepareFeatures(indicators) {
    const features = [];

    // Helper para evitar NaN
    const safeValue = (val, defaultVal = 0.5) => {
      if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
        return defaultVal;
      }
      return Math.max(0, Math.min(1, val)); // Clamp entre 0 e 1
    };

    // Trend features
    features.push(indicators.ema9?.above ? 1 : 0);
    features.push(indicators.ema21?.above ? 1 : 0);
    features.push(indicators.ema50?.above ? 1 : 0);
    features.push(indicators.ema200?.above ? 1 : 0);

    // Momentum features
    features.push(safeValue((indicators.rsi14?.value || 50) / 100));
    features.push(indicators.macd?.histogram > 0 ? 1 : 0);
    features.push(safeValue((indicators.stochastic?.k || 50) / 100));

    // Volume features
    features.push(safeValue(indicators.volumeRatio?.ratio || 1, 0.5));
    features.push(indicators.obv?.value > 0 ? 1 : 0);

    // Volatility features
    features.push(safeValue(indicators.atr14?.percentage || 0.01, 0.01));
    features.push(safeValue(indicators.bollingerBands?.percentB || 0.5));

    // Institutional features
    features.push(indicators.institutionalTrend?.bullish ? 1 : indicators.institutionalTrend?.bearish ? -1 : 0);
    features.push(safeValue((indicators.trendStrength?.value || 50) / 100));
    features.push(safeValue((indicators.pricePosition?.value || 50) / 100));

    return features;
  }

  /**
   * Predição usando Random Forest (REAL se treinado, simulado caso contrário)
   */
  async predictRandomForest(features) {
    // Usa modelo REAL se disponível
    if (this.useRealML && this.models.randomForest.isTrained) {
      try {
        // Garante que features tem 50 elementos
        const paddedFeatures = [...features];
        while (paddedFeatures.length < 50) {
          paddedFeatures.push(0);
        }

        const probability = await this.models.randomForest.predict(paddedFeatures.slice(0, 50));
        const probabilityPercent = probability * 100;

        return {
          model: 'RandomForest (TensorFlow.js)',
          probability: probabilityPercent,
          direction: probabilityPercent > 50 ? 'BUY' : 'SELL',
          confidence: Math.abs(probabilityPercent - 50) * 2,
          source: 'REAL_ML'
        };
      } catch (error) {
        console.warn('⚠️  Erro ao usar Random Forest real, usando fallback:', error.message);
      }
    }

    // Fallback: simulação baseada em features
    const bullishScore = features.filter(f => f > 0.5).length;
    const bearishScore = features.filter(f => f < 0.5).length;

    const total = bullishScore + bearishScore;
    const probability = (bullishScore / total) * 100;

    return {
      model: 'RandomForest (Simulated)',
      probability,
      direction: probability > 50 ? 'BUY' : 'SELL',
      confidence: Math.abs(probability - 50) * 2,
      source: 'SIMULATED'
    };
  }

  /**
   * Predição usando Gradient Boosting (simulado)
   */
  predictGradientBoosting(features) {
    // Simulação com peso em features institucionais
    const institutionalWeight = 2;

    let score = 0;
    features.forEach((f, i) => {
      const weight = i >= 10 ? institutionalWeight : 1;
      score += f * weight;
    });

    const maxScore = features.length * 1.5;
    const probability = (score / maxScore) * 100;

    return {
      model: 'GradientBoosting',
      probability,
      direction: probability > 50 ? 'BUY' : 'SELL',
      confidence: Math.abs(probability - 50) * 2
    };
  }

  /**
   * Predição usando LSTM (REAL se treinado, simulado caso contrário)
   * @param {Array} features - Features extraídas
   * @param {Array} candles - Candles originais para LSTM (se disponível)
   */
  async predictLSTM(features, candles = null) {
    // Usa modelo REAL se disponível e treinado
    if (this.models.lstm && this.models.lstm.isTrained && candles && candles.length >= 60) {
      try {
        const probability = await this.models.lstm.predict(candles);
        const probabilityPercent = probability * 100;

        return {
          model: 'LSTM (TensorFlow.js)',
          probability: probabilityPercent,
          direction: probabilityPercent > 50 ? 'BUY' : 'SELL',
          confidence: Math.abs(probabilityPercent - 50) * 2,
          source: 'REAL_ML'
        };
      } catch (error) {
        console.warn('⚠️  Erro ao usar LSTM real, usando fallback:', error.message);
      }
    }

    // Fallback: simulação com tendência recente
    const trendFeatures = features.slice(0, 4);
    const momentumFeatures = features.slice(4, 7);

    const trendScore = trendFeatures.reduce((a, b) => a + b, 0) / trendFeatures.length;
    const momentumScore = momentumFeatures.reduce((a, b) => a + b, 0) / momentumFeatures.length;

    const probability = ((trendScore * 0.6 + momentumScore * 0.4)) * 100;

    return {
      model: 'LSTM (Simulated)',
      probability,
      direction: probability > 50 ? 'BUY' : 'SELL',
      confidence: Math.abs(probability - 50) * 2,
      source: 'SIMULATED'
    };
  }

  /**
   * Combina predições de todos os modelos com pesos
   */
  combinePredictions(predictions) {
    const { randomForest, gradientBoosting, lstm } = predictions;

    // Garante valores válidos
    const rfProb = isNaN(randomForest?.probability) ? 50 : randomForest.probability;
    const gbProb = isNaN(gradientBoosting?.probability) ? 50 : gradientBoosting.probability;
    const lstmProb = isNaN(lstm?.probability) ? 50 : lstm.probability;

    const weightedProb =
      (rfProb * this.weights.randomForest) +
      (gbProb * this.weights.gradientBoosting) +
      (lstmProb * this.weights.lstm);

    const finalProb = Math.round(isNaN(weightedProb) ? 50 : weightedProb);

    return {
      probability: finalProb,
      direction: finalProb >= 50 ? 'BUY' : 'SELL',
      confidence: Math.abs(finalProb - 50) * 2,
      breakdown: {
        randomForest: rfProb,
        gradientBoosting: gbProb,
        lstm: lstmProb
      }
    };
  }

  /**
   * Atualiza pesos dos modelos baseado em performance
   */
  updateWeights(modelPerformance) {
    const total = modelPerformance.randomForest + modelPerformance.gradientBoosting + modelPerformance.lstm;

    this.weights.randomForest = modelPerformance.randomForest / total;
    this.weights.gradientBoosting = modelPerformance.gradientBoosting / total;
    this.weights.lstm = modelPerformance.lstm / total;
  }

  // ============================================
  // CONTINUOUS LEARNING METHODS
  // ============================================

  /**
   * Registra resultado de um trade para aprendizado contínuo
   * @param {Object} trade - Informações do trade
   */
  async recordTradeResult(trade) {
    return await this.continuousLearning.recordTradeResult(trade);
  }

  /**
   * Treina modelos com dados históricos
   * @param {Array} candles - Array de candles (mínimo 500 para LSTM)
   */
  async trainModels(candles) {
    const results = {};

    console.log('\n🎓 === INICIANDO TREINAMENTO DE ML ===\n');

    // Treina LSTM com candles
    if (candles && candles.length >= 500) {
      console.log('🧠 Treinando LSTM...');
      results.lstm = await this.models.lstm.train(candles);

      if (results.lstm.success && !results.lstm.simulated) {
        await this.models.lstm.saveModel();
      }
    } else {
      console.log(`⚠️  LSTM: Dados insuficientes (${candles?.length || 0}/500 candles)`);
      results.lstm = { success: false, error: 'Dados insuficientes' };
    }

    // Random Forest treina via MLTrainer (usa prepareFeatures diferente)
    // Isso será feito pelo endpoint /api/ml/train existente

    console.log('\n✅ === TREINAMENTO CONCLUÍDO ===\n');

    return results;
  }

  /**
   * Força retreinamento com dados de feedback
   */
  async forceRetrain() {
    return await this.continuousLearning.forceRetrain();
  }

  /**
   * Obtém estatísticas de aprendizado contínuo
   */
  getLearningStats() {
    return this.continuousLearning.getPerformanceStats();
  }

  /**
   * Obtém status completo de todos os modelos
   */
  getModelsStatus() {
    return {
      randomForest: this.models.randomForest.getStatus(),
      lstm: this.models.lstm.getStatus(),
      weights: this.weights,
      useRealML: this.useRealML,
      continuousLearning: this.continuousLearning.getPerformanceStats()
    };
  }
}


module.exports = TechnicalMLEngine;
