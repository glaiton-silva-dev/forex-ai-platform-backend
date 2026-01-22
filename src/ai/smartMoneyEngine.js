/**
 * ========================================
 * SMART MONEY ENGINE - Motor de Análise Institucional
 * ========================================
 *
 * Responsável por detectar e analisar padrões institucionais
 * em múltiplos timeframes (4H, 1H, 15M, 5M)
 *
 * Detecta:
 * - Liquidez (acima/abaixo de topos e fundos)
 * - Equal Highs / Equal Lows
 * - Sweep de liquidez (Stop Hunt)
 * - Break of Structure (BOS)
 * - Change of Character (CHoCH)
 * - Order Blocks (Bullish/Bearish)
 * - Fair Value Gap (FVG)
 * - Premium e Discount Zones
 * - Liquidity Voids
 * - Manipulação institucional
 */

class SmartMoneyEngine {
  constructor() {
    this.timeframes = ['4H', '1H', '15M', '5M'];
    this.liquidityThreshold = 0.0015; // 0.15% para detectar equal highs/lows
  }

  /**
   * Análise completa multi-timeframe
   * @param {Object} marketData - Dados OHLCV de todos os timeframes
   * @returns {Object} Análise Smart Money completa
   */
  analyzeMultiTimeframe(marketData) {
    const analysis = {
      timestamp: new Date(),
      timeframes: {},
      overallBias: null,
      alignment: false,
      readyToTrade: false
    };

    // Analisa cada timeframe individualmente
    for (const tf of this.timeframes) {
      if (marketData[tf] && marketData[tf].length > 0) {
        analysis.timeframes[tf] = this.analyzeTimeframe(marketData[tf], tf);
      }
    }

    // Determina viés geral baseado em 4H e 1H
    analysis.overallBias = this.determineOverallBias(
      analysis.timeframes['4H'],
      analysis.timeframes['1H']
    );

    // Verifica alinhamento de todos os timeframes
    analysis.alignment = this.checkAlignment(analysis.timeframes);

    // Determina se está pronto para operar
    analysis.readyToTrade = this.isReadyToTrade(analysis);

    return analysis;
  }

  /**
   * Análise de um único timeframe
   * @param {Array} candles - Array de candles OHLCV
   * @param {String} timeframe - Timeframe sendo analisado
   * @returns {Object} Análise Smart Money do timeframe
   */
  analyzeTimeframe(candles, timeframe) {
    const analysis = {
      timeframe,
      trend: null,
      phase: null, // MANIPULATION, ACCUMULATION, DISTRIBUTION
      liquidity: this.detectLiquidity(candles),
      orderBlocks: this.detectOrderBlocks(candles),
      bos: this.detectBreakOfStructure(candles),
      choch: this.detectChangeOfCharacter(candles),
      fvg: this.detectFairValueGaps(candles),
      premiumDiscount: this.calculatePremiumDiscount(candles),
      liquidityVoids: this.detectLiquidityVoids(candles),
      manipulation: this.detectManipulation(candles),
      institutionalLevel: null
    };

    // Determina tendência baseada em estrutura
    analysis.trend = this.determineTrend(analysis);

    // Determina fase do mercado
    analysis.phase = this.determinePhase(analysis);

    // Define nível institucional mais importante
    analysis.institutionalLevel = this.getKeyInstitutionalLevel(analysis);

    return analysis;
  }

  /**
   * Detecta zonas de liquidez (acima de topos e abaixo de fundos)
   */
  detectLiquidity(candles) {
    const liquidity = {
      above: [], // Buy-side liquidity
      below: [], // Sell-side liquidity
      equalHighs: [],
      equalLows: [],
      sweeps: []
    };

    const swingPoints = this.identifySwingPoints(candles);

    // Detecta Equal Highs
    for (let i = 1; i < swingPoints.highs.length; i++) {
      const current = swingPoints.highs[i];
      const previous = swingPoints.highs[i - 1];

      const diff = Math.abs(current.price - previous.price) / previous.price;

      if (diff <= this.liquidityThreshold) {
        liquidity.equalHighs.push({
          price: (current.price + previous.price) / 2,
          indices: [previous.index, current.index],
          strength: this.calculateLiquidityStrength(candles, previous.index, current.index)
        });
      }

      // Adiciona liquidez acima do topo
      liquidity.above.push({
        price: current.price,
        index: current.index,
        type: 'swing_high',
        strength: this.calculateLiquidityStrength(candles, current.index - 5, current.index + 5)
      });
    }

    // Detecta Equal Lows
    for (let i = 1; i < swingPoints.lows.length; i++) {
      const current = swingPoints.lows[i];
      const previous = swingPoints.lows[i - 1];

      const diff = Math.abs(current.price - previous.price) / previous.price;

      if (diff <= this.liquidityThreshold) {
        liquidity.equalLows.push({
          price: (current.price + previous.price) / 2,
          indices: [previous.index, current.index],
          strength: this.calculateLiquidityStrength(candles, previous.index, current.index)
        });
      }

      // Adiciona liquidez abaixo do fundo
      liquidity.below.push({
        price: current.price,
        index: current.index,
        type: 'swing_low',
        strength: this.calculateLiquidityStrength(candles, current.index - 5, current.index + 5)
      });
    }

    // Detecta sweeps de liquidez (stop hunts)
    liquidity.sweeps = this.detectLiquiditySweeps(candles, liquidity);

    return liquidity;
  }

  /**
   * Identifica swing highs e swing lows
   */
  identifySwingPoints(candles, lookback = 5) {
    const highs = [];
    const lows = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      const isSwingHigh = this.isSwingHigh(candles, i, lookback);
      const isSwingLow = this.isSwingLow(candles, i, lookback);

      if (isSwingHigh) {
        highs.push({ index: i, price: candles[i].high });
      }

      if (isSwingLow) {
        lows.push({ index: i, price: candles[i].low });
      }
    }

    return { highs, lows };
  }

  isSwingHigh(candles, index, lookback) {
    const currentHigh = candles[index].high;

    for (let i = index - lookback; i < index + lookback; i++) {
      if (i === index) continue;
      if (candles[i].high >= currentHigh) return false;
    }

    return true;
  }

  isSwingLow(candles, index, lookback) {
    const currentLow = candles[index].low;

    for (let i = index - lookback; i < index + lookback; i++) {
      if (i === index) continue;
      if (candles[i].low <= currentLow) return false;
    }

    return true;
  }

  /**
   * Calcula força da liquidez baseada em volume e estrutura
   */
  calculateLiquidityStrength(candles, startIdx, endIdx) {
    if (startIdx < 0) startIdx = 0;
    if (endIdx >= candles.length) endIdx = candles.length - 1;

    let totalVolume = 0;
    let avgVolume = 0;

    for (let i = startIdx; i <= endIdx; i++) {
      totalVolume += candles[i].volume || 0;
    }

    avgVolume = totalVolume / (endIdx - startIdx + 1);

    // Normaliza força (0-100)
    const strength = Math.min(100, (avgVolume / 1000000) * 50);

    return Math.round(strength);
  }

  /**
   * Detecta sweeps de liquidez (stop hunts)
   */
  detectLiquiditySweeps(candles, liquidity) {
    const sweeps = [];

    // Verifica sweeps em equal highs
    for (const eqHigh of liquidity.equalHighs) {
      for (let i = eqHigh.indices[1] + 1; i < candles.length; i++) {
        // Candle quebrou acima e fechou abaixo
        if (candles[i].high > eqHigh.price && candles[i].close < eqHigh.price) {
          sweeps.push({
            type: 'BEARISH_SWEEP',
            price: eqHigh.price,
            index: i,
            direction: 'SELL',
            wickSize: candles[i].high - candles[i].close,
            strength: eqHigh.strength
          });
          break;
        }
      }
    }

    // Verifica sweeps em equal lows
    for (const eqLow of liquidity.equalLows) {
      for (let i = eqLow.indices[1] + 1; i < candles.length; i++) {
        // Candle quebrou abaixo e fechou acima
        if (candles[i].low < eqLow.price && candles[i].close > eqLow.price) {
          sweeps.push({
            type: 'BULLISH_SWEEP',
            price: eqLow.price,
            index: i,
            direction: 'BUY',
            wickSize: candles[i].close - candles[i].low,
            strength: eqLow.strength
          });
          break;
        }
      }
    }

    return sweeps;
  }

  /**
   * Detecta Order Blocks (zonas institucionais de compra/venda)
   */
  detectOrderBlocks(candles) {
    const orderBlocks = [];

    for (let i = 2; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const current = candles[i];
      const next = candles[i + 1];

      // Bullish Order Block: candle de baixa seguido de forte movimento de alta
      if (current.close < current.open && next.close > next.open) {
        const moveSize = (next.close - next.open) / next.open;

        if (moveSize > 0.005) { // Movimento > 0.5%
          orderBlocks.push({
            type: 'BULLISH_OB',
            index: i,
            high: current.high,
            low: current.low,
            open: current.open,
            close: current.close,
            strength: Math.round(moveSize * 100),
            mitigated: false,
            tested: false
          });
        }
      }

      // Bearish Order Block: candle de alta seguido de forte movimento de baixa
      if (current.close > current.open && next.close < next.open) {
        const moveSize = (next.open - next.close) / next.open;

        if (moveSize > 0.005) { // Movimento > 0.5%
          orderBlocks.push({
            type: 'BEARISH_OB',
            index: i,
            high: current.high,
            low: current.low,
            open: current.open,
            close: current.close,
            strength: Math.round(moveSize * 100),
            mitigated: false,
            tested: false
          });
        }
      }
    }

    // Verifica se order blocks foram mitigados ou testados
    this.checkOrderBlockMitigation(candles, orderBlocks);

    return orderBlocks;
  }

  /**
   * Verifica se order blocks foram mitigados (preço retornou à zona)
   */
  checkOrderBlockMitigation(candles, orderBlocks) {
    for (const ob of orderBlocks) {
      for (let i = ob.index + 1; i < candles.length; i++) {
        const candle = candles[i];

        if (ob.type === 'BULLISH_OB') {
          // Preço retornou à zona do order block
          if (candle.low <= ob.high && candle.low >= ob.low) {
            ob.tested = true;

            // Se fechou abaixo, foi mitigado
            if (candle.close < ob.low) {
              ob.mitigated = true;
              break;
            }
          }
        } else if (ob.type === 'BEARISH_OB') {
          // Preço retornou à zona do order block
          if (candle.high >= ob.low && candle.high <= ob.high) {
            ob.tested = true;

            // Se fechou acima, foi mitigado
            if (candle.close > ob.high) {
              ob.mitigated = true;
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Detecta Break of Structure (BOS) - Quebra de estrutura na mesma direção
   */
  detectBreakOfStructure(candles) {
    const bosSignals = [];
    const swingPoints = this.identifySwingPoints(candles);

    // Bullish BOS: preço quebra acima do último swing high
    for (let i = 1; i < swingPoints.highs.length; i++) {
      const prevHigh = swingPoints.highs[i - 1];
      const currentHigh = swingPoints.highs[i];

      if (currentHigh.price > prevHigh.price) {
        bosSignals.push({
          type: 'BULLISH_BOS',
          price: prevHigh.price,
          index: currentHigh.index,
          direction: 'BUY',
          strength: ((currentHigh.price - prevHigh.price) / prevHigh.price) * 100
        });
      }
    }

    // Bearish BOS: preço quebra abaixo do último swing low
    for (let i = 1; i < swingPoints.lows.length; i++) {
      const prevLow = swingPoints.lows[i - 1];
      const currentLow = swingPoints.lows[i];

      if (currentLow.price < prevLow.price) {
        bosSignals.push({
          type: 'BEARISH_BOS',
          price: prevLow.price,
          index: currentLow.index,
          direction: 'SELL',
          strength: ((prevLow.price - currentLow.price) / prevLow.price) * 100
        });
      }
    }

    return bosSignals;
  }

  /**
   * Detecta Change of Character (CHoCH) - Mudança de caráter / reversão
   */
  detectChangeOfCharacter(candles) {
    const chochSignals = [];
    const swingPoints = this.identifySwingPoints(candles);

    // CHoCH Bullish: Em tendência de baixa, quebra o último swing high
    for (let i = 2; i < swingPoints.lows.length; i++) {
      const prevLow = swingPoints.lows[i - 2];
      const currentLow = swingPoints.lows[i - 1];

      // Confirmando tendência de baixa (lower lows)
      if (currentLow.price < prevLow.price) {
        // Procura por quebra do swing high entre esses lows
        const highsBetween = swingPoints.highs.filter(
          h => h.index > prevLow.index && h.index < currentLow.index
        );

        if (highsBetween.length > 0) {
          const lastHigh = highsBetween[highsBetween.length - 1];

          // Verifica se preço quebrou acima desse high
          for (let j = currentLow.index; j < candles.length; j++) {
            if (candles[j].close > lastHigh.price) {
              chochSignals.push({
                type: 'BULLISH_CHOCH',
                price: lastHigh.price,
                index: j,
                direction: 'BUY',
                strength: ((candles[j].close - lastHigh.price) / lastHigh.price) * 100
              });
              break;
            }
          }
        }
      }
    }

    // CHoCH Bearish: Em tendência de alta, quebra o último swing low
    for (let i = 2; i < swingPoints.highs.length; i++) {
      const prevHigh = swingPoints.highs[i - 2];
      const currentHigh = swingPoints.highs[i - 1];

      // Confirmando tendência de alta (higher highs)
      if (currentHigh.price > prevHigh.price) {
        // Procura por quebra do swing low entre esses highs
        const lowsBetween = swingPoints.lows.filter(
          l => l.index > prevHigh.index && l.index < currentHigh.index
        );

        if (lowsBetween.length > 0) {
          const lastLow = lowsBetween[lowsBetween.length - 1];

          // Verifica se preço quebrou abaixo desse low
          for (let j = currentHigh.index; j < candles.length; j++) {
            if (candles[j].close < lastLow.price) {
              chochSignals.push({
                type: 'BEARISH_CHOCH',
                price: lastLow.price,
                index: j,
                direction: 'SELL',
                strength: ((lastLow.price - candles[j].close) / lastLow.price) * 100
              });
              break;
            }
          }
        }
      }
    }

    return chochSignals;
  }

  /**
   * Detecta Fair Value Gaps (FVG) - Gaps de desequilíbrio
   */
  detectFairValueGaps(candles) {
    const fvgs = [];

    for (let i = 2; i < candles.length; i++) {
      const candle1 = candles[i - 2];
      const candle2 = candles[i - 1];
      const candle3 = candles[i];

      // Bullish FVG: gap entre candle1.high e candle3.low
      if (candle1.high < candle3.low) {
        fvgs.push({
          type: 'BULLISH_FVG',
          index: i - 1,
          top: candle3.low,
          bottom: candle1.high,
          size: candle3.low - candle1.high,
          filled: false,
          partiallyFilled: false
        });
      }

      // Bearish FVG: gap entre candle3.high e candle1.low
      if (candle3.high < candle1.low) {
        fvgs.push({
          type: 'BEARISH_FVG',
          index: i - 1,
          top: candle1.low,
          bottom: candle3.high,
          size: candle1.low - candle3.high,
          filled: false,
          partiallyFilled: false
        });
      }
    }

    // Verifica se FVGs foram preenchidos
    this.checkFVGFill(candles, fvgs);

    return fvgs;
  }

  /**
   * Verifica se Fair Value Gaps foram preenchidos
   */
  checkFVGFill(candles, fvgs) {
    for (const fvg of fvgs) {
      const midPoint = (fvg.top + fvg.bottom) / 2;

      for (let i = fvg.index + 1; i < candles.length; i++) {
        const candle = candles[i];

        if (fvg.type === 'BULLISH_FVG') {
          // Preço retornou ao FVG
          if (candle.low <= fvg.top && candle.low >= fvg.bottom) {
            fvg.partiallyFilled = true;

            // FVG completamente preenchido (passou do meio)
            if (candle.low <= midPoint) {
              fvg.filled = true;
              break;
            }
          }
        } else if (fvg.type === 'BEARISH_FVG') {
          // Preço retornou ao FVG
          if (candle.high >= fvg.bottom && candle.high <= fvg.top) {
            fvg.partiallyFilled = true;

            // FVG completamente preenchido (passou do meio)
            if (candle.high >= midPoint) {
              fvg.filled = true;
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Calcula zonas de Premium e Discount baseadas em Fibonacci
   */
  calculatePremiumDiscount(candles) {
    if (candles.length < 50) return null;

    // Pega últimos 50 candles para calcular range
    const recentCandles = candles.slice(-50);

    const high = Math.max(...recentCandles.map(c => c.high));
    const low = Math.min(...recentCandles.map(c => c.low));
    const range = high - low;

    const currentPrice = candles[candles.length - 1].close;

    const levels = {
      high,
      low,
      range,
      currentPrice,
      equilibrium: low + (range * 0.5), // 50%
      premiumZone: {
        start: low + (range * 0.618), // 61.8%
        end: high
      },
      discountZone: {
        start: low,
        end: low + (range * 0.382) // 38.2%
      },
      currentZone: null,
      fibonacci: {
        '0': low,
        '23.6': low + (range * 0.236),
        '38.2': low + (range * 0.382),
        '50': low + (range * 0.5),
        '61.8': low + (range * 0.618),
        '78.6': low + (range * 0.786),
        '100': high
      }
    };

    // Determina zona atual
    if (currentPrice >= levels.premiumZone.start) {
      levels.currentZone = 'PREMIUM';
    } else if (currentPrice <= levels.discountZone.end) {
      levels.currentZone = 'DISCOUNT';
    } else {
      levels.currentZone = 'EQUILIBRIUM';
    }

    return levels;
  }

  /**
   * Detecta Liquidity Voids (áreas sem negociação)
   */
  detectLiquidityVoids(candles) {
    const voids = [];

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const current = candles[i];

      // Gap significativo entre candles
      const gapSize = Math.abs(current.open - prev.close);
      const avgBody = (Math.abs(prev.close - prev.open) + Math.abs(current.close - current.open)) / 2;

      // Gap maior que 2x o corpo médio
      if (gapSize > avgBody * 2) {
        voids.push({
          index: i,
          top: Math.max(prev.close, current.open),
          bottom: Math.min(prev.close, current.open),
          size: gapSize,
          direction: current.open > prev.close ? 'BULLISH' : 'BEARISH'
        });
      }
    }

    return voids;
  }

  /**
   * Detecta manipulação institucional
   */
  detectManipulation(candles) {
    const manipulation = {
      detected: false,
      type: null,
      confidence: 0,
      description: null
    };

    if (candles.length < 20) return manipulation;

    const recent = candles.slice(-20);
    const lastCandle = recent[recent.length - 1];

    // Calcula ATR para contexto de volatilidade
    const atr = this.calculateATR(recent, 14);

    // Wick anormalmente grande (> 3x ATR) = possível manipulação
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

    if (upperWick > atr * 3) {
      manipulation.detected = true;
      manipulation.type = 'BEARISH_MANIPULATION';
      manipulation.confidence = Math.min(95, (upperWick / atr) * 20);
      manipulation.description = 'Wick superior anormal - Rejeição institucional de compras';
    }

    if (lowerWick > atr * 3) {
      manipulation.detected = true;
      manipulation.type = 'BULLISH_MANIPULATION';
      manipulation.confidence = Math.min(95, (lowerWick / atr) * 20);
      manipulation.description = 'Wick inferior anormal - Rejeição institucional de vendas';
    }

    return manipulation;
  }

  /**
   * Calcula Average True Range (ATR)
   */
  calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;

    let trSum = 0;

    for (let i = candles.length - period; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );

      trSum += tr;
    }

    return trSum / period;
  }

  /**
   * Determina tendência baseada em estrutura Smart Money
   */
  determineTrend(analysis) {
    let bullishSignals = 0;
    let bearishSignals = 0;

    // BOS
    const recentBOS = analysis.bos.slice(-3);
    for (const bos of recentBOS) {
      if (bos.type === 'BULLISH_BOS') bullishSignals += 2;
      if (bos.type === 'BEARISH_BOS') bearishSignals += 2;
    }

    // CHoCH (mais peso pois indica reversão)
    const recentCHoCH = analysis.choch.slice(-2);
    for (const choch of recentCHoCH) {
      if (choch.type === 'BULLISH_CHOCH') bullishSignals += 3;
      if (choch.type === 'BEARISH_CHOCH') bearishSignals += 3;
    }

    // Order Blocks ativos
    const activeOBs = analysis.orderBlocks.filter(ob => !ob.mitigated);
    for (const ob of activeOBs) {
      if (ob.type === 'BULLISH_OB') bullishSignals += 1;
      if (ob.type === 'BEARISH_OB') bearishSignals += 1;
    }

    // Premium/Discount
    if (analysis.premiumDiscount) {
      if (analysis.premiumDiscount.currentZone === 'DISCOUNT') bullishSignals += 1;
      if (analysis.premiumDiscount.currentZone === 'PREMIUM') bearishSignals += 1;
    }

    // Decisão
    if (bullishSignals > bearishSignals + 2) return 'BULLISH';
    if (bearishSignals > bullishSignals + 2) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Determina fase do mercado (Manipulação, Acumulação, Distribuição)
   */
  determinePhase(analysis) {
    // Manipulação: sweeps recentes + volatilidade
    const recentSweeps = analysis.liquidity.sweeps.slice(-3);
    if (recentSweeps.length > 0 && analysis.manipulation.detected) {
      return 'MANIPULATION';
    }

    // Acumulação: range apertado + ordem blocks bullish
    const activeBullishOBs = analysis.orderBlocks.filter(
      ob => ob.type === 'BULLISH_OB' && !ob.mitigated
    ).length;

    if (activeBullishOBs >= 2 && analysis.trend === 'BULLISH') {
      return 'ACCUMULATION';
    }

    // Distribuição: range apertado + order blocks bearish
    const activeBearishOBs = analysis.orderBlocks.filter(
      ob => ob.type === 'BEARISH_OB' && !ob.mitigated
    ).length;

    if (activeBearishOBs >= 2 && analysis.trend === 'BEARISH') {
      return 'DISTRIBUTION';
    }

    return 'CONSOLIDATION';
  }

  /**
   * Retorna o nível institucional mais importante
   */
  getKeyInstitutionalLevel(analysis) {
    const levels = [];

    // Order Blocks ativos (não mitigados)
    const activeOBs = analysis.orderBlocks.filter(ob => !ob.mitigated);
    for (const ob of activeOBs) {
      levels.push({
        type: 'ORDER_BLOCK',
        direction: ob.type === 'BULLISH_OB' ? 'BUY' : 'SELL',
        price: (ob.high + ob.low) / 2,
        strength: ob.strength,
        index: ob.index
      });
    }

    // Fair Value Gaps não preenchidos
    const activeFVGs = analysis.fvg.filter(fvg => !fvg.filled);
    for (const fvg of activeFVGs) {
      levels.push({
        type: 'FVG',
        direction: fvg.type === 'BULLISH_FVG' ? 'BUY' : 'SELL',
        price: (fvg.top + fvg.bottom) / 2,
        strength: 70,
        index: fvg.index
      });
    }

    // Equal Highs/Lows
    for (const eqHigh of analysis.liquidity.equalHighs) {
      levels.push({
        type: 'EQUAL_HIGHS',
        direction: 'SELL',
        price: eqHigh.price,
        strength: eqHigh.strength,
        index: eqHigh.indices[1]
      });
    }

    for (const eqLow of analysis.liquidity.equalLows) {
      levels.push({
        type: 'EQUAL_LOWS',
        direction: 'BUY',
        price: eqLow.price,
        strength: eqLow.strength,
        index: eqLow.indices[1]
      });
    }

    // Retorna o mais recente e forte
    if (levels.length === 0) return null;

    levels.sort((a, b) => {
      // Prioriza mais recente
      if (b.index !== a.index) return b.index - a.index;
      // Em caso de empate, prioriza força
      return b.strength - a.strength;
    });

    return levels[0];
  }

  /**
   * Determina viés geral baseado em 4H e 1H
   */
  determineOverallBias(tf4H, tf1H) {
    if (!tf4H || !tf1H) return null;

    // 4H tem mais peso que 1H
    const bias4H = tf4H.trend;
    const bias1H = tf1H.trend;

    // Se 4H e 1H estão alinhados
    if (bias4H === bias1H && bias4H !== 'NEUTRAL') {
      return {
        direction: bias4H,
        confidence: 95,
        description: `Forte tendência ${bias4H} em 4H e 1H alinhados`
      };
    }

    // Se 4H é claro mas 1H é neutro
    if (bias4H !== 'NEUTRAL' && bias1H === 'NEUTRAL') {
      return {
        direction: bias4H,
        confidence: 75,
        description: `Tendência ${bias4H} em 4H, 1H neutro`
      };
    }

    // Se estão em conflito
    if (bias4H !== bias1H && bias4H !== 'NEUTRAL' && bias1H !== 'NEUTRAL') {
      return {
        direction: 'CONFLICTED',
        confidence: 30,
        description: `Conflito: 4H ${bias4H}, 1H ${bias1H} - NÃO OPERAR`
      };
    }

    return {
      direction: 'NEUTRAL',
      confidence: 50,
      description: 'Sem viés claro'
    };
  }

  /**
   * Verifica alinhamento de todos os timeframes
   */
  checkAlignment(timeframes) {
    const trends = [];

    for (const tf of this.timeframes) {
      if (timeframes[tf] && timeframes[tf].trend) {
        trends.push(timeframes[tf].trend);
      }
    }

    // Todos bullish
    if (trends.every(t => t === 'BULLISH')) {
      return {
        aligned: true,
        direction: 'BULLISH',
        confidence: 100
      };
    }

    // Todos bearish
    if (trends.every(t => t === 'BEARISH')) {
      return {
        aligned: true,
        direction: 'BEARISH',
        confidence: 100
      };
    }

    // Maioria bullish
    const bullishCount = trends.filter(t => t === 'BULLISH').length;
    const bearishCount = trends.filter(t => t === 'BEARISH').length;

    if (bullishCount > bearishCount) {
      return {
        aligned: false,
        direction: 'BULLISH',
        confidence: (bullishCount / trends.length) * 100
      };
    }

    if (bearishCount > bullishCount) {
      return {
        aligned: false,
        direction: 'BEARISH',
        confidence: (bearishCount / trends.length) * 100
      };
    }

    return {
      aligned: false,
      direction: 'NEUTRAL',
      confidence: 50
    };
  }

  /**
   * Determina se está pronto para operar
   */
  isReadyToTrade(analysis) {
    // Regras institucionais rígidas
    const rules = {
      has4HBias: analysis.timeframes['4H'] && analysis.timeframes['4H'].trend !== 'NEUTRAL',
      has1HBias: analysis.timeframes['1H'] && analysis.timeframes['1H'].trend !== 'NEUTRAL',
      aligned4H1H: analysis.overallBias && analysis.overallBias.direction !== 'CONFLICTED',
      hasConfirmation: analysis.timeframes['15M'] && analysis.timeframes['15M'].trend !== 'NEUTRAL',
      hasEntry: analysis.timeframes['5M'] && analysis.timeframes['5M'].institutionalLevel !== null,
      highConfidence: analysis.overallBias && analysis.overallBias.confidence >= 70
    };

    const allRulesMet = Object.values(rules).every(r => r === true);

    return {
      ready: allRulesMet,
      rules,
      missingRules: Object.keys(rules).filter(key => !rules[key])
    };
  }
}

module.exports = SmartMoneyEngine;
