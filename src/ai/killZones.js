/**
 * ========================================
 * KILL ZONES ENGINE
 * ========================================
 *
 * Detecção de sessões de trading institucionais:
 * - London Kill Zone (02:00-05:00 EST / 07:00-10:00 UTC)
 * - New York Kill Zone (07:00-10:00 EST / 12:00-15:00 UTC)
 * - Asian Session (19:00-02:00 EST / 00:00-07:00 UTC)
 * - London Close (10:00-12:00 EST / 15:00-17:00 UTC)
 */

class KillZonesEngine {
  constructor() {
    this.name = 'KillZonesEngine';

    // Definição das Kill Zones em UTC
    this.killZones = {
      asian: {
        name: 'Asian Session',
        start: 0,  // 00:00 UTC
        end: 7,    // 07:00 UTC
        importance: 'low',
        pairs: ['USDJPY', 'AUDJPY', 'EURJPY', 'GBPJPY', 'AUDUSD', 'NZDUSD'],
        characteristics: ['Lower volatility', 'Range-bound', 'Liquidity buildup'],
        color: '#9c27b0'
      },
      londonOpen: {
        name: 'London Kill Zone',
        start: 7,   // 07:00 UTC
        end: 10,    // 10:00 UTC
        importance: 'high',
        pairs: ['EURUSD', 'GBPUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD'],
        characteristics: ['High volatility', 'Major moves', 'Liquidity sweep', 'Stop hunts'],
        color: '#2196f3'
      },
      londonSession: {
        name: 'London Session',
        start: 8,   // 08:00 UTC
        end: 16,    // 16:00 UTC
        importance: 'medium',
        pairs: ['EURUSD', 'GBPUSD', 'EURGBP', 'USDCHF'],
        characteristics: ['Trend continuation', 'High volume'],
        color: '#03a9f4'
      },
      nyOpen: {
        name: 'New York Kill Zone',
        start: 12,  // 12:00 UTC (07:00 EST)
        end: 15,    // 15:00 UTC (10:00 EST)
        importance: 'high',
        pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'US30', 'XAUUSD', 'BTCUSD'],
        characteristics: ['Highest volatility', 'Reversals', 'Major news', 'Stop hunts'],
        color: '#ff9800'
      },
      londonClose: {
        name: 'London Close',
        start: 15,  // 15:00 UTC
        end: 17,    // 17:00 UTC
        importance: 'medium',
        pairs: ['EURUSD', 'GBPUSD', 'EURGBP'],
        characteristics: ['Profit taking', 'Reversals', 'Position squaring'],
        color: '#ff5722'
      },
      nySession: {
        name: 'New York Session',
        start: 13,  // 13:00 UTC
        end: 21,    // 21:00 UTC
        importance: 'medium',
        pairs: ['EURUSD', 'USDJPY', 'USDCAD', 'US30'],
        characteristics: ['Trend continuation', 'News driven'],
        color: '#ffc107'
      }
    };

    // Eventos de alto impacto por dia da semana
    this.weeklyEvents = {
      0: [], // Sunday
      1: ['Asian open', 'Week start positioning'],
      2: ['Normal trading'],
      3: ['FOMC potential', 'Mid-week volatility'],
      4: ['ECB potential', 'Pre-NFP positioning'],
      5: ['NFP first Friday', 'Week close positioning'],
      6: []  // Saturday
    };
  }

  /**
   * Retorna todas as Kill Zones com status atual
   */
  getAllKillZones() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    const zones = Object.entries(this.killZones).map(([key, zone]) => ({
      id: key,
      ...zone,
      isActive: this.isZoneActive(zone, utcHour),
      timeUntilStart: this.getTimeUntilStart(zone, utcHour),
      timeUntilEnd: this.getTimeUntilEnd(zone, utcHour)
    }));

    return {
      currentTime: now.toISOString(),
      utcHour,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      zones,
      activeZones: zones.filter(z => z.isActive),
      upcomingZones: zones.filter(z => !z.isActive && z.timeUntilStart <= 2),
      weeklyEvents: this.weeklyEvents[dayOfWeek],
      recommendation: this.getRecommendation(zones, utcHour, dayOfWeek)
    };
  }

  /**
   * Verifica se uma zona está ativa
   */
  isZoneActive(zone, currentHour) {
    if (zone.start < zone.end) {
      return currentHour >= zone.start && currentHour < zone.end;
    } else {
      // Para sessões que cruzam a meia-noite (ex: Asian)
      return currentHour >= zone.start || currentHour < zone.end;
    }
  }

  /**
   * Calcula tempo até o início da zona
   */
  getTimeUntilStart(zone, currentHour) {
    let diff = zone.start - currentHour;
    if (diff < 0) diff += 24;
    return diff;
  }

  /**
   * Calcula tempo até o fim da zona
   */
  getTimeUntilEnd(zone, currentHour) {
    if (!this.isZoneActive(zone, currentHour)) return null;

    let diff = zone.end - currentHour;
    if (diff < 0) diff += 24;
    return diff;
  }

  /**
   * Gera recomendação baseada nas kill zones
   */
  getRecommendation(zones, currentHour, dayOfWeek) {
    const activeZones = zones.filter(z => z.isActive);

    // Fim de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        action: 'NO_TRADE',
        reason: 'Mercado fechado - Fim de semana',
        confidence: 100
      };
    }

    // Kill Zone ativa de alta importância
    const highImportanceActive = activeZones.find(z => z.importance === 'high');
    if (highImportanceActive) {
      return {
        action: 'TRADE',
        reason: `${highImportanceActive.name} ativa - Melhor momento para entradas`,
        confidence: 90,
        recommendedPairs: highImportanceActive.pairs,
        characteristics: highImportanceActive.characteristics
      };
    }

    // Sessão de média importância
    const mediumImportanceActive = activeZones.find(z => z.importance === 'medium');
    if (mediumImportanceActive) {
      return {
        action: 'CAUTION',
        reason: `${mediumImportanceActive.name} ativa - Trading possível com cautela`,
        confidence: 60,
        recommendedPairs: mediumImportanceActive.pairs,
        characteristics: mediumImportanceActive.characteristics
      };
    }

    // Sessão asiática ou fora de kill zone
    const asianActive = activeZones.find(z => z.id === 'asian');
    if (asianActive) {
      return {
        action: 'WAIT',
        reason: 'Sessão Asiática - Baixa volatilidade, aguardar London/NY',
        confidence: 70,
        recommendedPairs: asianActive.pairs
      };
    }

    // Próxima kill zone
    const upcomingHighImportance = zones.find(z => z.importance === 'high' && z.timeUntilStart <= 2);
    if (upcomingHighImportance) {
      return {
        action: 'PREPARE',
        reason: `${upcomingHighImportance.name} em ${upcomingHighImportance.timeUntilStart}h - Preparar análise`,
        confidence: 80,
        recommendedPairs: upcomingHighImportance.pairs
      };
    }

    return {
      action: 'WAIT',
      reason: 'Fora das principais Kill Zones - Aguardar melhor momento',
      confidence: 50
    };
  }

  /**
   * Verifica se é um bom momento para operar um par específico
   */
  isGoodTimeForPair(pair) {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    // Fim de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isGood: false,
        reason: 'Mercado fechado'
      };
    }

    // Encontrar zonas que recomendam esse par
    const relevantZones = Object.entries(this.killZones)
      .filter(([_, zone]) => zone.pairs.includes(pair))
      .map(([key, zone]) => ({
        id: key,
        ...zone,
        isActive: this.isZoneActive(zone, utcHour)
      }));

    // Verificar se alguma zona relevante está ativa
    const activeRelevantZone = relevantZones.find(z => z.isActive && z.importance === 'high');
    if (activeRelevantZone) {
      return {
        isGood: true,
        reason: `${activeRelevantZone.name} ativa - Melhor momento para ${pair}`,
        zone: activeRelevantZone.name,
        confidence: 90
      };
    }

    const mediumActiveZone = relevantZones.find(z => z.isActive && z.importance === 'medium');
    if (mediumActiveZone) {
      return {
        isGood: true,
        reason: `${mediumActiveZone.name} ativa - Momento razoável para ${pair}`,
        zone: mediumActiveZone.name,
        confidence: 60
      };
    }

    // Nenhuma zona relevante ativa
    const upcomingZone = relevantZones.find(z => !z.isActive);
    return {
      isGood: false,
      reason: `Fora da Kill Zone ideal para ${pair}`,
      nextBestTime: upcomingZone?.name || 'Aguardar próxima sessão',
      confidence: 30
    };
  }

  /**
   * Retorna volatilidade esperada baseada na hora
   */
  getExpectedVolatility(currentHour) {
    // Volatilidade relativa por hora (0-100)
    const volatilityByHour = {
      0: 20, 1: 15, 2: 15, 3: 20, 4: 25, 5: 30, 6: 40,
      7: 70, 8: 85, 9: 90, 10: 75, // London Kill Zone
      11: 60, 12: 80, 13: 95, 14: 100, 15: 85, // NY Kill Zone
      16: 70, 17: 50, 18: 40, 19: 30, 20: 25, 21: 20, 22: 15, 23: 15
    };

    return {
      level: volatilityByHour[currentHour] || 50,
      description: this.getVolatilityDescription(volatilityByHour[currentHour] || 50)
    };
  }

  getVolatilityDescription(level) {
    if (level >= 90) return 'Muito Alta - Movimentos rápidos e significativos';
    if (level >= 70) return 'Alta - Bom momento para operações';
    if (level >= 50) return 'Média - Cautela recomendada';
    if (level >= 30) return 'Baixa - Movimentos limitados';
    return 'Muito Baixa - Evitar operações';
  }

  /**
   * Retorna análise completa para display
   */
  getFullAnalysis() {
    const now = new Date();
    const utcHour = now.getUTCHours();

    return {
      ...this.getAllKillZones(),
      volatility: this.getExpectedVolatility(utcHour),
      tradingAdvice: this.getTradingAdvice(utcHour)
    };
  }

  getTradingAdvice(currentHour) {
    const advice = [];

    // London Kill Zone
    if (currentHour >= 7 && currentHour < 10) {
      advice.push('🎯 LONDON KILL ZONE ATIVA - Melhor momento para entradas em EUR/GBP pairs');
      advice.push('⚠️ Espere o primeiro sweep de liquidez antes de entrar');
      advice.push('📊 Procure por FVG e Order Blocks formados na sessão asiática');
    }

    // NY Kill Zone
    if (currentHour >= 12 && currentHour < 15) {
      advice.push('🎯 NY KILL ZONE ATIVA - Momento de maior volatilidade');
      advice.push('⚠️ Atenção a notícias americanas');
      advice.push('📊 Possíveis reversões após sweep de liquidez');
    }

    // Overlap London/NY
    if (currentHour >= 12 && currentHour < 16) {
      advice.push('🔥 OVERLAP LONDON/NY - Período de máxima liquidez');
    }

    // Asian
    if (currentHour >= 0 && currentHour < 7) {
      advice.push('😴 SESSÃO ASIÁTICA - Baixa volatilidade');
      advice.push('📝 Use este período para análise e planejamento');
      advice.push('⏳ Aguarde London Kill Zone para melhores entradas');
    }

    // Late session
    if (currentHour >= 17 && currentHour < 21) {
      advice.push('📉 FINAL DA SESSÃO NY - Volatilidade diminuindo');
      advice.push('⚠️ Evite novas entradas, gerencie posições abertas');
    }

    // Dead zone
    if (currentHour >= 21 || currentHour < 0) {
      advice.push('💤 PERÍODO DE BAIXA ATIVIDADE');
      advice.push('⏳ Prepare análise para próxima sessão');
    }

    return advice;
  }
}

module.exports = KillZonesEngine;
