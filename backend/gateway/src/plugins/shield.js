/**
 * Shield Plugin - Defense in Depth
 * 
 * Implementa múltiplas camadas de segurança:
 * 1. Blacklist Redis (verificação ultra-rápida)
 * 2. Rate Limiting Inteligente com Penalty Box
 * 3. Prevenção de Concorrência
 * 
 * Dependências:
 * - @fastify/redis
 */
import fp from 'fastify-plugin';
import { logger } from '../utils/logger.js';

/**
 * Configuração de Rate Limiting por tipo de usuário
 */
const RATE_LIMITS = {
  device: {
    normal: 10,      // 10 req/min (normal)
    jail: 30,        // 30 req/min (banimento)
  },
  frontend: {
    normal: 100,     // 100 req/min (normal)
    jail: 200,       // 200 req/min (banimento)
  },
  default: {
    normal: 50,      // 50 req/min (normal)
    jail: 100,       // 100 req/min (banimento)
  },
};

/**
 * Tempos de banimento (backoff exponencial)
 */
const BAN_TIMES = {
  1: 15 * 60,        // 15 minutos (1ª violação)
  2: 60 * 60,        // 1 hora (2ª violação)
  3: 24 * 60 * 60,   // 24 horas (3ª violação)
  4: 7 * 24 * 60 * 60, // 7 dias (4ª+ violação)
};

/**
 * Plugin Shield
 */
async function shieldPlugin(fastify, options) {
  // Verificar se Redis está disponível
  if (!fastify.redis) {
    logger.warn('Redis não disponível. Shield plugin desabilitado.');
    return;
  }
  
  const redis = fastify.redis;
  
  /**
   * Obtém tipo de usuário do token JWT ou request
   */
  function getUserType(request) {
    try {
      // Tentar decodificar token sem verificar (para obter tipo)
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        // Decodificar sem verificar (apenas para obter claims)
        try {
          const decoded = fastify.jwt.decode(token);
          if (decoded && decoded.user_type) {
            return decoded.user_type;
          }
        } catch (error) {
          // Token inválido, ignorar
        }
      }
    } catch (error) {
      // Ignorar erros de decodificação
    }
    
    // Verificar header customizado ou endpoint
    if (request.url.includes('/device/')) {
      return 'device';
    }
    
    return request.headers['x-user-type'] || 'default';
  }
  
  /**
   * Obtém identificador do dispositivo
   */
  function getDeviceId(request) {
    return request.headers['x-device-id'] || 
           request.headers['device-id'] || 
           request.ip;
  }
  
  /**
   * Obtém IP real (considerando proxy)
   */
  function getRealIP(request) {
    return request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           request.headers['x-real-ip'] ||
           request.ip ||
           request.socket.remoteAddress;
  }
  
  /**
   * Verifica se está na blacklist
   */
  async function checkBlacklist(ip, deviceId) {
    const ipBanned = await redis.get(`ban:ip:${ip}`);
    const deviceBanned = await redis.get(`ban:device:${deviceId}`);
    
    return {
      banned: !!(ipBanned || deviceBanned),
      reason: ipBanned ? 'ip' : deviceBanned ? 'device' : null,
    };
  }
  
  /**
   * Adiciona à blacklist
   */
  async function addToBlacklist(ip, deviceId, banTime, reason = 'rate_limit') {
    await redis.set(`ban:ip:${ip}`, reason, 'EX', banTime);
    await redis.set(`ban:device:${deviceId}`, reason, 'EX', banTime);
    
    // Log estruturado para Fail2Ban
    logger.warn('[SECURITY] Ban IP', {
      ip,
      deviceId,
      banTime,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Obtém contador de violações
   */
  async function getViolationCount(deviceId) {
    const count = await redis.get(`violations:${deviceId}`);
    return parseInt(count || '0', 10);
  }
  
  /**
   * Incrementa contador de violações
   */
  async function incrementViolation(deviceId) {
    const count = await redis.incr(`violations:${deviceId}`);
    await redis.expire(`violations:${deviceId}`, 7 * 24 * 60 * 60); // 7 dias
    return count;
  }
  
  /**
   * Calcula tempo de banimento baseado em violações
   */
  function calculateBanTime(violationCount) {
    if (violationCount >= 4) return BAN_TIMES[4];
    if (violationCount >= 3) return BAN_TIMES[3];
    if (violationCount >= 2) return BAN_TIMES[2];
    return BAN_TIMES[1];
  }
  
  // ============================================
  // CAMADA 1: BLACKLIST (onRequest - Primeira)
  // ============================================
  fastify.addHook('onRequest', async (request, reply) => {
    // Excluir health checks
    if (request.url.startsWith('/api/v1/health') || 
        request.url === '/') {
      return;
    }
    
    const ip = getRealIP(request);
    const deviceId = getDeviceId(request);
    
    const blacklistCheck = await checkBlacklist(ip, deviceId);
    
    if (blacklistCheck.banned) {
      logger.warn('[SECURITY] Blocked banned entity', {
        ip,
        deviceId,
        reason: blacklistCheck.reason,
        url: request.url,
      });
      
      reply.code(403).send({
        error: 'Access Denied',
        message: 'Temporarily blocked due to suspicious activity.',
      });
      return reply;
    }
  });
  
  // ============================================
  // CAMADA 2: RATE LIMITING + PENALTY BOX
  // ============================================
  fastify.decorate('shieldRequest', async function (request, reply) {
    // Excluir health checks
    if (request.url.startsWith('/api/v1/health') || 
        request.url === '/') {
      return;
    }
    
    const ip = getRealIP(request);
    const deviceId = getDeviceId(request);
    const userType = getUserType(request);
    
    // Obter limites baseado no tipo de usuário
    const limits = RATE_LIMITS[userType] || RATE_LIMITS.default;
    
    // Chave de rate limiting
    const rateKey = `rate:${userType}:${deviceId}`;
    
    // Incrementar contador (janela de 1 minuto)
    const currentUsage = await redis.incr(rateKey);
    
    if (currentUsage === 1) {
      await redis.expire(rateKey, 60); // Reset a cada 60s
    }
    
    // Nível 1: Abuso grave detectado -> BANIMENTO AUTOMÁTICO
    if (currentUsage > limits.jail) {
      const violationCount = await incrementViolation(deviceId);
      const banTime = calculateBanTime(violationCount);
      
      logger.error('[SECURITY] Device exceeded security limit', {
        deviceId,
        ip,
        userType,
        currentUsage,
        limit: limits.jail,
        violationCount,
        banTime,
      });
      
      // Adicionar à blacklist
      await addToBlacklist(ip, deviceId, banTime, 'rate_limit_exceeded');
      
      reply.code(403).send({
        error: 'Security Alert',
        message: `You have been banned for ${Math.floor(banTime / 60)} minutes due to excessive requests.`,
        retry_after: banTime,
      });
      return reply;
    }
    
    // Nível 2: Limite normal excedido
    if (currentUsage > limits.normal) {
      reply.header('Retry-After', '60');
      reply.header('X-RateLimit-Limit', limits.normal.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('X-RateLimit-Reset', (Date.now() + 60000).toString());
      
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please slow down.',
        retry_after: 60,
      });
      return reply;
    }
    
    // Adicionar headers informativos
    reply.header('X-RateLimit-Limit', limits.normal.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, limits.normal - currentUsage).toString());
    reply.header('X-RateLimit-Reset', (Date.now() + 60000).toString());
  });
  
  // ============================================
  // CAMADA 3: PREVENÇÃO DE CONCORRÊNCIA
  // ============================================
  fastify.decorate('preventConcurrency', async function (request, reply) {
    // Aplicar apenas em rotas de upload/telemetria
    if (!request.url.includes('/telemetry') && 
        !request.url.includes('/telemetria')) {
      return;
    }
    
    const deviceId = getDeviceId(request);
    const lockKey = `lock:upload:${deviceId}`;
    
    // Tentar adquirir lock (NX = só seta se não existir, EX = expira em 300s)
    const acquired = await redis.set(lockKey, 'LOCKED', 'NX', 'EX', 300);
    
    if (!acquired) {
      logger.warn('[SECURITY] Concurrent upload detected', {
        deviceId,
        url: request.url,
      });
      
      reply.code(409).send({
        error: 'Concurrent Upload',
        message: 'Please wait for the previous upload to finish.',
      });
      return reply;
    }
    
    // Liberar lock quando a request terminar
    reply.raw.on('finish', async () => {
      await redis.del(lockKey);
    });
    
    reply.raw.on('error', async () => {
      await redis.del(lockKey);
    });
  });
  
  // ============================================
  // UTILITÁRIOS PARA ADMIN
  // ============================================
  
  /**
   * Remove da blacklist (admin)
   */
  fastify.decorate('unbanEntity', async function (ip, deviceId) {
    await redis.del(`ban:ip:${ip}`);
    await redis.del(`ban:device:${deviceId}`);
    await redis.del(`violations:${deviceId}`);
    
    logger.info('[SECURITY] Entity unbanned', { ip, deviceId });
  });
  
  /**
   * Lista entidades banidas (admin)
   */
  fastify.decorate('listBannedEntities', async function () {
    const keys = await redis.keys('ban:*');
    const banned = [];
    
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      const reason = await redis.get(key);
      banned.push({
        key,
        reason,
        expires_in: ttl,
      });
    }
    
    return banned;
  });
  
  logger.info('Shield plugin registrado com sucesso');
}

export default fp(shieldPlugin, {
  name: 'shield',
  dependencies: ['@fastify/redis'],
});
