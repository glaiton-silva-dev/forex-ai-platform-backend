/**
 * ==========================================
 * AUTHENTICATION MIDDLEWARE
 * ==========================================
 * Middleware para autenticação JWT
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';

/**
 * Middleware de autenticação
 * Verifica token JWT no header Authorization
 */
function authenticateToken(req, res, next) {
  // Extrai token do header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação não fornecido'
    });
  }

  try {
    // Verifica e decodifica token
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Token inválido ou expirado'
    });
  }
}

/**
 * Middleware opcional (não bloqueia se não houver token)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      req.user = user;
    } catch (error) {
      // Token inválido, mas não bloqueia
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

module.exports = {
  authenticateToken,
  optionalAuth
};
