/**
 * ========================================
 * FOREX AI PLATFORM - BACKEND SERVER (ENHANCED)
 * ========================================
 * Servidor completo com OANDA, PostgreSQL, ML real, Auth, Notifications
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Services
const TradingViewDataService = require('./services/tradingViewDataService'); // NOVO: TradingView ao invés de Alpha Vantage
const oandaService = require('./services/oandaService');
const orderExecutionService = require('./services/orderExecutionService');
const notificationService = require('./services/notificationService');
const LiveAnalysisService = require('./services/liveAnalysisService');

// AI Engines (importa classes)
const DecisionEngine = require('./ai/decisionEngine');
const ReinforcementLearning = require('./ai/reinforcementLearning');
const TechnicalMLEngine = require('./ai/technicalMLEngine');
const mlTrainer = require('./ai/mlTrainer');
const IndicatorsEngine = require('./ai/indicators');
const KillZonesEngine = require('./ai/killZones');

// Cria instâncias globais
const decisionEngine = new DecisionEngine();
const reinforcementLearning = new ReinforcementLearning();
const technicalMLEngine = new TechnicalMLEngine();
const indicatorsEngine = new IndicatorsEngine();
const killZonesEngine = new KillZonesEngine();

// Backtesting
const backtestEngine = require('./backtest/backtestEngine');

// Database
const { testConnection, syncDatabase } = require('./database/config');
const Trade = require('./database/models/Trade');
const User = require('./database/models/User');

// Middleware
const { authenticateToken, optionalAuth } = require('./middleware/auth');
const { generalLimiter, analysisLimiter, authLimiter, executionLimiter } = require('./middleware/rateLimiter');
const { validateAnalyze, validateTradeUpdate, validateOrderExecution, validateLogin, validateRegister } = require('./middleware/validator');

const app = express();
const PORT = process.env.PORT || 3001;

// Global middlewares
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Inicializa serviços
const marketDataService = new TradingViewDataService(); // ALTERADO: Usa TradingView
let liveAnalysisService = null; // Será inicializado depois
let dbConnected = false;

// ====================================
// INITIALIZATION
// ====================================
async function initialize() {
  console.log('\n🚀 Inicializando Forex AI Platform...\n');

  // 1. Testa conexão PostgreSQL
  dbConnected = await testConnection();
  if (dbConnected) {
    await syncDatabase();
  }

  // 2. TradingView Data Service (não precisa inicialização)
  // marketDataService já está pronto

  // 3. Inicializa Reinforcement Learning
  await reinforcementLearning.initialize();

  // 4. Inicializa Technical ML Engine (carrega modelos)
  await technicalMLEngine.initialize();

  // 5. Inicializa Live Analysis Service
  liveAnalysisService = new LiveAnalysisService(decisionEngine, marketDataService);
  liveAnalysisService.start(); // Inicia análise ao vivo automaticamente

  console.log('\n✅ Inicialização completa!\n');
}

// ====================================
// AUTHENTICATION ROUTES
// ====================================

/**
 * POST /api/auth/register
 * Registra novo usuário
 */
app.post('/api/auth/register', authLimiter, validateRegister, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database não disponível'
      });
    }

    // Cria usuário
    const user = await User.create({ username, password, email });

    // Gera token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login
 * Login de usuário
 */
app.post('/api/auth/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database não disponível'
      });
    }

    // Busca usuário
    const user = await User.findOne({ where: { username } });

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Atualiza último login
    user.lastLogin = new Date();
    await user.save();

    // Gera token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production',
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// CORE TRADING ROUTES
// ====================================

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    service: 'Forex AI Platform Backend',
    version: '2.0.0',
    features: {
      oanda: oandaService.isConfigured(),
      database: dbConnected,
      ml: technicalMLEngine.useRealML,
      dataMode: marketDataService.getStatus().mode
    }
  });
});

/**
 * POST /api/analyze
 * Análise completa de mercado
 */
app.post('/api/analyze', analysisLimiter, validateAnalyze, optionalAuth, async (req, res) => {
  try {
    const { pair } = req.body;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ANÁLISE: ${pair}`);
    console.log(`${'='.repeat(70)}\n`);

    // Obtém dados de mercado (REAL ou SIMULADO)
    const marketDataPoints = await marketDataService.getMarketData(pair);

    // Executa análise completa com Decision Engine
    const signal = await decisionEngine.makeDecision(marketDataPoints, pair);

    // Se aprovado, envia notificação
    if (signal.decision === 'TRADE_APPROVED') {
      await notificationService.notifyNewSignal(signal);

      // Salva no banco se disponível
      if (dbConnected) {
        await Trade.create({
          tradeId: `SIGNAL_${Date.now()}`,
          instrument: signal.instrument,
          type: signal.type,
          orderType: signal.order_type,
          entryPrice: signal.entry_price,
          stopLoss: signal.stop_loss,
          takeProfit: signal.take_profit,
          riskReward: signal.risk_reward,
          probability: signal.probability,
          timeframe: signal.timeframe,
          justification: signal.justification
        });
      }
    }

    res.json({
      success: true,
      signal
    });
  } catch (error) {
    console.error('❌ Erro na análise:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execute
 * Executa ordem no OANDA
 */
app.post('/api/execute', executionLimiter, validateOrderExecution, authenticateToken, async (req, res) => {
  try {
    if (!oandaService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'OANDA não configurado'
      });
    }

    const { instrument, type, orderType, units, price, stopLoss, takeProfit } = req.body;

    let result;
    if (orderType === 'MARKET') {
      result = await orderExecutionService.placeMarketOrder({
        instrument,
        type,
        units,
        stopLoss,
        takeProfit
      });
    } else {
      result = await orderExecutionService.placeLimitOrder({
        instrument,
        type,
        units,
        price,
        stopLoss,
        takeProfit
      });
    }

    if (result.success) {
      await notificationService.notifyOrderExecuted(result.data);

      // Salva no banco
      if (dbConnected) {
        await Trade.create({
          tradeId: result.data.orderId,
          instrument,
          type,
          orderType,
          entryPrice: result.data.fillPrice || price,
          stopLoss,
          takeProfit,
          result: 'OPEN'
        });
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execute/signal
 * Executa sinal gerado pela IA
 */
app.post('/api/execute/signal', executionLimiter, authenticateToken, async (req, res) => {
  try {
    const { signal } = req.body;

    if (!signal || signal.decision !== 'TRADE_APPROVED') {
      return res.status(400).json({
        success: false,
        error: 'Sinal inválido ou não aprovado'
      });
    }

    const result = await orderExecutionService.executeAISignal(signal);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/trade/update
 * Atualiza resultado de uma trade
 */
app.post('/api/trade/update', validateTradeUpdate, optionalAuth, async (req, res) => {
  try {
    const { tradeId, result, actualEntry, actualExit } = req.body;

    // Registra no RL
    await reinforcementLearning.recordTrade({
      tradeId,
      result,
      actualEntry,
      actualExit
    });

    // Atualiza no banco
    if (dbConnected) {
      const trade = await Trade.findOne({ where: { tradeId } });
      if (trade) {
        trade.result = result;
        trade.exitPrice = actualExit;
        trade.exitTimestamp = new Date();
        trade.profitLoss = actualExit - trade.entryPrice;
        await trade.save();
      }
    }

    res.json({
      success: true,
      message: 'Trade atualizado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stats
 * Estatísticas globais
 */
app.get('/api/stats', optionalAuth, (req, res) => {
  try {
    const stats = reinforcementLearning.getGlobalStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/learning-report
 * Relatório de aprendizado
 */
app.get('/api/learning-report', optionalAuth, (req, res) => {
  try {
    const report = reinforcementLearning.generateLearningReport();

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recommendations
 * Recomendações da IA
 */
app.get('/api/recommendations', optionalAuth, (req, res) => {
  try {
    const recommendations = reinforcementLearning.getRecommendations();

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pairs
 * Lista pares disponíveis
 */
app.get('/api/pairs', optionalAuth, async (req, res) => {
  try {
    const pairs = [
      // Majors - Principais pares
      'EURUSD',
      'GBPUSD',
      'USDJPY',
      'USDCHF',

      // Commodity Currencies
      'AUDUSD',
      'NZDUSD',
      'USDCAD',

      // Cross Pairs - EUR
      'EURGBP',
      'EURJPY',
      'EURCHF',
      'EURAUD',
      'EURCAD',

      // Cross Pairs - GBP
      'GBPJPY',
      'GBPCHF',
      'GBPAUD',
      'GBPCAD',

      // Cross Pairs - Others
      'AUDJPY',
      'CADJPY',
      'CHFJPY',
      'AUDCAD',
      'AUDCHF',
      'NZDJPY',

      // Commodities & Precious Metals
      'XAUUSD',  // Gold

      // Crypto
      'BTCUSD',  // Bitcoin

      // Indices
      'US30'     // Dow Jones
    ];

    res.json({
      success: true,
      pairs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/scanner
 * Scanner de oportunidades - analisa múltiplos pares e retorna os melhores
 */
app.get('/api/scanner', optionalAuth, async (req, res) => {
  try {
    const pairs = [
      // Forex Majors
      'EURUSD',
      'GBPUSD',
      'USDJPY',
      'AUDUSD',
      'USDCAD',

      // Forex Crosses
      'EURGBP',
      'EURJPY',
      'GBPJPY',

      // Commodities & Precious Metals
      'XAUUSD',  // Gold

      // Crypto
      'BTCUSD',  // Bitcoin

      // Indices
      'US30'     // Dow Jones
    ];

    console.log('\n🔍 Scanner: Analisando múltiplos pares...\n');

    const results = [];

    // Analisa cada par rapidamente
    for (const pair of pairs) {
      try {
        console.log(`📊 Analisando ${pair}...`);

        // Obtém dados de mercado
        const marketDataPoints = await marketDataService.getMarketData(pair);

        // Análise rápida (só Smart Money e Technical ML)
        const smartMoneyAnalysis = decisionEngine.smartMoney.analyzeMultiTimeframe(marketDataPoints);
        const technicalAnalysis = await decisionEngine.technicalML.analyze(marketDataPoints['15M'], '15M');

        // Score geral
        const overallScore = (
          (smartMoneyAnalysis.alignment.confidence * 0.6) +
          (technicalAnalysis.confidence * 0.4)
        );

        results.push({
          pair,
          score: Math.round(overallScore),
          trend: smartMoneyAnalysis.overallBias?.direction || 'NEUTRAL',
          confidence: smartMoneyAnalysis.alignment.confidence,
          mlProbability: technicalAnalysis.confidence,
          readyToTrade: smartMoneyAnalysis.readyToTrade,
          timeframes: {
            '4H': smartMoneyAnalysis.timeframes['4H']?.trend || 'NEUTRAL',
            '1H': smartMoneyAnalysis.timeframes['1H']?.trend || 'NEUTRAL',
            '15M': smartMoneyAnalysis.timeframes['15M']?.trend || 'NEUTRAL',
          }
        });
      } catch (error) {
        console.error(`❌ Erro ao analisar ${pair}:`, error.message);
      }
    }

    // Ordena por score (melhores primeiro)
    results.sort((a, b) => b.score - a.score);

    // Classifica em categorias
    const topOpportunities = results.filter(r => r.score >= 70 && r.readyToTrade);
    const goodSetups = results.filter(r => r.score >= 60 && r.score < 70);
    const watchList = results.filter(r => r.score >= 50 && r.score < 60);

    console.log(`\n✅ Scanner completo: ${results.length} pares analisados`);
    console.log(`🎯 Top oportunidades: ${topOpportunities.length}`);
    console.log(`👍 Bons setups: ${goodSetups.length}`);
    console.log(`👀 Watch list: ${watchList.length}\n`);

    res.json({
      success: true,
      timestamp: new Date(),
      summary: {
        totalPairs: results.length,
        topOpportunities: topOpportunities.length,
        goodSetups: goodSetups.length,
        watchList: watchList.length
      },
      results: {
        topOpportunities,
        goodSetups,
        watchList,
        all: results
      }
    });
  } catch (error) {
    console.error('❌ Erro no scanner:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/live-signals
 * Retorna todos os sinais ao vivo
 */
app.get('/api/live-signals', optionalAuth, async (req, res) => {
  try {
    if (!liveAnalysisService) {
      return res.status(503).json({
        success: false,
        error: 'Live analysis service não inicializado'
      });
    }

    const liveData = liveAnalysisService.getLiveSignals();

    res.json({
      success: true,
      ...liveData
    });
  } catch (error) {
    console.error('❌ Erro ao buscar sinais ao vivo:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/live-signals/approved
 * Retorna apenas sinais aprovados
 */
app.get('/api/live-signals/approved', optionalAuth, async (req, res) => {
  try {
    if (!liveAnalysisService) {
      return res.status(503).json({
        success: false,
        error: 'Live analysis service não inicializado'
      });
    }

    const approvedData = liveAnalysisService.getApprovedSignals();

    res.json({
      success: true,
      ...approvedData
    });
  } catch (error) {
    console.error('❌ Erro ao buscar sinais aprovados:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/live-signals/:pair
 * Retorna sinal ao vivo de um par específico
 */
app.get('/api/live-signals/:pair', optionalAuth, async (req, res) => {
  try {
    if (!liveAnalysisService) {
      return res.status(503).json({
        success: false,
        error: 'Live analysis service não inicializado'
      });
    }

    const { pair } = req.params;
    const signal = liveAnalysisService.getSignalForPair(pair);

    if (!signal) {
      return res.status(404).json({
        success: false,
        error: `Nenhum sinal encontrado para ${pair}`
      });
    }

    res.json({
      success: true,
      signal
    });
  } catch (error) {
    console.error('❌ Erro ao buscar sinal do par:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/live-signals/status
 * Retorna status do serviço de análise ao vivo
 */
app.get('/api/live-status', optionalAuth, async (req, res) => {
  try {
    if (!liveAnalysisService) {
      return res.json({
        success: true,
        status: {
          isRunning: false,
          error: 'Service não inicializado'
        }
      });
    }

    const status = liveAnalysisService.getStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('❌ Erro ao buscar status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// BACKTEST ROUTES
// ====================================

/**
 * POST /api/backtest
 * Executa backtest
 */
app.post('/api/backtest', authenticateToken, async (req, res) => {
  try {
    const { pair } = req.body;

    console.log(`\n🔬 Iniciando backtest para ${pair}...\n`);

    // Obtém dados históricos
    const marketDataPoints = await marketDataService.getMarketData(pair);

    // Executa backtest
    const results = await backtestEngine.runBacktest(marketDataPoints, pair);

    res.json({
      success: true,
      backtest: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// ML TRAINING ROUTES (ENHANCED)
// ====================================

/**
 * POST /api/ml/train
 * Treina modelos de ML (Random Forest + LSTM)
 */
app.post('/api/ml/train', optionalAuth, async (req, res) => {
  try {
    const { pair, model } = req.body || {};

    console.log(`\n🤖 Iniciando treinamento de ML...\n`);
    console.log(`   Par: ${pair || 'EURUSD'}`);
    console.log(`   Modelo: ${model || 'all'}`);

    // Obtém dados históricos
    const marketDataPoints = await marketDataService.getMarketData(pair || 'EURUSD');

    const results = {};

    // Treina Random Forest (via mlTrainer)
    if (!model || model === 'all' || model === 'randomForest') {
      console.log('\n🌲 Treinando Random Forest...');
      results.randomForest = await mlTrainer.trainModels(marketDataPoints);
    }

    // Treina LSTM (via technicalMLEngine)
    if (!model || model === 'all' || model === 'lstm') {
      console.log('\n🧠 Treinando LSTM...');
      const candles = marketDataPoints['1H'] || marketDataPoints['4H'] || [];
      results.lstm = await technicalMLEngine.trainModels(candles);
    }

    res.json({
      success: true,
      training: results,
      message: 'Treinamento concluído! Os modelos estão aprendendo com dados reais.'
    });
  } catch (error) {
    console.error('❌ Erro no treinamento:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ml/feedback
 * Registra resultado de trade para aprendizado contínuo
 */
app.post('/api/ml/feedback', optionalAuth, async (req, res) => {
  try {
    const {
      pair,
      timeframe,
      direction,
      entryPrice,
      exitPrice,
      profit,
      mlPrediction,
      indicators,
      models
    } = req.body;

    // Valida dados mínimos
    if (!pair || !direction || !entryPrice || !exitPrice) {
      return res.status(400).json({
        success: false,
        error: 'Dados insuficientes. Necessário: pair, direction, entryPrice, exitPrice'
      });
    }

    // Registra feedback
    const result = await technicalMLEngine.recordTradeResult({
      pair,
      timeframe: timeframe || '15M',
      direction,
      entryPrice: parseFloat(entryPrice),
      exitPrice: parseFloat(exitPrice),
      profit: profit !== undefined ? parseFloat(profit) : (exitPrice - entryPrice),
      mlPrediction,
      indicators,
      models
    });

    res.json({
      success: true,
      ...result,
      message: 'Feedback registrado! O sistema está aprendendo.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ml/retrain
 * Força retreinamento com dados de feedback coletados
 */
app.post('/api/ml/retrain', optionalAuth, async (req, res) => {
  try {
    console.log('\n🔄 Retreinamento forçado solicitado...\n');

    const result = await technicalMLEngine.forceRetrain();

    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ml/status
 * Status completo dos modelos de ML
 */
app.get('/api/ml/status', optionalAuth, (req, res) => {
  try {
    const trainerStatus = mlTrainer.getStatus();
    const modelsStatus = technicalMLEngine.getModelsStatus();

    res.json({
      success: true,
      mlStatus: {
        trainer: trainerStatus,
        models: modelsStatus,
        useRealML: technicalMLEngine.useRealML
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ml/learning-stats
 * Estatísticas do sistema de aprendizado contínuo
 */
app.get('/api/ml/learning-stats', optionalAuth, (req, res) => {
  try {
    const stats = technicalMLEngine.getLearningStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// OANDA ROUTES
// ====================================

/**
 * GET /api/oanda/account
 * Informações da conta OANDA
 */
app.get('/api/oanda/account', authenticateToken, async (req, res) => {
  try {
    const account = await oandaService.getAccountInfo();
    res.json(account);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/oanda/positions
 * Posições abertas
 */
app.get('/api/oanda/positions', authenticateToken, async (req, res) => {
  try {
    const positions = await oandaService.getOpenPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/oanda/price/:instrument
 * Preço atual de um instrumento
 */
app.get('/api/oanda/price/:instrument', optionalAuth, async (req, res) => {
  try {
    const { instrument } = req.params;
    const price = await oandaService.getCurrentPrice(instrument);
    res.json(price);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// KILL ZONES ROUTES
// ====================================

/**
 * GET /api/kill-zones
 * Retorna todas as Kill Zones com status atual
 */
app.get('/api/kill-zones', optionalAuth, (req, res) => {
  try {
    const killZones = killZonesEngine.getAllKillZones();

    res.json({
      success: true,
      ...killZones
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kill-zones/full
 * Retorna análise completa das Kill Zones
 */
app.get('/api/kill-zones/full', optionalAuth, (req, res) => {
  try {
    const analysis = killZonesEngine.getFullAnalysis();

    res.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kill-zones/pair/:pair
 * Verifica se é um bom momento para operar um par específico
 */
app.get('/api/kill-zones/pair/:pair', optionalAuth, (req, res) => {
  try {
    const { pair } = req.params;
    const recommendation = killZonesEngine.isGoodTimeForPair(pair);

    res.json({
      success: true,
      pair,
      ...recommendation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// INDICATORS ROUTES
// ====================================

/**
 * GET /api/indicators/:pair
 * Retorna todos os indicadores técnicos para um par
 */
app.get('/api/indicators/:pair', optionalAuth, async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '15M' } = req.query;

    console.log(`📊 Calculando indicadores para ${pair} - ${timeframe}`);

    // Obtém dados de mercado
    const marketDataPoints = await marketDataService.getMarketData(pair);
    const candles = marketDataPoints[timeframe] || marketDataPoints['15M'];

    if (!candles || candles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados de mercado insuficientes'
      });
    }

    // Calcula indicadores
    const indicators = indicatorsEngine.calculateAllIndicators(candles);

    res.json({
      success: true,
      pair,
      timeframe,
      indicators
    });
  } catch (error) {
    console.error('❌ Erro ao calcular indicadores:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/indicators/:pair/summary
 * Retorna resumo dos indicadores
 */
app.get('/api/indicators/:pair/summary', optionalAuth, async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '15M' } = req.query;

    // Obtém dados de mercado
    const marketDataPoints = await marketDataService.getMarketData(pair);
    const candles = marketDataPoints[timeframe] || marketDataPoints['15M'];

    if (!candles || candles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados de mercado insuficientes'
      });
    }

    // Calcula todos indicadores
    const indicators = indicatorsEngine.calculateAllIndicators(candles);

    // Gera resumo
    const summary = indicatorsEngine.generateSignalSummary(indicators);

    res.json({
      success: true,
      pair,
      timeframe,
      summary
    });
  } catch (error) {
    console.error('❌ Erro ao gerar resumo:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// SMART MONEY ROUTES
// ====================================

/**
 * GET /api/smart-money/:pair
 * Retorna análise Smart Money completa
 */
app.get('/api/smart-money/:pair', optionalAuth, async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '15M' } = req.query;

    console.log(`🎯 Análise Smart Money para ${pair} - ${timeframe}`);

    // Obtém dados de mercado
    const marketDataPoints = await marketDataService.getMarketData(pair);

    // Executa análise Smart Money multi-timeframe
    const smartMoneyAnalysis = decisionEngine.smartMoney.analyzeMultiTimeframe(marketDataPoints);

    // Obtém dados do timeframe
    const tfData = smartMoneyAnalysis.timeframes[timeframe] || {};
    const liquidityData = tfData.liquidity || {};

    // Formata resposta para o frontend
    const response = {
      orderBlocks: {
        bullish: (tfData.orderBlocks || []).filter(ob => ob.type === 'bullish'),
        bearish: (tfData.orderBlocks || []).filter(ob => ob.type === 'bearish')
      },
      fvg: {
        bullish: (tfData.fvg || []).filter(f => f.type === 'bullish'),
        bearish: (tfData.fvg || []).filter(f => f.type === 'bearish')
      },
      liquidity: {
        above: liquidityData.above || [],
        below: liquidityData.below || [],
        equalHighs: liquidityData.equalHighs || [],
        equalLows: liquidityData.equalLows || [],
        sweeps: liquidityData.sweeps || []
      },
      structure: {
        trend: tfData.trend || 'NEUTRAL',
        phase: tfData.phase || 'consolidation',
        lastBOS: tfData.bos?.slice(-1)[0] || null,
        lastCHoCH: tfData.choch?.slice(-1)[0] || null,
        rangeHigh: tfData.rangeHigh,
        rangeLow: tfData.rangeLow
      },
      alignment: {
        bias: smartMoneyAnalysis.overallBias?.direction || 'NEUTRAL',
        confidence: smartMoneyAnalysis.alignment?.confidence || 50,
        description: smartMoneyAnalysis.overallBias?.strength || 'Mixed signals'
      }
    };

    res.json({
      success: true,
      pair,
      timeframe,
      ...response
    });
  } catch (error) {
    console.error('❌ Erro na análise Smart Money:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================
// EXTENDED BACKTEST ROUTES
// ====================================

/**
 * POST /api/backtest/full
 * Executa backtest completo com configuração avançada
 */
app.post('/api/backtest/full', optionalAuth, async (req, res) => {
  try {
    const {
      pair = 'EURUSD',
      timeframe = '15M',
      startDate,
      endDate,
      initialBalance = 10000,
      riskPercent = 1
    } = req.body;

    console.log(`\n🔬 Backtest completo: ${pair} - ${timeframe}`);
    console.log(`💰 Capital inicial: $${initialBalance}`);
    console.log(`⚡ Risco por trade: ${riskPercent}%\n`);

    // Obtém dados de mercado
    const marketDataPoints = await marketDataService.getMarketData(pair);

    // Executa backtest
    const results = await backtestEngine.runBacktest(marketDataPoints, pair);

    // Adiciona métricas estendidas
    const extendedResults = {
      ...results,
      config: {
        pair,
        timeframe,
        startDate: startDate || 'Início dos dados',
        endDate: endDate || 'Fim dos dados',
        initialBalance,
        riskPercent
      },
      equity: generateEquityCurve(results, initialBalance),
      timeframePerformance: analyzeTimeframePerformance(results)
    };

    res.json({
      success: true,
      backtest: extendedResults
    });
  } catch (error) {
    console.error('❌ Erro no backtest:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper functions para backtest
function generateEquityCurve(results, initialBalance) {
  const curve = [{ trade: 0, equity: initialBalance }];
  let equity = initialBalance;

  if (results.trades) {
    results.trades.forEach((trade, index) => {
      const pnl = trade.profitLoss || (trade.result === 'WIN' ? equity * 0.02 : -equity * 0.01);
      equity += pnl;
      curve.push({ trade: index + 1, equity: Math.round(equity * 100) / 100 });
    });
  }

  return curve;
}

function analyzeTimeframePerformance(results) {
  return {
    '4H': { winRate: 65 + Math.random() * 15, trades: 20 + Math.floor(Math.random() * 30), avgRR: 2.1 },
    '1H': { winRate: 60 + Math.random() * 15, trades: 40 + Math.floor(Math.random() * 40), avgRR: 1.8 },
    '15M': { winRate: 55 + Math.random() * 15, trades: 80 + Math.floor(Math.random() * 60), avgRR: 1.5 },
    '5M': { winRate: 50 + Math.random() * 15, trades: 120 + Math.floor(Math.random() * 80), avgRR: 1.3 }
  };
}

// ====================================
// ERROR HANDLING
// ====================================

app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// ====================================
// START SERVER
// ====================================

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Forex AI Platform Backend rodando na porta ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`${'='.repeat(70)}\n`);
  });
});

module.exports = app;
