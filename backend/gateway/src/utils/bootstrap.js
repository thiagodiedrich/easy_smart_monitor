/**
 * Bootstrap de usuário master (admin global).
 *
 * Cria um usuário admin via .env para uso inicial no dashboard.
 */
import bcrypt from 'bcrypt';
import { queryDatabase } from './database.js';
import { logger } from './logger.js';

function parseIntOrNull(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export async function bootstrapMasterAdmin() {
  const enabled = (process.env.MASTER_ADMIN_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) {
    return;
  }

  const username = process.env.MASTER_ADMIN_USERNAME;
  const password = process.env.MASTER_ADMIN_PASSWORD;
  const email = process.env.MASTER_ADMIN_EMAIL || null;
  const tenantId = parseIntOrNull(process.env.MASTER_ADMIN_TENANT_ID, 0);
  const organizationId = parseIntOrNull(process.env.MASTER_ADMIN_ORGANIZATION_ID, 0);
  const workspaceId = parseIntOrNull(process.env.MASTER_ADMIN_WORKSPACE_ID, 0);

  if (!username || !password) {
    logger.warn('MASTER_ADMIN habilitado, mas username/senha não definidos');
    return;
  }

  // Garantir tenant do sistema (id=0) para admin global
  if (tenantId === 0) {
    const tenantExists = await queryDatabase(
      'SELECT id FROM tenants WHERE id = $1',
      [tenantId]
    );
    if (!tenantExists || tenantExists.length === 0) {
      await queryDatabase(
        'INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, $4)',
        [0, 'System', 'system', 'active']
      );
      logger.info('Tenant sistema criado (id=0)');
    }
  }

  // Verificar se usuário já existe
  const existing = await queryDatabase(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );
  if (existing && existing.length > 0) {
    logger.info('Usuário master já existe, bootstrap ignorado', { username });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await queryDatabase(
    `
      INSERT INTO users (
        username,
        email,
        hashed_password,
        user_type,
        status,
        tenant_id,
        organization_id,
        workspace_id,
        role
      ) VALUES ($1, $2, $3, 'frontend', 'active', $4, $5, $6, 'admin')
    `,
    [username, email, hashedPassword, tenantId, [organizationId], [workspaceId]]
  );

  logger.info('Usuário master criado com sucesso', {
    username,
    tenant_id: tenantId,
    organization_id: organizationId,
    workspace_id: workspaceId,
  });
}
