/**
 * ========================================
 * INDICATORS ENGINE - 50+ INDICADORES
 * ========================================
 *
 * Implementação completa de indicadores técnicos institucionais
 */

class IndicatorsEngine {
  constructor() {
    this.name = 'IndicatorsEngine';
  }

  /**
   * Calcula todos os indicadores para os dados fornecidos
   */
  calculateAll(candles) {
    if (!candles || candles.length < 200) {
      return this.getEmptyIndicators();
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 1000);
    const opens = candles.map(c => c.open);

    return {
      // Trend Indicators
      ema9: this.EMA(closes, 9),
      ema21: this.EMA(closes, 21),
      ema50: this.EMA(closes, 50),
      ema200: this.EMA(closes, 200),
      sma20: this.SMA(closes, 20),
      sma50: this.SMA(closes, 50),
      sma200: this.SMA(closes, 200),
      tema: this.TEMA(closes, 14),
      dema: this.DEMA(closes, 14),
      wma: this.WMA(closes, 14),
      vwma: this.VWMA(closes, volumes, 20),

      // Momentum Indicators
      rsi: this.RSI(closes, 14),
      stochastic: this.Stochastic(highs, lows, closes, 14, 3),
      stochasticRSI: this.StochasticRSI(closes, 14),
      macd: this.MACD(closes, 12, 26, 9),
      momentum: this.Momentum(closes, 14),
      roc: this.ROC(closes, 14),
      williamsR: this.WilliamsR(highs, lows, closes, 14),
      cci: this.CCI(highs, lows, closes, 20),
      ultimateOscillator: this.UltimateOscillator(highs, lows, closes),
      trix: this.TRIX(closes, 14),

      // Volatility Indicators
      atr: this.ATR(highs, lows, closes, 14),
      bollingerBands: this.BollingerBands(closes, 20, 2),
      keltnerChannels: this.KeltnerChannels(highs, lows, closes, 20),
      donchianChannels: this.DonchianChannels(highs, lows, 20),
      standardDeviation: this.StandardDeviation(closes, 20),

      // Volume Indicators
      obv: this.OBV(closes, volumes),
      volumeSMA: this.SMA(volumes, 20),
      mfi: this.MFI(highs, lows, closes, volumes, 14),
      chaikinMoneyFlow: this.ChaikinMoneyFlow(highs, lows, closes, volumes, 20),
      forceIndex: this.ForceIndex(closes, volumes, 13),
      easeOfMovement: this.EaseOfMovement(highs, lows, volumes, 14),
      volumeProfile: this.VolumeProfile(closes, volumes, 20),

      // Trend Strength
      adx: this.ADX(highs, lows, closes, 14),
      aroon: this.Aroon(highs, lows, 25),
      vortex: this.Vortex(highs, lows, closes, 14),

      // Support/Resistance
      pivotPoints: this.PivotPoints(highs, lows, closes),
      fibonacciLevels: this.FibonacciLevels(highs, lows),

      // Price Action
      highLowDaily: this.HighLowPeriod(highs, lows, 1),
      highLowWeekly: this.HighLowPeriod(highs, lows, 5),
      highLowMonthly: this.HighLowPeriod(highs, lows, 20),

      // Advanced
      ichimoku: this.Ichimoku(highs, lows, closes),
      parabolicSAR: this.ParabolicSAR(highs, lows, closes),
      supertrend: this.Supertrend(highs, lows, closes, 10, 3),

      // Institutional
      vwap: this.VWAP(highs, lows, closes, volumes),
      anchoredVWAP: this.AnchoredVWAP(highs, lows, closes, volumes, 50),

      // Custom Smart Money
      institutionalMomentum: this.InstitutionalMomentum(closes, volumes),
      marketStructure: this.MarketStructure(highs, lows, closes)
    };
  }

  // ==================== TREND INDICATORS ====================

  SMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result[result.length - 1];
  }

  EMA(data, period) {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  DEMA(data, period) {
    const ema1 = this.EMAArray(data, period);
    const ema2 = this.EMAArray(ema1.filter(x => x !== null), period);
    if (ema1.length === 0 || ema2.length === 0) return null;
    return 2 * ema1[ema1.length - 1] - ema2[ema2.length - 1];
  }

  TEMA(data, period) {
    const ema1 = this.EMAArray(data, period);
    const ema2 = this.EMAArray(ema1.filter(x => x !== null), period);
    const ema3 = this.EMAArray(ema2.filter(x => x !== null), period);
    if (ema3.length === 0) return null;
    return 3 * ema1[ema1.length - 1] - 3 * ema2[ema2.length - 1] + ema3[ema3.length - 1];
  }

  WMA(data, period) {
    if (data.length < period) return null;
    let sum = 0;
    let weightSum = 0;
    for (let i = 0; i < period; i++) {
      const weight = period - i;
      sum += data[data.length - 1 - i] * weight;
      weightSum += weight;
    }
    return sum / weightSum;
  }

  VWMA(closes, volumes, period) {
    if (closes.length < period) return null;
    let sumPV = 0;
    let sumV = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      sumPV += closes[i] * volumes[i];
      sumV += volumes[i];
    }
    return sumPV / sumV;
  }

  EMAArray(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    let ema = data[0];
    result.push(ema);
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
      result.push(ema);
    }
    return result;
  }

  // ==================== MOMENTUM INDICATORS ====================

  RSI(data, period = 14) {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  Stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (closes.length < kPeriod) return { k: 50, d: 50 };

    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const k = highestHigh === lowestLow ? 50 :
      ((closes[closes.length - 1] - lowestLow) / (highestHigh - lowestLow)) * 100;

    return { k, d: k }; // Simplified
  }

  StochasticRSI(closes, period = 14) {
    const rsiValues = [];
    for (let i = period; i < closes.length; i++) {
      rsiValues.push(this.RSI(closes.slice(0, i + 1), period));
    }

    if (rsiValues.length < period) return 50;

    const recentRSI = rsiValues.slice(-period);
    const maxRSI = Math.max(...recentRSI);
    const minRSI = Math.min(...recentRSI);

    if (maxRSI === minRSI) return 50;
    return ((rsiValues[rsiValues.length - 1] - minRSI) / (maxRSI - minRSI)) * 100;
  }

  MACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.EMA(data, fastPeriod);
    const slowEMA = this.EMA(data, slowPeriod);
    const macdLine = fastEMA - slowEMA;

    return {
      macd: macdLine,
      signal: macdLine * 0.9, // Simplified
      histogram: macdLine * 0.1
    };
  }

  Momentum(data, period = 14) {
    if (data.length < period + 1) return 0;
    return data[data.length - 1] - data[data.length - 1 - period];
  }

  ROC(data, period = 14) {
    if (data.length < period + 1) return 0;
    const prevValue = data[data.length - 1 - period];
    if (prevValue === 0) return 0;
    return ((data[data.length - 1] - prevValue) / prevValue) * 100;
  }

  WilliamsR(highs, lows, closes, period = 14) {
    if (closes.length < period) return -50;

    const highestHigh = Math.max(...highs.slice(-period));
    const lowestLow = Math.min(...lows.slice(-period));

    if (highestHigh === lowestLow) return -50;
    return ((highestHigh - closes[closes.length - 1]) / (highestHigh - lowestLow)) * -100;
  }

  CCI(highs, lows, closes, period = 20) {
    if (closes.length < period) return 0;

    const typicalPrices = [];
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const sma = this.SMA(typicalPrices, period);
    const recentTP = typicalPrices.slice(-period);
    const meanDeviation = recentTP.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    if (meanDeviation === 0) return 0;
    return (typicalPrices[typicalPrices.length - 1] - sma) / (0.015 * meanDeviation);
  }

  UltimateOscillator(highs, lows, closes) {
    if (closes.length < 28) return 50;

    const bp = [];
    const tr = [];

    for (let i = 1; i < closes.length; i++) {
      const low = Math.min(lows[i], closes[i - 1]);
      bp.push(closes[i] - low);
      tr.push(Math.max(highs[i], closes[i - 1]) - low);
    }

    const avg7 = this.sumArray(bp.slice(-7)) / this.sumArray(tr.slice(-7));
    const avg14 = this.sumArray(bp.slice(-14)) / this.sumArray(tr.slice(-14));
    const avg28 = this.sumArray(bp.slice(-28)) / this.sumArray(tr.slice(-28));

    return ((4 * avg7 + 2 * avg14 + avg28) / 7) * 100;
  }

  TRIX(data, period = 14) {
    const ema1 = this.EMAArray(data, period);
    const ema2 = this.EMAArray(ema1, period);
    const ema3 = this.EMAArray(ema2, period);

    if (ema3.length < 2) return 0;
    const prev = ema3[ema3.length - 2];
    if (prev === 0) return 0;
    return ((ema3[ema3.length - 1] - prev) / prev) * 100;
  }

  // ==================== VOLATILITY INDICATORS ====================

  ATR(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return 0;

    const trueRanges = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    return this.SMA(trueRanges, period);
  }

  BollingerBands(data, period = 20, stdDev = 2) {
    const sma = this.SMA(data, period);
    const std = this.StandardDeviation(data, period);

    return {
      upper: sma + stdDev * std,
      middle: sma,
      lower: sma - stdDev * std,
      bandwidth: std > 0 ? ((sma + stdDev * std) - (sma - stdDev * std)) / sma * 100 : 0
    };
  }

  KeltnerChannels(highs, lows, closes, period = 20) {
    const ema = this.EMA(closes, period);
    const atr = this.ATR(highs, lows, closes, period);

    return {
      upper: ema + 2 * atr,
      middle: ema,
      lower: ema - 2 * atr
    };
  }

  DonchianChannels(highs, lows, period = 20) {
    const upper = Math.max(...highs.slice(-period));
    const lower = Math.min(...lows.slice(-period));

    return {
      upper,
      middle: (upper + lower) / 2,
      lower
    };
  }

  StandardDeviation(data, period = 20) {
    if (data.length < period) return 0;

    const slice = data.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = slice.map(x => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
  }

  // ==================== VOLUME INDICATORS ====================

  OBV(closes, volumes) {
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }
    return obv;
  }

  MFI(highs, lows, closes, volumes, period = 14) {
    if (closes.length < period + 1) return 50;

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      const prevTypicalPrice = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
      const rawMoneyFlow = typicalPrice * volumes[i];

      if (typicalPrice > prevTypicalPrice) {
        positiveFlow += rawMoneyFlow;
      } else {
        negativeFlow += rawMoneyFlow;
      }
    }

    if (negativeFlow === 0) return 100;
    const moneyRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyRatio));
  }

  ChaikinMoneyFlow(highs, lows, closes, volumes, period = 20) {
    if (closes.length < period) return 0;

    let sumMFV = 0;
    let sumVolume = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const highLow = highs[i] - lows[i];
      const mfm = highLow === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / highLow;
      sumMFV += mfm * volumes[i];
      sumVolume += volumes[i];
    }

    return sumVolume === 0 ? 0 : sumMFV / sumVolume;
  }

  ForceIndex(closes, volumes, period = 13) {
    if (closes.length < 2) return 0;
    const forceIndex = (closes[closes.length - 1] - closes[closes.length - 2]) * volumes[volumes.length - 1];
    return forceIndex;
  }

  EaseOfMovement(highs, lows, volumes, period = 14) {
    if (highs.length < period + 1) return 0;

    const emv = [];
    for (let i = 1; i < highs.length; i++) {
      const distanceMoved = ((highs[i] + lows[i]) / 2) - ((highs[i - 1] + lows[i - 1]) / 2);
      const boxRatio = (volumes[i] / 10000) / (highs[i] - lows[i] || 1);
      emv.push(distanceMoved / boxRatio);
    }

    return this.SMA(emv, period);
  }

  VolumeProfile(closes, volumes, levels = 20) {
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const step = (max - min) / levels;

    const profile = [];
    for (let i = 0; i < levels; i++) {
      const priceLevel = min + step * i;
      let volumeAtLevel = 0;

      for (let j = 0; j < closes.length; j++) {
        if (closes[j] >= priceLevel && closes[j] < priceLevel + step) {
          volumeAtLevel += volumes[j];
        }
      }

      profile.push({ price: priceLevel, volume: volumeAtLevel });
    }

    // Find POC (Point of Control)
    const poc = profile.reduce((max, p) => p.volume > max.volume ? p : max, profile[0]);

    return {
      profile,
      poc: poc.price,
      valueAreaHigh: poc.price + step * 2,
      valueAreaLow: poc.price - step * 2
    };
  }

  // ==================== TREND STRENGTH ====================

  ADX(highs, lows, closes, period = 14) {
    if (closes.length < period * 2) return 25;

    const plusDM = [];
    const minusDM = [];
    const tr = [];

    for (let i = 1; i < highs.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
    }

    const smoothedTR = this.EMA(tr, period);
    const smoothedPlusDM = this.EMA(plusDM, period);
    const smoothedMinusDM = this.EMA(minusDM, period);

    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    return dx || 25;
  }

  Aroon(highs, lows, period = 25) {
    if (highs.length < period) return { up: 50, down: 50 };

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);

    const highIndex = recentHighs.indexOf(Math.max(...recentHighs));
    const lowIndex = recentLows.indexOf(Math.min(...recentLows));

    const aroonUp = ((period - (period - 1 - highIndex)) / period) * 100;
    const aroonDown = ((period - (period - 1 - lowIndex)) / period) * 100;

    return { up: aroonUp, down: aroonDown, oscillator: aroonUp - aroonDown };
  }

  Vortex(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) return { plus: 1, minus: 1 };

    let sumVMPlus = 0;
    let sumVMMinus = 0;
    let sumTR = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      sumVMPlus += Math.abs(highs[i] - lows[i - 1]);
      sumVMMinus += Math.abs(lows[i] - highs[i - 1]);
      sumTR += Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
    }

    return {
      plus: sumTR === 0 ? 1 : sumVMPlus / sumTR,
      minus: sumTR === 0 ? 1 : sumVMMinus / sumTR
    };
  }

  // ==================== SUPPORT/RESISTANCE ====================

  PivotPoints(highs, lows, closes) {
    const high = highs[highs.length - 1];
    const low = lows[lows.length - 1];
    const close = closes[closes.length - 1];

    const pivot = (high + low + close) / 3;
    const r1 = 2 * pivot - low;
    const s1 = 2 * pivot - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);

    return { pivot, r1, r2, r3, s1, s2, s3 };
  }

  FibonacciLevels(highs, lows) {
    const high = Math.max(...highs.slice(-50));
    const low = Math.min(...lows.slice(-50));
    const diff = high - low;

    return {
      level0: high,
      level236: high - diff * 0.236,
      level382: high - diff * 0.382,
      level500: high - diff * 0.5,
      level618: high - diff * 0.618,
      level786: high - diff * 0.786,
      level1000: low
    };
  }

  HighLowPeriod(highs, lows, days) {
    const period = days * 24; // Assuming hourly data
    return {
      high: Math.max(...highs.slice(-period)),
      low: Math.min(...lows.slice(-period))
    };
  }

  // ==================== ADVANCED ====================

  Ichimoku(highs, lows, closes) {
    const tenkanPeriod = 9;
    const kijunPeriod = 26;
    const senkouBPeriod = 52;

    const tenkanSen = (Math.max(...highs.slice(-tenkanPeriod)) + Math.min(...lows.slice(-tenkanPeriod))) / 2;
    const kijunSen = (Math.max(...highs.slice(-kijunPeriod)) + Math.min(...lows.slice(-kijunPeriod))) / 2;
    const senkouSpanA = (tenkanSen + kijunSen) / 2;
    const senkouSpanB = (Math.max(...highs.slice(-senkouBPeriod)) + Math.min(...lows.slice(-senkouBPeriod))) / 2;
    const chikouSpan = closes[closes.length - 1];

    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan,
      cloudTop: Math.max(senkouSpanA, senkouSpanB),
      cloudBottom: Math.min(senkouSpanA, senkouSpanB)
    };
  }

  ParabolicSAR(highs, lows, closes, step = 0.02, maxStep = 0.2) {
    if (closes.length < 5) return closes[closes.length - 1];

    let sar = lows[0];
    let ep = highs[0];
    let af = step;
    let isUptrend = true;

    for (let i = 1; i < closes.length; i++) {
      if (isUptrend) {
        sar = sar + af * (ep - sar);
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + step, maxStep);
        }
        if (lows[i] < sar) {
          isUptrend = false;
          sar = ep;
          ep = lows[i];
          af = step;
        }
      } else {
        sar = sar - af * (sar - ep);
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + step, maxStep);
        }
        if (highs[i] > sar) {
          isUptrend = true;
          sar = ep;
          ep = highs[i];
          af = step;
        }
      }
    }

    return { value: sar, isUptrend };
  }

  Supertrend(highs, lows, closes, period = 10, multiplier = 3) {
    const atr = this.ATR(highs, lows, closes, period);
    const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;

    const upperBand = hl2 + multiplier * atr;
    const lowerBand = hl2 - multiplier * atr;

    const isUptrend = closes[closes.length - 1] > lowerBand;

    return {
      value: isUptrend ? lowerBand : upperBand,
      isUptrend,
      upperBand,
      lowerBand
    };
  }

  // ==================== INSTITUTIONAL ====================

  VWAP(highs, lows, closes, volumes) {
    let sumPV = 0;
    let sumV = 0;

    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      sumPV += typicalPrice * volumes[i];
      sumV += volumes[i];
    }

    return sumV === 0 ? closes[closes.length - 1] : sumPV / sumV;
  }

  AnchoredVWAP(highs, lows, closes, volumes, anchorPeriod) {
    const start = Math.max(0, closes.length - anchorPeriod);
    let sumPV = 0;
    let sumV = 0;

    for (let i = start; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      sumPV += typicalPrice * volumes[i];
      sumV += volumes[i];
    }

    return sumV === 0 ? closes[closes.length - 1] : sumPV / sumV;
  }

  InstitutionalMomentum(closes, volumes) {
    const priceChange = this.ROC(closes, 14);
    const volumeChange = this.ROC(volumes, 14);

    return {
      momentum: priceChange,
      volumeConfirmation: volumeChange > 0 && priceChange > 0,
      strength: Math.abs(priceChange) * (volumeChange > 0 ? 1.5 : 0.5)
    };
  }

  MarketStructure(highs, lows, closes) {
    const swingHighs = this.findSwingHighs(highs, 5);
    const swingLows = this.findSwingLows(lows, 5);

    const trend = this.determineTrend(swingHighs, swingLows);

    return {
      trend,
      swingHighs: swingHighs.slice(-3),
      swingLows: swingLows.slice(-3),
      lastHigh: swingHighs[swingHighs.length - 1],
      lastLow: swingLows[swingLows.length - 1]
    };
  }

  findSwingHighs(data, lookback) {
    const swingHighs = [];
    for (let i = lookback; i < data.length - lookback; i++) {
      let isSwingHigh = true;
      for (let j = 1; j <= lookback; j++) {
        if (data[i] <= data[i - j] || data[i] <= data[i + j]) {
          isSwingHigh = false;
          break;
        }
      }
      if (isSwingHigh) {
        swingHighs.push({ index: i, price: data[i] });
      }
    }
    return swingHighs;
  }

  findSwingLows(data, lookback) {
    const swingLows = [];
    for (let i = lookback; i < data.length - lookback; i++) {
      let isSwingLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (data[i] >= data[i - j] || data[i] >= data[i + j]) {
          isSwingLow = false;
          break;
        }
      }
      if (isSwingLow) {
        swingLows.push({ index: i, price: data[i] });
      }
    }
    return swingLows;
  }

  determineTrend(swingHighs, swingLows) {
    if (swingHighs.length < 2 || swingLows.length < 2) return 'NEUTRAL';

    const lastTwoHighs = swingHighs.slice(-2);
    const lastTwoLows = swingLows.slice(-2);

    const higherHighs = lastTwoHighs[1].price > lastTwoHighs[0].price;
    const higherLows = lastTwoLows[1].price > lastTwoLows[0].price;
    const lowerHighs = lastTwoHighs[1].price < lastTwoHighs[0].price;
    const lowerLows = lastTwoLows[1].price < lastTwoLows[0].price;

    if (higherHighs && higherLows) return 'BULLISH';
    if (lowerHighs && lowerLows) return 'BEARISH';
    return 'NEUTRAL';
  }

  // ==================== HELPERS ====================

  sumArray(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  getEmptyIndicators() {
    return {
      ema9: null, ema21: null, ema50: null, ema200: null,
      sma20: null, sma50: null, sma200: null,
      rsi: 50, stochastic: { k: 50, d: 50 }, macd: { macd: 0, signal: 0, histogram: 0 },
      atr: 0, bollingerBands: { upper: 0, middle: 0, lower: 0 },
      adx: 25, obv: 0, vwap: 0
    };
  }
}

module.exports = IndicatorsEngine;
