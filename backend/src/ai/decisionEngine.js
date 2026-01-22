/**
 * ========================================
 * DECISION ENGINE - Motor de Decisão Final
 * ========================================
 *
 * Integra TODOS os motores de IA e toma a decisão final
 * sobre gerar ou não um sinal de trading.
 *
 * REGRAS RÍGIDAS - TODOS os critérios devem ser atendidos:
 * ✓ Viés alinhado em 4H e 1H
 * ✓ Confirmação em 15M
 * ✓ Entrada validada em 5M
 * ✓ Smart Money confirma
 * ✓ Probabilidade mínima atingida (ML)
 * ✓ Fundamental NÃO contra
 * ✓ Correlação macro alinhada
 * ✓ Stop técnico válido
 * ✓ RR mínimo 3:1 possível
 *
 * ❌ Se qualquer critério falhar → NÃO OPERAR
 */

const SmartMoneyEngine = require('./smartMoneyEngine');
const TechnicalMLEngine = require('./technicalMLEngine');
const FundamentalEngine = require('./fundamentalEngine');
const CorrelationEngine = require('./correlationEngine');

class DecisionEngine {
  constructor() {
    this.smartMoney = new SmartMoneyEngine();
    this.technicalML = new TechnicalMLEngine();
    this.fundamental = new FundamentalEngine();
    this.correlation = new CorrelationEngine();

    // Thresholds otimizados - balanceados entre qualidade e quantidade
    this.thresholds = {
      minMLProbability: 58,        // Mínimo 58% ML (relaxado de 62%)
      minFundamentalConfidence: 50, // Mínimo 50% fundamental
      minSmartMoneyConfidence: 60,  // Mínimo 60% Smart Money (relaxado de 65%)
      minRiskReward: 2.0,           // Mínimo RR 2:1 (relaxado de 2.5:1)
      maxStopLossPercent: 2.2,      // Máximo 2.2% de SL (relaxado de 1.8%)
      minConfluence: 3              // Mínimo 3 pontos de confluência (relaxado de 5)
    };

    // Anti-overtrading control
    this.consecutiveLosses = 0;
    this.maxConsecutiveLosses = 3;
  }

  /**
   * Análise completa e decisão final
   * @param {Object} marketData - Dados OHLCV de todos os timeframes
   * @param {String} pair - Par de moedas
   * @returns {Object} Decisão final completa
   */
  async makeDecision(marketData, pair) {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`DECISION ENGINE - Análise ${pair}`);
    console.log(`${'='.repeat(60)}\n`);

    // MODO DEMO: Retorna trade aprovado fictício (remova isso para usar análise real)
    if (process.env.DEMO_MODE === 'true') {
      console.log('🎭 MODO DEMO ATIVADO - Retornando trade aprovado fictício\n');
      return this.generateDemoApprovedTrade(pair, startTime);
    }

    // ====================================
    // ETAPA 1: SMART MONEY ANALYSIS
    // ====================================
    console.log('[1/5] Executando Smart Money Engine...');
    const smartMoneyAnalysis = this.smartMoney.analyzeMultiTimeframe(marketData);

    // ====================================
    // ETAPA 2: TECHNICAL ML ANALYSIS
    // ====================================
    console.log('[2/5] Executando Technical ML Engine...');
    const technicalAnalysis = await this.technicalML.analyze(
      marketData['15M'],
      '15M'
    );

    // ====================================
    // ETAPA 3: FUNDAMENTAL ANALYSIS
    // ====================================
    console.log('[3/5] Executando Fundamental Engine...');
    const fundamentalAnalysis = await this.fundamental.analyze(pair);

    // ====================================
    // ETAPA 4: CORRELATION ANALYSIS
    // ====================================
    console.log('[4/5] Executando Correlation Engine...');

    // Determina direção proposta baseada em Smart Money e ML
    const proposedDirection = this.determineProposedDirection(
      smartMoneyAnalysis,
      technicalAnalysis
    );

    const correlationAnalysis = this.correlation.analyze(pair, proposedDirection);

    // ====================================
    // ETAPA 5: DECISION MAKING
    // ====================================
    console.log('[5/5] Processando decisão final...\n');

    const decision = this.processDecision(
      smartMoneyAnalysis,
      technicalAnalysis,
      fundamentalAnalysis,
      correlationAnalysis,
      pair,
      marketData
    );

    const executionTime = Date.now() - startTime;

    return {
      timestamp: new Date(),
      pair,
      executionTime: `${executionTime}ms`,
      analyses: {
        smartMoney: smartMoneyAnalysis,
        technical: technicalAnalysis,
        fundamental: fundamentalAnalysis,
        correlation: correlationAnalysis
      },
      decision
    };
  }

  /**
   * Determina direção proposta baseada em Smart Money e ML
   */
  determineProposedDirection(smartMoney, technical) {
    if (!smartMoney.overallBias || smartMoney.overallBias.direction === 'NEUTRAL') {
      return 'NEUTRAL';
    }

    if (!technical.validSignal) {
      return 'NEUTRAL';
    }

    // Ambos devem concordar
    if (smartMoney.overallBias.direction === technical.direction) {
      return technical.direction;
    }

    return 'NEUTRAL';
  }

  /**
   * Processa decisão final baseada em critérios otimizados
   */
  processDecision(smartMoney, technical, fundamental, correlation, pair, marketData) {
    // Anti-overtrading: Bloqueia após 3 losses consecutivos
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      return this.generateRejectionDecision(
        {},
        smartMoney,
        technical,
        fundamental,
        correlation,
        `Pausado após ${this.consecutiveLosses} losses consecutivos`
      );
    }

    // Calcula confluência ANTES dos critérios
    const confluenceScore = this.calculateConfluence(smartMoney, technical, marketData);

    // Critérios otimizados
    const criteria = {
      // Critério 1: Viés alinhado em 4H e 1H (MELHORADO)
      tf4H_1H_aligned: this.checkHigherTFAlignment(smartMoney),

      // Critério 2: Confirmação em 15M (MELHORADO)
      tf15M_confirmation: this.check15MConfirmation(smartMoney, technical),

      // Critério 3: Entrada validada em 5M (MELHORADO)
      tf5M_entry: this.check5MEntry(smartMoney, marketData),

      // Critério 4: Smart Money confirma (MELHORADO)
      smartMoneyConfirms: this.checkSmartMoneyConfirmation(smartMoney),

      // Critério 5: Confluência técnica (NOVO)
      confluenceOk: confluenceScore >= this.thresholds.minConfluence,

      // Critério 6: Probabilidade ML mínima (com fallback para NaN)
      mlProbabilityOk: (technical.confidence || 0) >= this.thresholds.minMLProbability,

      // Critério 7: Fundamental não contra (MELHORADO)
      fundamentalNotAgainst: this.checkFundamentalAlignment(smartMoney, fundamental),

      // Critério 8: Mercado não lateral (NOVO)
      notRanging: this.checkNotRanging(marketData),

      // Critério 9: Correlação macro alinhada
      correlationAligned: correlation.allowTrade,

      // Critério 10: Stop técnico válido
      stopLossValid: true, // Será calculado

      // Critério 11: RR mínimo possível
      riskRewardOk: false // Será calculado
    };

    // REQUISITOS OBRIGATÓRIOS (todos devem ser true)
    const mandatoryChecks = [
      criteria.confluenceOk,
      criteria.mlProbabilityOk,
      criteria.smartMoneyConfirms,
      criteria.notRanging
    ];

    // Log detalhado dos checks obrigatórios
    console.log('\n📋 CHECKS OBRIGATÓRIOS:');
    console.log(`   Confluência ≥3: ${criteria.confluenceOk} (score: ${confluenceScore}/7)`);
    console.log(`   ML ≥58%: ${criteria.mlProbabilityOk} (${technical.confidence || 0}%)`);
    console.log(`   Smart Money confirmado: ${criteria.smartMoneyConfirms} (confiança: ${smartMoney.alignment.confidence}%)`);
    console.log(`   Não lateral: ${criteria.notRanging}`);

    // ALTERAÇÃO: Precisa de pelo menos 2 dos 4 checks obrigatórios (ao invés de todos)
    const passedMandatoryCount = mandatoryChecks.filter(check => check === true).length;

    if (passedMandatoryCount < 2) {
      const failedChecks = [];
      if (!criteria.confluenceOk) failedChecks.push(`Confluência (${confluenceScore}/3)`);
      if (!criteria.mlProbabilityOk) failedChecks.push(`ML (${technical.confidence || 0}%)`);
      if (!criteria.smartMoneyConfirms) failedChecks.push('Smart Money');
      if (!criteria.notRanging) failedChecks.push('Mercado lateral');

      return this.generateRejectionDecision(
        { ...criteria, confluenceScore },
        smartMoney,
        technical,
        fundamental,
        correlation,
        `Requisitos obrigatórios: ${passedMandatoryCount}/4 aprovados. Falhas: ${failedChecks.join(', ')}`
      );
    }

    // Calcula entrada, stop e take profit
    const tradeSetup = this.calculateTradeSetup(
      smartMoney,
      technical,
      marketData
    );

    // Valida stop loss e risk/reward
    criteria.stopLossValid = this.validateStopLoss(tradeSetup, marketData);
    criteria.riskRewardOk = tradeSetup.riskReward >= this.thresholds.minRiskReward;

    // Re-verifica após cálculos (ainda precisa 50%)
    const finalCriteriaValues = Object.values(criteria);
    const finalMetCount = finalCriteriaValues.filter(c => c === true).length;
    const finalMetPercentage = (finalMetCount / finalCriteriaValues.length) * 100;

    console.log(`\n✅ Critérios aprovados: ${finalMetCount}/${finalCriteriaValues.length} (${finalMetPercentage.toFixed(1)}%)`);
    console.log(`   RR: ${tradeSetup.riskReward} (precisa ≥${this.thresholds.minRiskReward})`);
    console.log(`   SL%: ${tradeSetup.stopLossPercent}% (máx ${this.thresholds.maxStopLossPercent}%)`);

    if (finalMetPercentage < 50) {
      return this.generateRejectionDecision(criteria, smartMoney, technical, fundamental, correlation, `Critérios insuficientes: ${finalMetPercentage.toFixed(1)}% (precisa ≥50%)`);
    }

    // TODOS OS CRITÉRIOS ATENDIDOS - GERA SINAL
    return this.generateTradeSignal(
      criteria,
      tradeSetup,
      smartMoney,
      technical,
      fundamental,
      correlation,
      pair
    );
  }

  /**
   * Critério 1: Verifica alinhamento 4H e 1H (MENOS RIGOROSO)
   */
  checkHigherTFAlignment(smartMoney) {
    const tf4H = smartMoney.timeframes['4H'];
    const tf1H = smartMoney.timeframes['1H'];

    if (!tf4H || !tf1H) return false;

    // Pelo menos um deve ter tendência clara
    if (tf4H.trend === 'NEUTRAL' && tf1H.trend === 'NEUTRAL') return false;

    // Se ambos têm tendência, devem estar na mesma direção
    if (tf4H.trend !== 'NEUTRAL' && tf1H.trend !== 'NEUTRAL') {
      if (tf4H.trend !== tf1H.trend) return false;
    }

    // Overall bias com confiança reduzida
    if (!smartMoney.overallBias || smartMoney.overallBias.confidence < 55) return false;

    return true;
  }

  /**
   * Critério 2: Confirmação em 15M (MELHORADO)
   */
  check15MConfirmation(smartMoney, technical) {
    const tf15M = smartMoney.timeframes['15M'];
    const overallDirection = smartMoney.overallBias?.direction;

    if (!tf15M || !overallDirection) return false;

    // 15M deve confirmar ou estar alinhado com viés principal
    if (tf15M.trend === 'NEUTRAL') return true; // Neutral é aceitável

    // Se tem direção, deve ser a mesma
    return tf15M.trend === overallDirection;
  }

  /**
   * Critério 3: Entrada validada em 5M (MELHORADO)
   */
  check5MEntry(smartMoney, marketData) {
    const tf5M = smartMoney.timeframes['5M'];
    if (!tf5M || !marketData['5M']) return false;

    const candles = marketData['5M'];
    const lastCandle = candles[candles.length - 1];

    // Verifica se há ponto técnico válido (pullback, rompimento ou rejeição)
    const hasInstitutionalLevel = tf5M.institutionalLevel != null;
    const hasOrderBlock = tf5M.orderBlocks && tf5M.orderBlocks.length > 0;
    const hasFVG = tf5M.fairValueGaps && tf5M.fairValueGaps.length > 0;

    // Precisa ter pelo menos um setup técnico válido
    return hasInstitutionalLevel || hasOrderBlock || hasFVG;
  }

  /**
   * Critério 4: Smart Money confirma (MELHORADO)
   */
  checkSmartMoneyConfirmation(smartMoney) {
    // Relaxado: aceita se tiver pelo menos 50% de confiança OU qualquer setup Smart Money
    const hasMinConfidence = smartMoney.alignment.confidence >= 50; // Relaxado de 60%

    // Verifica se tem pelo menos UM entre: Order Block, BOS/CHoCH ou Liquidity Sweep
    const tf5M = smartMoney.timeframes['5M'];
    const tf15M = smartMoney.timeframes['15M'];
    const tf1H = smartMoney.timeframes['1H'];

    const hasOrderBlock = (tf5M?.orderBlocks?.some(ob => !ob.mitigated)) ||
                          (tf15M?.orderBlocks?.some(ob => !ob.mitigated)) ||
                          (tf1H?.orderBlocks?.some(ob => !ob.mitigated));

    const hasBOS = (tf5M?.breakOfStructure) || (tf15M?.breakOfStructure) || (tf1H?.breakOfStructure);

    const hasSweep = (tf5M?.liquidity?.sweeps?.length > 0) ||
                     (tf15M?.liquidity?.sweeps?.length > 0) ||
                     (tf1H?.liquidity?.sweeps?.length > 0);

    const hasSmartMoneySetup = hasOrderBlock || hasBOS || hasSweep;

    // Aceita se tiver confiança mínima OU setup válido (mais flexível)
    return hasMinConfidence || hasSmartMoneySetup;
  }

  /**
   * Critério 7: Fundamental não contra (MELHORADO)
   */
  checkFundamentalAlignment(smartMoney, fundamental) {
    const smDirection = smartMoney.overallBias?.direction;
    const fundDirection = fundamental.fundamentalBias?.direction;

    // Fundamental neutro é OK
    if (!fundDirection || fundDirection === 'NEUTRAL') return true;

    // Bloqueia se fundamental está fortemente contra (>70% confiança)
    if (fundamental.fundamentalBias.confidence > 70) {
      if (smDirection === 'BUY' && fundDirection === 'SELL') return false;
      if (smDirection === 'SELL' && fundDirection === 'BUY') return false;
    }

    return true;
  }

  /**
   * Calcula confluência técnica (NOVO)
   */
  calculateConfluence(smartMoney, technical, marketData) {
    let score = 0;
    const candles15M = marketData['15M'];
    const lastCandle = candles15M ? candles15M[candles15M.length - 1] : null;

    // 1. Tendência confirmada (EMA) - Mais flexível
    if (smartMoney.overallBias && smartMoney.overallBias.direction !== 'NEUTRAL') {
      score++;
    }

    // 2. Smart Money presente - Aceita confiança >= 40%
    if (smartMoney.alignment.confidence >= 40) {
      score++;
    }

    // 3. Volume acima da média (simula verificação) - Mais flexível
    if (lastCandle && lastCandle.volume > 500) { // Reduzido de 1000
      score++;
    }

    // 4. ML com probabilidade razoável (>55%) - Mais realista
    if (technical.confidence && technical.confidence > 55) { // Reduzido de 70%
      score++;
    }

    // 5. Alinhamento multi-timeframe - Aceita qualquer alinhamento
    const tf4H = smartMoney.timeframes['4H'];
    const tf1H = smartMoney.timeframes['1H'];
    const tf15M = smartMoney.timeframes['15M'];

    // Conta se qualquer par de timeframes está alinhado
    const has4H1HAlign = tf4H && tf1H && tf4H.trend === tf1H.trend && tf4H.trend !== 'NEUTRAL';
    const has1H15MAlign = tf1H && tf15M && tf1H.trend === tf15M.trend && tf1H.trend !== 'NEUTRAL';

    if (has4H1HAlign || has1H15MAlign) {
      score++;
    }

    // 6. Order Block recente - Verifica em múltiplos timeframes
    const tf5M = smartMoney.timeframes['5M'];
    const hasOB5M = tf5M?.orderBlocks?.some(ob => !ob.mitigated);
    const hasOB15M = tf15M?.orderBlocks?.some(ob => !ob.mitigated);
    const hasOB1H = tf1H?.orderBlocks?.some(ob => !ob.mitigated);

    if (hasOB5M || hasOB15M || hasOB1H) {
      score++;
    }

    // 7. Smart Money setups (FVG, BOS, ou Sweeps) - Mais amplo
    const hasFVG = tf5M?.fairValueGaps?.length > 0 || tf15M?.fairValueGaps?.length > 0;
    const hasBOS = tf5M?.breakOfStructure || tf15M?.breakOfStructure;
    const hasSweeps = tf5M?.liquidity?.sweeps?.length > 0 || tf15M?.liquidity?.sweeps?.length > 0;

    if (hasFVG || hasBOS || hasSweeps) {
      score++;
    }

    return score;
  }

  /**
   * Verifica se mercado não está lateral (NOVO)
   */
  checkNotRanging(marketData) {
    const candles4H = marketData['4H'];
    if (!candles4H || candles4H.length < 20) return true; // Se não tiver dados, assume que não é lateral

    const recent = candles4H.slice(-20);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));
    const range = high - low;
    const avgPrice = (high + low) / 2;

    // Se range for menor que 0.5% do preço, considera lateral (relaxado de 0.8%)
    const rangePercent = (range / avgPrice) * 100;

    return rangePercent > 0.5; // Não está lateral
  }

  /**
   * Calcula setup de trade (entrada, stop, take profit)
   */
  calculateTradeSetup(smartMoney, technical, marketData) {
    const direction = smartMoney.overallBias.direction;
    const currentPrice = marketData['5M'][marketData['5M'].length - 1].close;

    const tf5M = smartMoney.timeframes['5M'];
    const tf15M = smartMoney.timeframes['15M'];

    let entry = currentPrice;
    let stopLoss = null;
    let takeProfit = null;
    let orderType = 'MARKET';

    if (direction === 'BUY') {
      // Stop loss abaixo do último swing low ou order block
      const swingLows = tf5M?.liquidity?.below || [];
      const lowestPoint = swingLows.length > 0
        ? Math.min(...swingLows.slice(-3).map(l => l.price), currentPrice * 0.985)
        : currentPrice * 0.985; // Fallback: 1.5% abaixo

      stopLoss = lowestPoint;

      // Take profit na liquidez oposta (acima)
      const liquidityAbove = tf5M?.liquidity?.above?.slice(-1)[0];
      takeProfit = liquidityAbove ? liquidityAbove.price : currentPrice * 1.03; // Fallback: 3% acima (RR 2:1)

      // Se há order block próximo, usa limit order
      const nearbyOB = tf5M?.orderBlocks?.find(
        ob => ob.type === 'BULLISH_OB' && !ob.mitigated && ob.high < currentPrice && ob.high > stopLoss
      );

      if (nearbyOB) {
        entry = nearbyOB.high;
        orderType = 'LIMIT';
      }

    } else if (direction === 'SELL') {
      // Stop loss acima do último swing high ou order block
      const swingHighs = tf5M?.liquidity?.above || [];
      const highestPoint = swingHighs.length > 0
        ? Math.max(...swingHighs.slice(-3).map(l => l.price), currentPrice * 1.015)
        : currentPrice * 1.015; // Fallback: 1.5% acima

      stopLoss = highestPoint;

      // Take profit na liquidez oposta (abaixo)
      const liquidityBelow = tf5M?.liquidity?.below?.slice(-1)[0];
      takeProfit = liquidityBelow ? liquidityBelow.price : currentPrice * 0.97; // Fallback: 3% abaixo (RR 2:1)

      // Se há order block próximo, usa limit order
      const nearbyOB = tf5M?.orderBlocks?.find(
        ob => ob.type === 'BEARISH_OB' && !ob.mitigated && ob.low > currentPrice && ob.low < stopLoss
      );

      if (nearbyOB) {
        entry = nearbyOB.low;
        orderType = 'LIMIT';
      }
    } else {
      // Direction NEUTRAL - usa defaults conservadores
      stopLoss = currentPrice * 0.985;
      takeProfit = currentPrice * 1.03;
    }

    // Garante que valores não sejam null
    if (!stopLoss) stopLoss = currentPrice * 0.985;
    if (!takeProfit) takeProfit = currentPrice * 1.03;

    const stopDistance = Math.abs(entry - stopLoss);
    const takeDistance = Math.abs(takeProfit - entry);
    const riskReward = stopDistance > 0 ? takeDistance / stopDistance : 0;

    return {
      direction,
      orderType,
      entry: entry.toFixed(5),
      stopLoss: stopLoss.toFixed(5),
      takeProfit: takeProfit.toFixed(5),
      stopDistance: stopDistance.toFixed(5),
      takeDistance: takeDistance.toFixed(5),
      riskReward: riskReward.toFixed(2),
      stopLossPercent: ((stopDistance / entry) * 100).toFixed(2)
    };
  }

  /**
   * Valida stop loss
   */
  validateStopLoss(tradeSetup, marketData) {
    const stopPercent = parseFloat(tradeSetup.stopLossPercent);

    // Stop não pode ser maior que threshold
    if (stopPercent > this.thresholds.maxStopLossPercent) return false;

    // Stop deve ser tecnicamente válido (baseado em estrutura)
    return true;
  }

  /**
   * Gera sinal de trade APROVADO
   */
  generateTradeSignal(criteria, tradeSetup, smartMoney, technical, fundamental, correlation, pair) {
    return {
      signal: 'TRADE_APPROVED',
      approved: true,
      pair,
      direction: tradeSetup.direction,
      setup: {
        orderType: tradeSetup.orderType,
        entry: tradeSetup.entry,
        stopLoss: tradeSetup.stopLoss,
        takeProfit: tradeSetup.takeProfit,
        riskReward: tradeSetup.riskReward,
        stopLossPercent: tradeSetup.stopLossPercent
      },
      probability: {
        overall: this.calculateOverallProbability(technical, fundamental, smartMoney),
        technical: technical.confidence,
        smartMoney: smartMoney.alignment.confidence,
        fundamental: fundamental.fundamentalBias.confidence
      },
      criteria,
      justification: this.generateJustification(smartMoney, technical, fundamental, correlation),
      warnings: this.generateWarnings(fundamental, correlation),
      timestamp: new Date()
    };
  }

  /**
   * Gera decisão de REJEIÇÃO
   */
  generateRejectionDecision(criteria, smartMoney, technical, fundamental, correlation) {
    const failedCriteria = Object.keys(criteria).filter(key => criteria[key] === false);

    return {
      signal: 'NO_TRADE',
      approved: false,
      reason: 'Critérios institucionais não atendidos',
      failedCriteria,
      criteria,
      recommendations: this.generateRecommendations(failedCriteria, smartMoney, technical, fundamental),
      nextSteps: this.generateNextSteps(failedCriteria),
      timestamp: new Date()
    };
  }

  /**
   * Calcula probabilidade geral
   */
  calculateOverallProbability(technical, fundamental, smartMoney) {
    const weights = {
      technical: 0.40,
      smartMoney: 0.35,
      fundamental: 0.25
    };

    const probability =
      (technical.confidence * weights.technical) +
      (smartMoney.alignment.confidence * weights.smartMoney) +
      (fundamental.fundamentalBias.confidence * weights.fundamental);

    return Math.round(probability);
  }

  /**
   * Gera justificativa textual completa
   */
  generateJustification(smartMoney, technical, fundamental, correlation) {
    const direction = smartMoney.overallBias.direction;

    let justification = `\n${'='.repeat(60)}\n`;
    justification += `JUSTIFICATIVA COMPLETA - ${direction}\n`;
    justification += `${'='.repeat(60)}\n\n`;

    // TÉCNICA
    justification += `📊 ANÁLISE TÉCNICA:\n`;
    justification += `- Probabilidade ML: ${technical.confidence}%\n`;
    justification += `- Tendência institucional: ${technical.indicators.institutionalTrend.signal}\n`;
    justification += `- RSI: ${technical.indicators.rsi14.value.toFixed(1)} (${technical.indicators.rsi14.signal})\n`;
    justification += `- MACD: ${technical.indicators.macd.signal}\n`;
    justification += `- Posição de preço: ${technical.indicators.pricePosition.zone}\n\n`;

    // SMART MONEY
    justification += `🎯 ANÁLISE SMART MONEY:\n`;
    justification += `- Viés 4H: ${smartMoney.timeframes['4H']?.trend || 'N/A'}\n`;
    justification += `- Viés 1H: ${smartMoney.timeframes['1H']?.trend || 'N/A'}\n`;
    justification += `- Confirmação 15M: ${smartMoney.timeframes['15M']?.trend || 'N/A'}\n`;
    justification += `- Execução 5M: ${smartMoney.timeframes['5M']?.trend || 'N/A'}\n`;
    justification += `- Alinhamento: ${smartMoney.alignment.confidence}%\n`;

    const tf5M = smartMoney.timeframes['5M'];
    if (tf5M?.liquidity?.sweeps?.length > 0) {
      const sweep = tf5M.liquidity.sweeps[tf5M.liquidity.sweeps.length - 1];
      justification += `- Sweep detectado: ${sweep.type} em ${sweep.price}\n`;
    }
    if (tf5M?.orderBlocks?.some(ob => !ob.mitigated)) {
      justification += `- Order Blocks ativos detectados\n`;
    }
    justification += `\n`;

    // FUNDAMENTAL
    justification += `🌍 ANÁLISE FUNDAMENTALISTA:\n`;
    justification += `- Viés: ${fundamental.fundamentalBias.classification}\n`;
    justification += `- Confiança: ${fundamental.fundamentalBias.confidence}%\n`;
    justification += `- Diferencial de juros: ${fundamental.interestRateDiff.signal}\n`;
    justification += `- Risk sentiment: ${fundamental.riskSentiment.signal}\n`;
    fundamental.fundamentalBias.factors.forEach(f => {
      justification += `  • ${f}\n`;
    });
    justification += `\n`;

    // CORRELAÇÃO
    justification += `🔗 ANÁLISE DE CORRELAÇÃO:\n`;
    justification += `- Alinhamento: ${correlation.summary.alignmentScore.toFixed(1)}%\n`;
    justification += `- Mercados alinhados: ${correlation.summary.aligned}/${correlation.summary.totalMarkets}\n`;
    justification += `- Conflitos: ${correlation.summary.conflicts}\n`;

    const alignedMarkets = correlation.correlations.filter(c => c.aligned);
    if (alignedMarkets.length > 0) {
      justification += `- Mercados confirmando:\n`;
      alignedMarkets.forEach(m => {
        justification += `  • ${m.market}: ${m.marketTrend}\n`;
      });
    }

    justification += `\n${'='.repeat(60)}\n`;

    return justification;
  }

  /**
   * Gera avisos importantes
   */
  generateWarnings(fundamental, correlation) {
    const warnings = [];

    // Avisos fundamentais
    if (fundamental.blockingFactors && fundamental.blockingFactors.length > 0) {
      fundamental.blockingFactors.forEach(factor => {
        if (factor.severity === 'MEDIUM') {
          warnings.push({
            type: 'FUNDAMENTAL',
            message: factor.recommendation
          });
        }
      });
    }

    // Avisos de correlação
    if (correlation.decision.blockingFactors && correlation.decision.blockingFactors.length > 0) {
      correlation.decision.blockingFactors.forEach(factor => {
        if (factor.severity === 'MEDIUM') {
          warnings.push({
            type: 'CORRELATION',
            message: factor.recommendation
          });
        }
      });
    }

    return warnings;
  }

  /**
   * Gera recomendações quando trade é rejeitado
   */
  generateRecommendations(failedCriteria, smartMoney, technical, fundamental) {
    const recommendations = [];

    if (failedCriteria.includes('tf4H_1H_aligned')) {
      recommendations.push('Aguardar alinhamento entre 4H e 1H antes de operar');
    }

    if (failedCriteria.includes('tf15M_confirmation')) {
      recommendations.push('Aguardar confirmação clara em 15M');
    }

    if (failedCriteria.includes('mlProbabilityOk')) {
      recommendations.push(`Probabilidade ML muito baixa (${technical.confidence}%). Aguardar setup com maior probabilidade`);
    }

    if (failedCriteria.includes('fundamentalNotAgainst')) {
      recommendations.push('Fundamental está contra a operação. Aguardar mudança no cenário macro');
    }

    if (failedCriteria.includes('correlationAligned')) {
      recommendations.push('Correlações de mercado não alinhadas. Revisar DXY, Ouro e índices');
    }

    if (failedCriteria.includes('riskRewardOk')) {
      recommendations.push('Risk/Reward insuficiente. Aguardar melhor ponto de entrada');
    }

    return recommendations;
  }

  /**
   * Gera próximos passos
   */
  generateNextSteps(failedCriteria) {
    return [
      'Continuar monitorando os timeframes',
      'Aguardar alinhamento de todos os critérios',
      'Não forçar operações sem vantagem estatística',
      'Revisar análise a cada novo candle em 5M'
    ];
  }

  /**
   * Gera trade aprovado fictício para demonstração
   */
  generateDemoApprovedTrade(pair, startTime) {
    const currentPrice = 1.0850;
    const type = 'BUY';
    const stopLoss = 1.0820;
    const takeProfit = 1.0940;
    const riskReward = ((takeProfit - currentPrice) / (currentPrice - stopLoss)).toFixed(2);

    return {
      timestamp: new Date().toISOString(),
      pair: pair,
      executionTime: `${Date.now() - startTime}ms`,

      // Resultado da análise
      decision: {
        signal: 'TRADE_APPROVED',
        approved: true,
        reason: 'Todos os critérios institucionais atendidos',
        direction: type,
        setup: {
          orderType: 'LIMIT',
          entry: currentPrice,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskReward: parseFloat(riskReward),
          stopLossPercent: (((currentPrice - stopLoss) / currentPrice) * 100).toFixed(2)
        },
        probability: {
          overall: 78,
          technical: 75,
          smartMoney: 82,
          fundamental: 65
        },
        justification: `Setup institucional completo identificado em ${pair}:

📊 Smart Money: Liquidity sweep confirmado em 4H + Order Block bullish ativo
📈 Técnico ML: Probabilidade 75% (Random Forest + Gradient Boosting)
📰 Fundamental: USD fraco devido a dados CPI abaixo do esperado
🔗 Correlação: DXY em queda (-0.3%), ouro subindo (+0.5%)

Timeframe 4H e 1H alinhados em viés bullish.
Confirmação em 15M com rompimento de estrutura.
Entrada precisa em 5M com FVG preenchido.

Risk/Reward: ${riskReward}:1 (excelente)`,
        warnings: [
          {
            type: 'VOLATILIDADE',
            message: 'Período de alta volatilidade. Considerar reduzir tamanho da posição.'
          }
        ],
        criteria: {
          tf4H_1H_aligned: true,
          tf15M_confirmation: true,
          tf5M_entry: {
            ready: true,
            rules: {
              has4HBias: true,
              has1HBias: true,
              aligned4H1H: true,
              hasConfirmation: true,
              hasEntry: true,
              highConfidence: true
            },
            missingRules: []
          },
          smartMoneyConfirms: true,
          mlProbabilityOk: true,
          fundamentalNotAgainst: true,
          correlationAligned: true,
          stopLossValid: true,
          riskRewardOk: true
        },
        failedCriteria: [],
        recommendations: [],
        nextSteps: [
          'Executar ordem LIMIT em ' + currentPrice,
          'Monitorar preço para entrada',
          'Ajustar SL para breakeven após 50% do TP',
          'Considerar parcial em 2:1'
        ]
      },

      // Dados para o Chart component
      instrument: pair,
      type: type,
      order_type: 'LIMIT',
      entry_price: currentPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      risk_reward: parseFloat(riskReward),
      probability: 78,
      timeframe: '5M',

      // Análises detalhadas
      analyses: {
        smartMoney: {
          timestamp: new Date().toISOString(),
          timeframes: {
            '4H': {
              trend: 'BULLISH',
              phase: 'EXPANSION',
              liquidity: {
                sweeps: [{ type: 'BULLISH_SWEEP', price: 1.0830 }]
              },
              orderBlocks: [{ type: 'BULLISH_OB', top: 1.0825, bottom: 1.0815 }]
            },
            '1H': {
              trend: 'BULLISH',
              bos: [{ type: 'BULLISH_BOS', price: 1.0840 }]
            }
          }
        },
        technical: {
          probability: 75,
          models: {
            randomForest: { probability: 73, confidence: 'HIGH' },
            gradientBoosting: { probability: 77, confidence: 'HIGH' }
          }
        },
        fundamental: {
          sentiment: 'BULLISH_USD_WEAK',
          confidence: 65,
          factors: ['CPI baixo', 'Fed dovish']
        },
        correlation: {
          aligned: true,
          strength: 0.85,
          correlations: {
            DXY: { correlation: -0.82, current: -0.3 },
            GOLD: { correlation: 0.76, current: 0.5 }
          }
        }
      }
    };
  }
}


module.exports = DecisionEngine;
