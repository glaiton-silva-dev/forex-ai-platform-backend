/**
 * ==========================================
 * INPUT VALIDATION MIDDLEWARE
 * ==========================================
 * Valida inputs usando express-validator
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para verificar erros de validação
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array()
    });
  }

  next();
};

/**
 * Validação para análise de mercado
 */
const validateAnalyze = [
  body('pair')
    .notEmpty().withMessage('Par de moedas é obrigatório')
    .isString().withMessage('Par deve ser string')
    .matches(/^[A-Z]{6}$|^[A-Z]{3}_[A-Z]{3}$/).withMessage('Formato inválido (ex: EURUSD ou EUR_USD)'),

  body('timeframe')
    .optional()
    .isIn(['5M', '15M', '1H', '4H']).withMessage('Timeframe inválido'),

  validate
];

/**
 * Validação para atualização de trade
 */
const validateTradeUpdate = [
  body('tradeId')
    .notEmpty().withMessage('Trade ID é obrigatório')
    .isString(),

  body('result')
    .notEmpty().withMessage('Resultado é obrigatório')
    .isIn(['WIN', 'LOSS', 'BREAKEVEN']).withMessage('Resultado deve ser WIN, LOSS ou BREAKEVEN'),

  body('actualEntry')
    .optional()
    .isFloat({ min: 0 }).withMessage('Preço de entrada inválido'),

  body('actualExit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Preço de saída inválido'),

  validate
];

/**
 * Validação para execução de ordem
 */
const validateOrderExecution = [
  body('instrument')
    .notEmpty().withMessage('Instrumento é obrigatório')
    .isString(),

  body('type')
    .notEmpty().withMessage('Tipo é obrigatório')
    .isIn(['BUY', 'SELL']).withMessage('Tipo deve ser BUY ou SELL'),

  body('orderType')
    .notEmpty().withMessage('Tipo de ordem é obrigatório')
    .isIn(['MARKET', 'LIMIT']).withMessage('Tipo de ordem deve ser MARKET ou LIMIT'),

  body('units')
    .notEmpty().withMessage('Unidades são obrigatórias')
    .isInt({ min: 1 }).withMessage('Unidades devem ser um número inteiro positivo'),

  body('stopLoss')
    .optional()
    .isFloat({ min: 0 }).withMessage('Stop Loss inválido'),

  body('takeProfit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Take Profit inválido'),

  body('price')
    .if(body('orderType').equals('LIMIT'))
    .notEmpty().withMessage('Preço é obrigatório para ordem LIMIT')
    .isFloat({ min: 0 }).withMessage('Preço inválido'),

  validate
];

/**
 * Validação para login
 */
const validateLogin = [
  body('username')
    .notEmpty().withMessage('Username é obrigatório')
    .isString()
    .trim()
    .isLength({ min: 3 }).withMessage('Username deve ter pelo menos 3 caracteres'),

  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isString()
    .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),

  validate
];

/**
 * Validação para registro
 */
const validateRegister = [
  body('username')
    .notEmpty().withMessage('Username é obrigatório')
    .isString()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username deve ter entre 3 e 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username deve conter apenas letras, números e underscore'),

  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isString()
    .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),

  body('email')
    .optional()
    .isEmail().withMessage('Email inválido'),

  validate
];

module.exports = {
  validate,
  validateAnalyze,
  validateTradeUpdate,
  validateOrderExecution,
  validateLogin,
  validateRegister
};
