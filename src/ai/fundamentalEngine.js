/**
 * ========================================
 * FUNDAMENTAL MACRO ENGINE - Motor de Análise Fundamentalista Macroeconômica
 * ========================================
 *
 * Analisa dados macroeconômicos e eventos de bancos centrais:
 * - FED, ECB, BOE (taxas de juros)
 * - CPI, PPI (inflação)
 * - NFP (emprego)
 * - PMI (manufatura)
 * - Discursos de bancos centrais
 * - Ambiente Risk-on / Risk-off
 *
 * Classifica impacto: Fortemente Altista, Altista, Neutro, Baixista, Fortemente Baixista
 */

class FundamentalEngine {
  constructor() {
    this.economicCalendar = [];
    this.centralBankData = {
      FED: { rate: 5.5, bias: 'HAWKISH', lastUpdate: null },
      ECB: { rate: 4.5, bias: 'HAWKISH', lastUpdate: null },
      BOE: { rate: 5.25, bias: 'NEUTRAL', lastUpdate: null }
    };

    this.macroIndicators = {
      US: { cpi: 3.2, ppi: 2.7, nfp: 250000, pmi: 52.5, gdp: 2.1 },
      EU: { cpi: 2.9, ppi: 2.3, pmi: 47.8, gdp: 0.8 },
      UK: { cpi: 4.1, ppi: 3.2, pmi: 48.2, gdp: 0.5 }
    };

    this.marketSentiment = 'RISK_ON'; // RISK_ON, RISK_OFF, NEUTRAL
  }

  /**
   * Análise fundamentalista completa para um par de moedas
   * @param {String} pair - Par de moedas (ex: 'EURUSD', 'GBPUSD')
   * @returns {Object} Análise fundamentalista completa
   */
  async analyze(pair) {
    const [base, quote] = this.parsePair(pair);

    // Análise de cada moeda
    const baseAnalysis = await this.analyzeCurrency(base);
    const quoteAnalysis = await this.analyzeCurrency(quote);

    // Análise de diferencial de juros
    const interestRateDiff = this.analyzeInterestRateDifferential(base, quote);

    // Análise de inflação relativa
    const inflationDiff = this.analyzeInflationDifferential(base, quote);

    // Análise de crescimento econômico
    const growthDiff = this.analyzeGrowthDifferential(base, quote);

    // Análise do calendário econômico
    const upcomingEvents = this.getUpcomingEvents(pair);

    // Análise de risk sentiment
    const riskSentiment = this.analyzeRiskSentiment(pair);

    // Correlação com commodities
    const commodityCorrelation = this.analyzeCommodityCorrelation(pair);

    // Decisão fundamentalista final
    const fundamentalBias = this.determineFundamentalBias(
      baseAnalysis,
      quoteAnalysis,
      interestRateDiff,
      inflationDiff,
      growthDiff,
      riskSentiment
    );

    return {
      timestamp: new Date(),
      pair,
      base: baseAnalysis,
      quote: quoteAnalysis,
      interestRateDiff,
      inflationDiff,
      growthDiff,
      upcomingEvents,
      riskSentiment,
      commodityCorrelation,
      fundamentalBias,
      tradingRecommendation: this.getTradeRecommendation(fundamentalBias),
      blockingFactors: this.getBlockingFactors(fundamentalBias, upcomingEvents)
    };
  }

  /**
   * Parse par de moedas
   */
  parsePair(pair) {
    // EURUSD -> ['EUR', 'USD']
    const base = pair.substring(0, 3);
    const quote = pair.substring(3, 6);
    return [base, quote];
  }

  /**
   * Análise fundamentalista de uma moeda individual
   */
  async analyzeCurrency(currency) {
    const region = this.getRegion(currency);
    const centralBank = this.getCentralBank(currency);

    const analysis = {
      currency,
      region,
      centralBank: {
        name: centralBank,
        rate: this.centralBankData[centralBank]?.rate || 0,
        bias: this.centralBankData[centralBank]?.bias || 'NEUTRAL',
        nextMeeting: this.getNextMeetingDate(centralBank)
      },
      inflation: {
        cpi: this.macroIndicators[region]?.cpi || 0,
        ppi: this.macroIndicators[region]?.ppi || 0,
        trend: this.getInflationTrend(region),
        target: 2.0,
        aboveTarget: (this.macroIndicators[region]?.cpi || 0) > 2.0
      },
      growth: {
        gdp: this.macroIndicators[region]?.gdp || 0,
        pmi: this.macroIndicators[region]?.pmi || 0,
        expanding: (this.macroIndicators[region]?.pmi || 0) > 50
      },
      employment: {
        nfp: this.macroIndicators[region]?.nfp || null,
        trend: 'STABLE'
      },
      score: 0,
      classification: null
    };

    // Calcula score fundamentalista
    analysis.score = this.calculateCurrencyScore(analysis);
    analysis.classification = this.classifyCurrency(analysis.score);

    return analysis;
  }

  /**
   * Retorna região baseada na moeda
   */
  getRegion(currency) {
    const map = {
      'USD': 'US',
      'EUR': 'EU',
      'GBP': 'UK',
      'JPY': 'JP',
      'CHF': 'CH',
      'AUD': 'AU',
      'NZD': 'NZ',
      'CAD': 'CA'
    };
    return map[currency] || 'US';
  }

  /**
   * Retorna banco central baseado na moeda
   */
  getCentralBank(currency) {
    const map = {
      'USD': 'FED',
      'EUR': 'ECB',
      'GBP': 'BOE',
      'JPY': 'BOJ',
      'CHF': 'SNB',
      'AUD': 'RBA',
      'NZD': 'RBNZ',
      'CAD': 'BOC'
    };
    return map[currency] || 'FED';
  }

  /**
   * Retorna próxima reunião do banco central
   */
  getNextMeetingDate(centralBank) {
    // Simulação - em produção, usaria calendário real
    const dates = {
      'FED': '2026-02-01',
      'ECB': '2026-01-25',
      'BOE': '2026-02-05'
    };
    return dates[centralBank] || null;
  }

  /**
   * Analisa tendência de inflação
   */
  getInflationTrend(region) {
    // Simulação - em produção, compararia dados históricos
    const cpi = this.macroIndicators[region]?.cpi || 0;

    if (cpi > 3.5) return 'RISING';
    if (cpi < 2.5) return 'FALLING';
    return 'STABLE';
  }

  /**
   * Calcula score de força de uma moeda (0-100)
   */
  calculateCurrencyScore(analysis) {
    let score = 50; // Neutro

    // Taxa de juros (peso 30%)
    const rate = analysis.centralBank.rate;
    if (rate > 5.0) score += 15;
    else if (rate > 3.0) score += 10;
    else if (rate < 1.0) score -= 10;

    // Bias do banco central (peso 20%)
    if (analysis.centralBank.bias === 'HAWKISH') score += 10;
    else if (analysis.centralBank.bias === 'DOVISH') score -= 10;

    // Inflação (peso 20%)
    if (analysis.inflation.aboveTarget && analysis.inflation.trend === 'RISING') {
      score += 10; // Provável alta de juros
    } else if (!analysis.inflation.aboveTarget && analysis.inflation.trend === 'FALLING') {
      score -= 5; // Possível corte de juros
    }

    // Crescimento econômico (peso 20%)
    if (analysis.growth.expanding && analysis.growth.gdp > 2.0) {
      score += 10;
    } else if (!analysis.growth.expanding && analysis.growth.gdp < 1.0) {
      score -= 10;
    }

    // PMI (peso 10%)
    if (analysis.growth.pmi > 55) score += 5;
    else if (analysis.growth.pmi < 45) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Classifica moeda baseada no score
   */
  classifyCurrency(score) {
    if (score >= 80) return 'FORTEMENTE_ALTISTA';
    if (score >= 65) return 'ALTISTA';
    if (score >= 45 && score <= 55) return 'NEUTRO';
    if (score >= 30) return 'BAIXISTA';
    return 'FORTEMENTE_BAIXISTA';
  }

  /**
   * Analisa diferencial de taxas de juros
   */
  analyzeInterestRateDifferential(base, quote) {
    const baseCB = this.getCentralBank(base);
    const quoteCB = this.getCentralBank(quote);

    const baseRate = this.centralBankData[baseCB]?.rate || 0;
    const quoteRate = this.centralBankData[quoteCB]?.rate || 0;

    const differential = baseRate - quoteRate;

    return {
      baseRate,
      quoteRate,
      differential,
      favorBase: differential > 0.5,
      favorQuote: differential < -0.5,
      signal: differential > 0.5 ? 'BUY' : differential < -0.5 ? 'SELL' : 'NEUTRAL',
      impact: Math.abs(differential) > 1.0 ? 'HIGH' : Math.abs(differential) > 0.25 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Analisa diferencial de inflação
   */
  analyzeInflationDifferential(base, quote) {
    const baseRegion = this.getRegion(base);
    const quoteRegion = this.getRegion(quote);

    const baseCPI = this.macroIndicators[baseRegion]?.cpi || 0;
    const quoteCPI = this.macroIndicators[quoteRegion]?.cpi || 0;

    const differential = baseCPI - quoteCPI;

    return {
      baseCPI,
      quoteCPI,
      differential,
      signal: differential > 0.5 ? 'BUY' : differential < -0.5 ? 'SELL' : 'NEUTRAL',
      description: differential > 0.5
        ? `${base} com inflação mais alta - provável alta de juros`
        : differential < -0.5
        ? `${quote} com inflação mais alta - provável alta de juros`
        : 'Inflação equilibrada'
    };
  }

  /**
   * Analisa diferencial de crescimento econômico
   */
  analyzeGrowthDifferential(base, quote) {
    const baseRegion = this.getRegion(base);
    const quoteRegion = this.getRegion(quote);

    const baseGDP = this.macroIndicators[baseRegion]?.gdp || 0;
    const quoteGDP = this.macroIndicators[quoteRegion]?.gdp || 0;
    const basePMI = this.macroIndicators[baseRegion]?.pmi || 50;
    const quotePMI = this.macroIndicators[quoteRegion]?.pmi || 50;

    const gdpDiff = baseGDP - quoteGDP;
    const pmiDiff = basePMI - quotePMI;

    return {
      baseGDP,
      quoteGDP,
      basePMI,
      quotePMI,
      gdpDifferential: gdpDiff,
      pmiDifferential: pmiDiff,
      signal: (gdpDiff > 0.5 && pmiDiff > 2) ? 'BUY' : (gdpDiff < -0.5 && pmiDiff < -2) ? 'SELL' : 'NEUTRAL',
      strength: Math.abs(gdpDiff) + Math.abs(pmiDiff) / 10
    };
  }

  /**
   * Retorna eventos econômicos próximos
   */
  getUpcomingEvents(pair) {
    // Simulação - em produção, integraria com API de calendário econômico
    const [base, quote] = this.parsePair(pair);

    const events = [
      {
        date: '2026-01-22',
        time: '14:00',
        currency: 'USD',
        event: 'FED Interest Rate Decision',
        impact: 'HIGH',
        forecast: '5.50%',
        previous: '5.50%',
        hoursUntil: 72
      },
      {
        date: '2026-01-24',
        time: '13:30',
        currency: 'USD',
        event: 'Initial Jobless Claims',
        impact: 'MEDIUM',
        forecast: '210K',
        previous: '205K',
        hoursUntil: 120
      },
      {
        date: '2026-01-25',
        time: '08:00',
        currency: 'EUR',
        event: 'ECB Interest Rate Decision',
        impact: 'HIGH',
        forecast: '4.50%',
        previous: '4.50%',
        hoursUntil: 144
      }
    ];

    // Filtra eventos relevantes para o par
    return events.filter(e => e.currency === base || e.currency === quote);
  }

  /**
   * Analisa sentimento de risco no mercado (Risk-on / Risk-off)
   */
  analyzeRiskSentiment(pair) {
    // Risk-on: investors buscam risco (compram ações, moedas commodity)
    // Risk-off: investors fogem de risco (compram USD, JPY, CHF)

    const [base, quote] = this.parsePair(pair);

    const safehavens = ['USD', 'JPY', 'CHF'];
    const riskyCurrencies = ['AUD', 'NZD', 'GBP', 'EUR'];

    const baseIsSafe = safehavens.includes(base);
    const quoteIsSafe = safehavens.includes(quote);
    const baseIsRisky = riskyCurrencies.includes(base);
    const quoteIsRisky = riskyCurrencies.includes(quote);

    const currentSentiment = this.marketSentiment;

    let signal = 'NEUTRAL';
    let description = '';

    if (currentSentiment === 'RISK_ON') {
      if (baseIsRisky && quoteIsSafe) {
        signal = 'BUY';
        description = 'Risk-on favorece moedas de risco (comprar base)';
      } else if (baseIsSafe && quoteIsRisky) {
        signal = 'SELL';
        description = 'Risk-on favorece moedas de risco (vender base safe-haven)';
      }
    } else if (currentSentiment === 'RISK_OFF') {
      if (baseIsSafe && quoteIsRisky) {
        signal = 'BUY';
        description = 'Risk-off favorece safe-havens (comprar base)';
      } else if (baseIsRisky && quoteIsSafe) {
        signal = 'SELL';
        description = 'Risk-off favorece safe-havens (vender moeda de risco)';
      }
    }

    return {
      currentSentiment,
      signal,
      description,
      strength: currentSentiment === 'NEUTRAL' ? 30 : 75
    };
  }

  /**
   * Analisa correlação com commodities
   */
  analyzeCommodityCorrelation(pair) {
    const [base, quote] = this.parsePair(pair);

    const correlations = {
      'AUD': { commodity: 'GOLD', correlation: 0.75, direction: 'POSITIVE' },
      'NZD': { commodity: 'DAIRY', correlation: 0.65, direction: 'POSITIVE' },
      'CAD': { commodity: 'OIL', correlation: 0.80, direction: 'POSITIVE' },
      'USD': { commodity: 'DXY', correlation: -0.70, direction: 'NEGATIVE' }
    };

    const baseCorr = correlations[base];
    const quoteCorr = correlations[quote];

    return {
      base: baseCorr || null,
      quote: quoteCorr || null,
      impact: baseCorr || quoteCorr ? 'MODERATE' : 'LOW'
    };
  }

  /**
   * Determina viés fundamentalista final
   */
  determineFundamentalBias(baseAnalysis, quoteAnalysis, interestDiff, inflationDiff, growthDiff, riskSentiment) {
    let score = 0;
    const factors = [];

    // Score da moeda base vs quote (peso 35%)
    const currencyDiff = baseAnalysis.score - quoteAnalysis.score;
    score += currencyDiff * 0.35;

    if (currencyDiff > 15) {
      factors.push(`${baseAnalysis.currency} fundamentalmente mais forte`);
    } else if (currencyDiff < -15) {
      factors.push(`${quoteAnalysis.currency} fundamentalmente mais forte`);
    }

    // Diferencial de juros (peso 30%)
    if (interestDiff.differential > 0.5) {
      score += 15;
      factors.push(`Taxa de juros favorece ${baseAnalysis.currency}`);
    } else if (interestDiff.differential < -0.5) {
      score -= 15;
      factors.push(`Taxa de juros favorece ${quoteAnalysis.currency}`);
    }

    // Inflação (peso 15%)
    if (inflationDiff.differential > 0.5) {
      score += 7.5;
      factors.push(`Inflação em ${baseAnalysis.currency} sugere juros mais altos`);
    } else if (inflationDiff.differential < -0.5) {
      score -= 7.5;
      factors.push(`Inflação em ${quoteAnalysis.currency} sugere juros mais altos`);
    }

    // Crescimento (peso 10%)
    if (growthDiff.gdpDifferential > 0.5) {
      score += 5;
      factors.push(`Crescimento mais forte em ${baseAnalysis.currency}`);
    } else if (growthDiff.gdpDifferential < -0.5) {
      score -= 5;
      factors.push(`Crescimento mais forte em ${quoteAnalysis.currency}`);
    }

    // Risk sentiment (peso 10%)
    if (riskSentiment.signal === 'BUY') {
      score += 5;
      factors.push(riskSentiment.description);
    } else if (riskSentiment.signal === 'SELL') {
      score -= 5;
      factors.push(riskSentiment.description);
    }

    // Normaliza score para -100 a +100
    score = Math.max(-100, Math.min(100, score));

    // Classifica viés
    let classification = 'NEUTRO';
    let direction = null;
    let confidence = Math.abs(score);

    if (score >= 40) {
      classification = 'FORTEMENTE_ALTISTA';
      direction = 'BUY';
    } else if (score >= 20) {
      classification = 'ALTISTA';
      direction = 'BUY';
    } else if (score <= -40) {
      classification = 'FORTEMENTE_BAIXISTA';
      direction = 'SELL';
    } else if (score <= -20) {
      classification = 'BAIXISTA';
      direction = 'SELL';
    } else {
      classification = 'NEUTRO';
      direction = 'NEUTRAL';
    }

    return {
      score,
      classification,
      direction,
      confidence,
      factors,
      summary: this.generateSummary(baseAnalysis, quoteAnalysis, classification, factors)
    };
  }

  /**
   * Gera resumo textual da análise
   */
  generateSummary(baseAnalysis, quoteAnalysis, classification, factors) {
    const base = baseAnalysis.currency;
    const quote = quoteAnalysis.currency;

    let summary = `Análise Fundamentalista ${base}/${quote}: ${classification}\n\n`;

    summary += `${base}: ${baseAnalysis.classification} (Score: ${baseAnalysis.score})\n`;
    summary += `- Taxa: ${baseAnalysis.centralBank.rate}% (${baseAnalysis.centralBank.bias})\n`;
    summary += `- Inflação: ${baseAnalysis.inflation.cpi}% (${baseAnalysis.inflation.trend})\n`;
    summary += `- Crescimento: ${baseAnalysis.growth.gdp}% GDP, ${baseAnalysis.growth.pmi} PMI\n\n`;

    summary += `${quote}: ${quoteAnalysis.classification} (Score: ${quoteAnalysis.score})\n`;
    summary += `- Taxa: ${quoteAnalysis.centralBank.rate}% (${quoteAnalysis.centralBank.bias})\n`;
    summary += `- Inflação: ${quoteAnalysis.inflation.cpi}% (${quoteAnalysis.inflation.trend})\n`;
    summary += `- Crescimento: ${quoteAnalysis.growth.gdp}% GDP, ${quoteAnalysis.growth.pmi} PMI\n\n`;

    summary += `Fatores-chave:\n`;
    factors.forEach(f => summary += `- ${f}\n`);

    return summary;
  }

  /**
   * Retorna recomendação de trading baseada no fundamental
   */
  getTradeRecommendation(bias) {
    if (bias.confidence < 60) {
      return {
        action: 'WAIT',
        reason: 'Viés fundamentalista não suficientemente forte',
        minConfidence: 60,
        currentConfidence: bias.confidence
      };
    }

    return {
      action: bias.direction === 'BUY' ? 'ALLOW_BUY' : bias.direction === 'SELL' ? 'ALLOW_SELL' : 'WAIT',
      reason: `Viés fundamentalista ${bias.classification}`,
      confidence: bias.confidence
    };
  }

  /**
   * Identifica fatores que bloqueiam operações
   */
  getBlockingFactors(bias, upcomingEvents) {
    const blockingFactors = [];

    // Bloqueia se há evento de alto impacto nas próximas 24h
    const highImpactSoon = upcomingEvents.filter(e => e.impact === 'HIGH' && e.hoursUntil < 24);

    if (highImpactSoon.length > 0) {
      blockingFactors.push({
        type: 'HIGH_IMPACT_EVENT',
        severity: 'HIGH',
        event: highImpactSoon[0].event,
        time: `${highImpactSoon[0].date} ${highImpactSoon[0].time}`,
        recommendation: 'NÃO OPERAR até após o evento'
      });
    }

    // Bloqueia se viés é conflitante (muito neutro)
    if (bias.confidence < 30) {
      blockingFactors.push({
        type: 'WEAK_BIAS',
        severity: 'MEDIUM',
        confidence: bias.confidence,
        recommendation: 'Aguardar definição fundamentalista mais clara'
      });
    }

    return blockingFactors;
  }

  /**
   * Atualiza dados de banco central (usado quando há nova decisão)
   */
  updateCentralBankData(bank, rate, bias) {
    if (this.centralBankData[bank]) {
      this.centralBankData[bank].rate = rate;
      this.centralBankData[bank].bias = bias;
      this.centralBankData[bank].lastUpdate = new Date();
    }
  }

  /**
   * Atualiza indicador macroeconômico
   */
  updateMacroIndicator(region, indicator, value) {
    if (this.macroIndicators[region]) {
      this.macroIndicators[region][indicator] = value;
    }
  }

  /**
   * Atualiza sentimento de risco do mercado
   */
  updateMarketSentiment(sentiment) {
    this.marketSentiment = sentiment;
  }
}

module.exports = FundamentalEngine;
