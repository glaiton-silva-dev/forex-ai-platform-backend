/**
 * ========================================
 * CORRELATION ENGINE - Motor de Análise de Correlação entre Mercados
 * ========================================
 *
 * Analisa correlação com múltiplos mercados:
 * - DXY (Índice do Dólar)
 * - Ouro (XAUUSD)
 * - S&P 500
 * - Nasdaq
 * - VIX (Volatility Index)
 * - Petróleo (WTI)
 *
 * Bloqueia operações que vão contra correlações fortes
 */

class CorrelationEngine {
  constructor() {
    // Matriz de correlações (valores entre -1 e +1)
    this.correlationMatrix = {
      'EURUSD': {
        'DXY': -0.95,      // Fortemente inversa
        'GOLD': 0.75,      // Positiva
        'SPX': 0.45,       // Moderada positiva
        'NASDAQ': 0.40,
        'VIX': -0.50,      // Inversa moderada
        'WTI': 0.30
      },
      'GBPUSD': {
        'DXY': -0.90,
        'GOLD': 0.65,
        'SPX': 0.50,
        'NASDAQ': 0.45,
        'VIX': -0.55,
        'WTI': 0.25
      },
      'USDJPY': {
        'DXY': 0.70,       // Positiva (ambos USD)
        'GOLD': -0.60,
        'SPX': -0.35,
        'NASDAQ': -0.40,
        'VIX': 0.65,       // Positiva (safe haven)
        'WTI': -0.30
      },
      'AUDUSD': {
        'DXY': -0.85,
        'GOLD': 0.80,      // Muito forte (AUD = commodity currency)
        'SPX': 0.60,
        'NASDAQ': 0.55,
        'VIX': -0.60,
        'WTI': 0.50
      },
      'USDCAD': {
        'DXY': 0.75,
        'GOLD': -0.50,
        'SPX': -0.40,
        'NASDAQ': -0.35,
        'VIX': 0.45,
        'WTI': -0.75       // Muito forte (CAD = petróleo)
      }
    };

    // Dados de mercado simulados (em produção, viria de API)
    this.marketData = {
      'DXY': { price: 103.5, change: 0.3, trend: 'BULLISH' },
      'GOLD': { price: 2045, change: -0.5, trend: 'BEARISH' },
      'SPX': { price: 4780, change: 0.8, trend: 'BULLISH' },
      'NASDAQ': { price: 15200, change: 1.2, trend: 'BULLISH' },
      'VIX': { price: 13.5, change: -5.0, trend: 'BEARISH' },
      'WTI': { price: 73.2, change: 1.5, trend: 'BULLISH' }
    };
  }

  /**
   * Análise completa de correlação para um par
   * @param {String} pair - Par de moedas
   * @param {String} direction - Direção proposta (BUY/SELL)
   * @returns {Object} Análise de correlação
   */
  analyze(pair, direction) {
    const correlations = this.correlationMatrix[pair] || this.estimateCorrelations(pair);

    const correlationAnalysis = [];
    let alignedCount = 0;
    let conflictCount = 0;
    let totalWeight = 0;

    // Analisa cada mercado correlacionado
    for (const [market, correlation] of Object.entries(correlations)) {
      const marketInfo = this.marketData[market];
      const analysis = this.analyzeCorrelation(pair, direction, market, correlation, marketInfo);

      correlationAnalysis.push(analysis);

      if (analysis.aligned) {
        alignedCount++;
        totalWeight += Math.abs(correlation);
      } else if (analysis.conflict) {
        conflictCount++;
        totalWeight -= Math.abs(correlation);
      }
    }

    // Calcula score geral de alinhamento
    const totalCorrelations = Object.keys(correlations).length;
    const alignmentScore = ((alignedCount - conflictCount) / totalCorrelations) * 100;

    // Decisão final
    const decision = this.makeDecision(alignmentScore, conflictCount, correlationAnalysis);

    return {
      timestamp: new Date(),
      pair,
      direction,
      correlations: correlationAnalysis,
      summary: {
        totalMarkets: totalCorrelations,
        aligned: alignedCount,
        conflicts: conflictCount,
        neutral: totalCorrelations - alignedCount - conflictCount,
        alignmentScore,
        totalWeight
      },
      decision,
      allowTrade: decision.allow,
      blockingFactors: decision.blockingFactors
    };
  }

  /**
   * Analisa correlação individual com um mercado
   */
  analyzeCorrelation(pair, direction, market, correlation, marketInfo) {
    const isStrongCorrelation = Math.abs(correlation) > 0.7;
    const isModerateCorrelation = Math.abs(correlation) > 0.4;

    // Determina se a correlação apoia ou conflita com a direção proposta
    let aligned = false;
    let conflict = false;
    let expectedMove = null;

    if (direction === 'BUY') {
      // Comprando o par
      if (correlation > 0) {
        // Correlação positiva: mercado deveria estar subindo
        expectedMove = 'UP';
        aligned = marketInfo.trend === 'BULLISH';
        conflict = marketInfo.trend === 'BEARISH' && isStrongCorrelation;
      } else {
        // Correlação negativa: mercado deveria estar caindo
        expectedMove = 'DOWN';
        aligned = marketInfo.trend === 'BEARISH';
        conflict = marketInfo.trend === 'BULLISH' && isStrongCorrelation;
      }
    } else if (direction === 'SELL') {
      // Vendendo o par
      if (correlation > 0) {
        // Correlação positiva: mercado deveria estar caindo
        expectedMove = 'DOWN';
        aligned = marketInfo.trend === 'BEARISH';
        conflict = marketInfo.trend === 'BULLISH' && isStrongCorrelation;
      } else {
        // Correlação negativa: mercado deveria estar subindo
        expectedMove = 'UP';
        aligned = marketInfo.trend === 'BULLISH';
        conflict = marketInfo.trend === 'BEARISH' && isStrongCorrelation;
      }
    }

    return {
      market,
      correlation,
      strength: isStrongCorrelation ? 'STRONG' : isModerateCorrelation ? 'MODERATE' : 'WEAK',
      marketPrice: marketInfo.price,
      marketChange: marketInfo.change,
      marketTrend: marketInfo.trend,
      expectedMove,
      aligned,
      conflict,
      weight: Math.abs(correlation),
      description: this.generateCorrelationDescription(pair, direction, market, correlation, marketInfo, aligned, conflict)
    };
  }

  /**
   * Gera descrição textual da correlação
   */
  generateCorrelationDescription(pair, direction, market, correlation, marketInfo, aligned, conflict) {
    const corrType = correlation > 0 ? 'positiva' : 'negativa';
    const corrStrength = Math.abs(correlation) > 0.7 ? 'forte' : Math.abs(correlation) > 0.4 ? 'moderada' : 'fraca';

    let desc = `${market}: correlação ${corrStrength} ${corrType} (${correlation.toFixed(2)}). `;
    desc += `Atualmente ${marketInfo.trend} (${marketInfo.change > 0 ? '+' : ''}${marketInfo.change.toFixed(1)}%). `;

    if (aligned) {
      desc += `✓ ALINHADO com ${direction} em ${pair}`;
    } else if (conflict) {
      desc += `✗ CONFLITO com ${direction} em ${pair} - RISCO ALTO`;
    } else {
      desc += `~ Neutro / correlação fraca`;
    }

    return desc;
  }

  /**
   * Toma decisão baseada nas correlações
   */
  makeDecision(alignmentScore, conflictCount, correlationAnalysis) {
    const strongConflicts = correlationAnalysis.filter(
      c => c.conflict && c.strength === 'STRONG'
    );

    const blockingFactors = [];

    // BLOQUEIO 1: Conflito com correlação forte
    if (strongConflicts.length > 0) {
      for (const conflict of strongConflicts) {
        blockingFactors.push({
          type: 'STRONG_CORRELATION_CONFLICT',
          severity: 'HIGH',
          market: conflict.market,
          correlation: conflict.correlation,
          description: conflict.description,
          recommendation: 'NÃO OPERAR - Mercado correlacionado se move na direção oposta'
        });
      }
    }

    // BLOQUEIO 2: Múltiplos conflitos moderados
    const moderateConflicts = correlationAnalysis.filter(
      c => c.conflict && c.strength === 'MODERATE'
    );

    if (moderateConflicts.length >= 2) {
      blockingFactors.push({
        type: 'MULTIPLE_CORRELATION_CONFLICTS',
        severity: 'MEDIUM',
        count: moderateConflicts.length,
        markets: moderateConflicts.map(c => c.market),
        recommendation: 'CUIDADO - Múltiplos mercados correlacionados em conflito'
      });
    }

    // BLOQUEIO 3: Score de alinhamento muito baixo
    if (alignmentScore < -30) {
      blockingFactors.push({
        type: 'LOW_ALIGNMENT_SCORE',
        severity: 'MEDIUM',
        score: alignmentScore,
        recommendation: 'Correlações majoritariamente contra a operação'
      });
    }

    // Decisão final
    const allow = blockingFactors.filter(b => b.severity === 'HIGH').length === 0;

    return {
      allow,
      confidence: allow ? Math.max(0, alignmentScore) : 0,
      alignmentScore,
      blockingFactors,
      recommendation: allow
        ? blockingFactors.length > 0
          ? 'PERMITIDO COM CAUTELA - Existem conflitos moderados'
          : 'PERMITIDO - Correlações alinhadas'
        : 'BLOQUEADO - Conflitos fortes com mercados correlacionados'
    };
  }

  /**
   * Estima correlações para pares não mapeados
   */
  estimateCorrelations(pair) {
    const [base, quote] = this.parsePair(pair);

    // Correlações padrão baseadas na moeda
    const baseCorr = this.getCurrencyCorrelations(base);
    const quoteCorr = this.getCurrencyCorrelations(quote);

    // Combina correlações (base positiva, quote negativa)
    const combined = {};

    for (const market of Object.keys(baseCorr)) {
      combined[market] = baseCorr[market] - quoteCorr[market] * 0.5;
    }

    return combined;
  }

  /**
   * Retorna correlações típicas de uma moeda
   */
  getCurrencyCorrelations(currency) {
    const defaults = {
      'USD': { 'DXY': 0.95, 'GOLD': -0.70, 'SPX': -0.40, 'NASDAQ': -0.35, 'VIX': 0.55, 'WTI': -0.30 },
      'EUR': { 'DXY': -0.90, 'GOLD': 0.70, 'SPX': 0.40, 'NASDAQ': 0.35, 'VIX': -0.50, 'WTI': 0.25 },
      'GBP': { 'DXY': -0.85, 'GOLD': 0.65, 'SPX': 0.45, 'NASDAQ': 0.40, 'VIX': -0.55, 'WTI': 0.20 },
      'JPY': { 'DXY': 0.50, 'GOLD': -0.40, 'SPX': -0.60, 'NASDAQ': -0.55, 'VIX': 0.70, 'WTI': -0.35 },
      'CHF': { 'DXY': -0.30, 'GOLD': 0.50, 'SPX': -0.50, 'NASDAQ': -0.45, 'VIX': 0.60, 'WTI': -0.20 },
      'AUD': { 'DXY': -0.85, 'GOLD': 0.80, 'SPX': 0.60, 'NASDAQ': 0.55, 'VIX': -0.65, 'WTI': 0.50 },
      'NZD': { 'DXY': -0.80, 'GOLD': 0.75, 'SPX': 0.55, 'NASDAQ': 0.50, 'VIX': -0.60, 'WTI': 0.45 },
      'CAD': { 'DXY': -0.75, 'GOLD': 0.50, 'SPX': 0.40, 'NASDAQ': 0.35, 'VIX': -0.45, 'WTI': 0.75 }
    };

    return defaults[currency] || { 'DXY': 0, 'GOLD': 0, 'SPX': 0, 'NASDAQ': 0, 'VIX': 0, 'WTI': 0 };
  }

  parsePair(pair) {
    return [pair.substring(0, 3), pair.substring(3, 6)];
  }

  /**
   * Atualiza dados de mercado (em produção, viria de WebSocket/API)
   */
  updateMarketData(market, price, change, trend) {
    if (this.marketData[market]) {
      this.marketData[market] = { price, change, trend };
    }
  }

  /**
   * Detecta divergências de correlação (sinal de reversão)
   */
  detectDivergence(pair, priceDirection) {
    const correlations = this.correlationMatrix[pair] || this.estimateCorrelations(pair);
    const divergences = [];

    for (const [market, correlation] of Object.entries(correlations)) {
      if (Math.abs(correlation) > 0.6) { // Apenas correlações fortes
        const marketInfo = this.marketData[market];

        // Correlação positiva mas movimentos opostos
        if (correlation > 0.6) {
          if (priceDirection === 'UP' && marketInfo.trend === 'BEARISH') {
            divergences.push({
              market,
              type: 'BEARISH_DIVERGENCE',
              description: `${pair} subindo mas ${market} caindo - possível reversão em ${pair}`,
              signal: 'SELL',
              strength: Math.abs(correlation) * 100
            });
          } else if (priceDirection === 'DOWN' && marketInfo.trend === 'BULLISH') {
            divergences.push({
              market,
              type: 'BULLISH_DIVERGENCE',
              description: `${pair} caindo mas ${market} subindo - possível reversão em ${pair}`,
              signal: 'BUY',
              strength: Math.abs(correlation) * 100
            });
          }
        }

        // Correlação negativa mas movimentos alinhados
        if (correlation < -0.6) {
          if (priceDirection === 'UP' && marketInfo.trend === 'BULLISH') {
            divergences.push({
              market,
              type: 'BEARISH_DIVERGENCE',
              description: `${pair} e ${market} subindo juntos (correlação negativa) - possível reversão`,
              signal: 'SELL',
              strength: Math.abs(correlation) * 100
            });
          } else if (priceDirection === 'DOWN' && marketInfo.trend === 'BEARISH') {
            divergences.push({
              market,
              type: 'BULLISH_DIVERGENCE',
              description: `${pair} e ${market} caindo juntos (correlação negativa) - possível reversão`,
              signal: 'BUY',
              strength: Math.abs(correlation) * 100
            });
          }
        }
      }
    }

    return divergences;
  }

  /**
   * Análise de força relativa baseada em correlações
   */
  analyzeRelativeStrength(pair) {
    const correlations = this.correlationMatrix[pair] || this.estimateCorrelations(pair);

    let bullishWeight = 0;
    let bearishWeight = 0;

    for (const [market, correlation] of Object.entries(correlations)) {
      const marketInfo = this.marketData[market];
      const weight = Math.abs(correlation);

      if (correlation > 0 && marketInfo.trend === 'BULLISH') {
        bullishWeight += weight;
      } else if (correlation > 0 && marketInfo.trend === 'BEARISH') {
        bearishWeight += weight;
      } else if (correlation < 0 && marketInfo.trend === 'BEARISH') {
        bullishWeight += weight;
      } else if (correlation < 0 && marketInfo.trend === 'BULLISH') {
        bearishWeight += weight;
      }
    }

    const totalWeight = bullishWeight + bearishWeight;
    const relativeStrength = totalWeight > 0 ? (bullishWeight / totalWeight) * 100 : 50;

    return {
      bullishWeight,
      bearishWeight,
      relativeStrength,
      signal: relativeStrength > 60 ? 'BUY' : relativeStrength < 40 ? 'SELL' : 'NEUTRAL',
      confidence: Math.abs(relativeStrength - 50) * 2
    };
  }
}

module.exports = CorrelationEngine;
