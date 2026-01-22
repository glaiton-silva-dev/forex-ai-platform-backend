/**
 * ==========================================
 * RATE LIMITER MIDDLEWARE
 * ==========================================
 * Protege contra abuso e DDoS
 */

const rateLimit = require('express-rate-limit');

/**
 * Limiter geral para todas as rotas
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por janela
  message: {
    success: false,
    error: 'Muitas requisições, tente novamente mais tarde'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Limiter estrito para análises (mais custosas)
 */
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 análises por minuto
  message: {
    success: false,
    error: 'Limite de análises atingido, aguarde 1 minuto'
  }
});

/**
 * Limiter para execução de ordens (crítico)
 */
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 ordens por minuto
  message: {
    success: false,
    error: 'Limite de execução de ordens atingido'
  }
});

/**
 * Limiter para autenticação (evita brute force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    success: false,
    error: 'Muitas tentativas de login, tente novamente em 15 minutos'
  }
});

module.exports = {
  generalLimiter,
  analysisLimiter,
  executionLimiter,
  authLimiter
};
