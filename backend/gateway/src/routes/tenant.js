/**
 * Rotas de Administração do Tenant (self-service)
 */
import { queryDatabase } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcrypt';

function getRoleName(role) {
  if (!role) return null;
  if (typeof role === 'string') return role;
  if (Array.isArray(role)) {
    if (role.includes(0) || role.includes('0')) return 'super';
    if (role.includes('admin')) return 'admin';
    if (role.includes('manager')) return 'manager';
    if (role.includes('viewer')) return 'viewer';
    return null;
  }
  if (typeof role === 'object') {
    if (role[0] === true || role['0'] === true || role.super === true) return 'super';
    if (role.role) return role.role;
    if (role.name) return role.name;
    return null;
  }
  return null;
}

function isSuperUser(request) {
  const role = request.user?.role;
  return Array.isArray(role)
    ? role.includes(0) || role.includes('0')
    : Boolean(role && typeof role === 'object' && (role[0] === true || role['0'] === true || role.super === true));
}

function isTenantAdmin(request) {
  if (isSuperUser(request)) {
    return true;
  }
  const roleName = getRoleName(request.user?.role);
  return roleName === 'admin' || roleName === 'manager';
}

function normalizeRolePayload(role) {
  if (role === undefined || role === null || role === '') {
    return { role: 'viewer' };
  }
  if (Array.isArray(role) || typeof role === 'object') {
    return role;
  }
  if (typeof role === 'string') {
    return { role };
  }
  return { role: 'viewer' };
}

function hasSuperRole(role) {
  if (Array.isArray(role)) {
    return role.includes(0) || role.includes('0');
  }
  if (role && typeof role === 'object') {
    return role[0] === true || role['0'] === true || role.super === true;
  }
  return false;
}

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      enum: [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'VALIDATION_ERROR',
        'INVALID_SCOPE',
        'LIMIT_REACHED',
      ],
    },
    message: { type: 'string' },
  },
};

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntArrayOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const parsed = raw
    .map((item) => parseInt(String(item).trim(), 10))
    .filter((item) => !Number.isNaN(item));
  return parsed.length ? parsed : null;
}

function resolveQueryScope(request) {
  const isSuper = isSuperUser(request);
  const tenantParam = parseIntArrayOrNull(request.query?.tenant_id);
  const organizationParam = parseIntArrayOrNull(request.query?.organization_id);
  const workspaceParam = parseIntArrayOrNull(request.query?.workspace_id);
  const tenantIds = isSuper ? (tenantParam !== null ? tenantParam : null) : [request.user?.tenant_id];

  return {
    // Padrao multi-tenant: 0 ou listas (ex: 1,2,3). Super admin pode filtrar por query.
    isSuper,
    tenantIds,
    organizationIds: organizationParam,
    workspaceIds: workspaceParam,
  };
}

function normalizeScopeArray(value) {
  if (value === undefined || value === null) {
    return [0];
  }
  if (Array.isArray(value)) {
    const parsed = value.map((v) => parseInt(v, 10)).filter((v) => !Number.isNaN(v));
    if (parsed.includes(0) || parsed.length === 0) {
      return [0];
    }
    return parsed;
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed === 0) {
    return [0];
  }
  return [parsed];
}

async function validateOrgWorkspace(tenantId, organizationIds, workspaceIds) {
  if (!organizationIds.includes(0)) {
    const orgs = await queryDatabase(
      `SELECT id FROM organizations WHERE tenant_id = $1 AND id = ANY($2)`,
      [tenantId, organizationIds]
    );
    if (orgs.length !== organizationIds.length) {
      return { ok: false, error: 'organization_id inválido para o tenant' };
    }
  }
  if (!workspaceIds.includes(0)) {
    const workspaces = await queryDatabase(
      `
        SELECT w.id
        FROM workspaces w
        INNER JOIN organizations o ON w.organization_id = o.id
        WHERE o.tenant_id = $1 AND w.id = ANY($2)
      `,
      [tenantId, workspaceIds]
    );
    if (workspaces.length !== workspaceIds.length) {
      return { ok: false, error: 'workspace_id inválido para o tenant' };
    }
  }
  return { ok: true };
}

async function getTenantLimits(tenantId) {
  const result = await queryDatabase(
    `
      SELECT
        t.plan_code,
        p.name AS plan_name,
        COALESCE(tl.items_per_day, p.items_per_day, 0) AS items_per_day,
        COALESCE(tl.sensors_per_day, p.sensors_per_day, 0) AS sensors_per_day,
        COALESCE(tl.bytes_per_day, p.bytes_per_day, 0) AS bytes_per_day,
        COALESCE(tl.equipments_total, p.equipments_total, 0) AS equipments_total,
        COALESCE(tl.sensors_total, p.sensors_total, 0) AS sensors_total,
        COALESCE(tl.users_total, p.users_total, 0) AS users_total,
        COALESCE(tl.organization_total, p.organization_total, 0) AS organization_total,
        COALESCE(tl.workspace_total, p.workspace_total, 0) AS workspace_total
      FROM tenants t
      LEFT JOIN plans p ON t.plan_code = p.code
      LEFT JOIN tenant_limits tl ON tl.tenant_id = t.id
      WHERE t.id = $1
    `,
    [tenantId]
  );
  return result[0] || null;
}

function limitReached(limitValue, currentCount) {
  const limit = Number(limitValue || 0);
  if (!limit || limit <= 0) {
    return false;
  }
  return currentCount >= limit;
}

async function auditLog(request, action, targetType, targetId, metadata = {}) {
  try {
    const actorRole = getRoleName(request.user?.role);
    await queryDatabase(
      `
        INSERT INTO audit_logs (
          tenant_id,
          actor_user_id,
          actor_role,
          action,
          target_type,
          target_id,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        request.user?.tenant_id ?? null,
        request.user?.user_id ?? null,
        actorRole,
        action,
        targetType,
        targetId ? String(targetId) : null,
        metadata,
      ]
    );
  } catch (error) {
    logger.warn('Falha ao registrar audit log', { error: error.message });
  }
}

export const tenantRoutes = async (fastify) => {
  // Middleware de autenticação + admin tenant
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
      if (request.user?.user_type === 'device') {
        const isWorkspacesGet = request.method === 'GET'
          && (request.url || '').startsWith('/api/v1/tenant/workspaces');
        if (isWorkspacesGet) {
          return;
        }
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Acesso restrito para usuário device',
        });
      }
      if (!isTenantAdmin(request)) {
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'Acesso restrito ao admin do tenant',
        });
      }
    } catch (err) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Não autorizado',
      });
    }
  });

  // Organizations
  fastify.post('/organizations', {
    schema: {
      description: 'Cria uma organization no tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Ex: Matriz' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          document: { type: 'string', description: 'Ex: 12.345.678/0001-90' },
          phone: { type: 'string', description: 'Ex: +55 11 99999-0000' },
          email: { type: 'string', description: 'Ex: contato@empresa.com' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name, document, phone, email, status = 'active' } = request.body || {};
    if (!name) {
      return reply.code(400).send({ error: 'name é obrigatório' });
    }
    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    if (organization_id !== undefined && organization_id !== null) {
      const parsedOrgId = Number(organization_id);
      if (Number.isNaN(parsedOrgId) || parsedOrgId < 0) {
        return reply.code(400).send({ error: 'organization_id inválido. Use 0 ou maior' });
      }
      const org = await queryDatabase(
        `SELECT id FROM organizations WHERE id = $1 AND tenant_id = $2`,
        [parsedOrgId, request.user.tenant_id]
      );
      if (!org || org.length === 0) {
        return reply.code(404).send({ error: 'Organization não encontrada' });
      }
    }
    const limits = await getTenantLimits(request.user.tenant_id);
    if (limits?.organization_total) {
      const countResult = await queryDatabase(
        `SELECT COUNT(*)::int AS total FROM organizations WHERE tenant_id = $1`,
        [request.user.tenant_id]
      );
      const total = countResult[0]?.total || 0;
      if (limitReached(limits.organization_total, total)) {
        return reply.code(403).send({ error: 'Limite de organizations do plano atingido' });
      }
    }
    const result = await queryDatabase(
      `
        INSERT INTO organizations (tenant_id, name, status, document, phone, email, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `,
      [request.user.tenant_id, name, status, document || null, phone || null, email || null]
    );
    await auditLog(request, 'create', 'organization', result[0]?.id, { name });
    return reply.code(201).send({ id: result[0]?.id });
  });

  fastify.get('/organizations', {
    schema: {
      description: 'Lista organizations do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID da organization' },
              tenant_id: { type: 'number', description: 'ID do tenant' },
              name: { type: 'string', description: 'Nome da organization' },
              status: { type: 'string', description: 'Status da organization' },
              document: { type: 'string', description: 'Documento da organization' },
              phone: { type: 'string', description: 'Telefone da organization' },
              email: { type: 'string', description: 'E-mail da organization' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds } = resolveQueryScope(request);
    const params = [];
    let query = 'SELECT * FROM organizations WHERE 1=1';
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND id = ANY($${params.length}::int[])`;
    }
    query += ' ORDER BY id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/organizations/:id', {
    schema: {
      description: 'Atualiza organization do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ex: Filial Centro' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          document: { type: 'string', description: 'Ex: 12.345.678/0001-90' },
          phone: { type: 'string', description: 'Ex: +55 11 99999-0000' },
          email: { type: 'string', description: 'Ex: contato@empresa.com' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, document, phone, email, status } = request.body || {};
    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    await queryDatabase(
      `
        UPDATE organizations
        SET
          name = COALESCE($1, name),
          status = COALESCE($2, status),
          document = COALESCE($3, document),
          phone = COALESCE($4, phone),
          email = COALESCE($5, email),
          updated_at = NOW()
        WHERE id = $6 AND tenant_id = $7
      `,
      [name || null, status || null, document || null, phone || null, email || null, id, request.user.tenant_id]
    );
    await auditLog(request, 'update', 'organization', id, { name, status, document, phone, email });
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/organizations/:id', {
    schema: {
      description: 'Remove organization do tenant',
      tags: ['Tenant'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await queryDatabase(
      `DELETE FROM organizations WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'delete', 'organization', id, {});
    return reply.send({ status: 'ok' });
  });

  // Workspaces
  fastify.post('/workspaces', {
    schema: {
      description: 'Cria workspace no tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['organization_id', 'name'],
        properties: {
          organization_id: { type: 'number', description: 'Ex: 1' },
          name: { type: 'string', description: 'Ex: Workspace A' },
          description: { type: 'string', description: 'Ex: Ambiente de testes' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { organization_id, name, description, status = 'active' } = request.body || {};
    if (organization_id === undefined || organization_id === null || name === undefined || name === null || name === '') {
      return reply.code(400).send({ error: 'organization_id e name são obrigatórios' });
    }
    const parsedOrgId = Number(organization_id);
    if (Number.isNaN(parsedOrgId) || parsedOrgId < 0) {
      return reply.code(400).send({ error: 'organization_id inválido. Use 0 ou maior' });
    }
    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    const limits = await getTenantLimits(request.user.tenant_id);
    if (limits?.workspace_total) {
      const countResult = await queryDatabase(
        `
          SELECT COUNT(*)::int AS total
          FROM workspaces w
          INNER JOIN organizations o ON w.organization_id = o.id
          WHERE o.tenant_id = $1
        `,
        [request.user.tenant_id]
      );
      const total = countResult[0]?.total || 0;
      if (limitReached(limits.workspace_total, total)) {
        return reply.code(403).send({ error: 'Limite de workspaces do plano atingido' });
      }
    }
    if (parsedOrgId !== 0) {
      const org = await queryDatabase(
        `SELECT id FROM organizations WHERE id = $1 AND tenant_id = $2`,
        [parsedOrgId, request.user.tenant_id]
      );
      if (!org || org.length === 0) {
        return reply.code(404).send({ error: 'Organization não encontrada' });
      }
    }
    const result = await queryDatabase(
      `
        INSERT INTO workspaces (organization_id, name, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
      `,
      [parsedOrgId, name, description || null, status]
    );
    await auditLog(request, 'create', 'workspace', result[0]?.id, { name, description, organization_id });
    return reply.code(201).send({ id: result[0]?.id });
  });

  fastify.get('/workspaces', {
    schema: {
      description: 'Lista workspaces do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID do workspace' },
              organization_id: { type: 'number', description: 'ID da organization' },
              name: { type: 'string', description: 'Nome do workspace' },
              description: { type: 'string', description: 'Descricao do workspace' },
              status: { type: 'string', description: 'Status do workspace' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds, workspaceIds } = resolveQueryScope(request);
    const params = [];
    let query = `
      SELECT w.*
      FROM workspaces w
      LEFT JOIN organizations o ON w.organization_id = o.id
      WHERE 1=1
    `;
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND (o.tenant_id = ANY($${params.length}::int[]) OR w.organization_id = 0)`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND w.organization_id = ANY($${params.length}::int[])`;
    }
    if (workspaceIds && !workspaceIds.includes(0)) {
      params.push(workspaceIds);
      query += ` AND w.id = ANY($${params.length}::int[])`;
    }
    query += ' ORDER BY w.id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/workspaces/:id', {
    schema: {
      description: 'Atualiza workspace do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ex: Workspace B' },
          description: { type: 'string', description: 'Ex: Ambiente principal' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          organization_id: { type: 'number', minimum: 0, description: 'ID da organization (0 = todas)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, status, organization_id } = request.body || {};
    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    if (organization_id !== undefined && organization_id !== null) {
      const parsedOrgId = Number(organization_id);
      if (Number.isNaN(parsedOrgId) || parsedOrgId < 0) {
        return reply.code(400).send({ error: 'organization_id inválido. Use 0 ou maior' });
      }
      if (parsedOrgId !== 0) {
        const org = await queryDatabase(
          `SELECT id FROM organizations WHERE id = $1 AND tenant_id = $2`,
          [parsedOrgId, request.user.tenant_id]
        );
        if (!org || org.length === 0) {
          return reply.code(404).send({ error: 'Organization não encontrada' });
        }
      }
    }
    await queryDatabase(
      `
        UPDATE workspaces
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            status = COALESCE($3::workspace_status, status),
            organization_id = COALESCE($4, organization_id),
            updated_at = NOW()
        WHERE id = $5
          AND (
            organization_id = 0
            OR organization_id IN (
              SELECT id FROM organizations WHERE tenant_id = $6
            )
          )
      `,
      [name || null, description || null, status || null, organization_id ?? null, id, request.user.tenant_id]
    );
    await auditLog(request, 'update', 'workspace', id, { name, description, status, organization_id });
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/workspaces/:id', {
    schema: {
      description: 'Remove workspace do tenant',
      tags: ['Tenant'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await queryDatabase(
      `
        DELETE FROM workspaces
        WHERE id = $1 AND organization_id IN (
          SELECT id FROM organizations WHERE tenant_id = $2
        )
      `,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'delete', 'workspace', id, {});
    return reply.send({ status: 'ok' });
  });

  // Equipments
  fastify.post('/equipments', {
    schema: {
      description: 'Cria equipamento no tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['uuid', 'name', 'organization_id', 'workspace_id'],
        properties: {
          uuid: { type: 'string', description: 'Ex: 550e8400-e29b-41d4-a716-446655440000' },
          name: { type: 'string', description: 'Ex: Gerador A' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          collection_interval: { type: 'number', description: 'Ex: 60' },
          siren_active: { type: 'boolean', description: 'Ex: false' },
          siren_time: { type: 'number', description: 'Ex: 120' },
          organization_id: { type: 'number', minimum: 0, description: 'Ex: 1 (0 = todas)' },
          workspace_id: { type: 'number', minimum: 0, description: 'Ex: 10 (0 = todas)' },
        },
      },
      response: {
        201: { type: 'object', properties: { id: { type: 'number' } } },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const {
      uuid,
      name,
      status = 'active',
      collection_interval = 60,
      siren_active = false,
      siren_time = 120,
      organization_id,
      workspace_id,
    } = request.body || {};

    if (!uuid || !name || organization_id === undefined || organization_id === null || workspace_id === undefined || workspace_id === null) {
      return reply.code(400).send({ error: 'uuid, name, organization_id e workspace_id são obrigatórios' });
    }
    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    const parsedOrgId = Number(organization_id);
    const parsedWsId = Number(workspace_id);
    if (Number.isNaN(parsedOrgId) || parsedOrgId < 0) {
      return reply.code(400).send({ error: 'organization_id inválido. Use 0 ou maior' });
    }
    if (Number.isNaN(parsedWsId) || parsedWsId < 0) {
      return reply.code(400).send({ error: 'workspace_id inválido. Use 0 ou maior' });
    }
    const scopeCheck = await validateOrgWorkspace(request.user.tenant_id, [parsedOrgId], [parsedWsId]);
    if (!scopeCheck.ok) {
      return reply.code(400).send({ error: scopeCheck.error });
    }

    const result = await queryDatabase(
      `
        INSERT INTO equipments (
          uuid, name, status, collection_interval, siren_active, siren_time,
          tenant_id, organization_id, workspace_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3::entity_status, $4, $5, $6,
          $7, $8, $9, NOW(), NOW()
        )
        RETURNING id
      `,
      [
        uuid,
        name,
        status,
        collection_interval,
        !!siren_active,
        siren_time,
        request.user.tenant_id,
        parsedOrgId,
        parsedWsId,
      ]
    );
    await auditLog(request, 'create', 'equipment', result[0]?.id, { uuid, name, status });
    return reply.code(201).send({ id: result[0]?.id });
  });

  fastify.get('/equipments', {
    schema: {
      description: 'Lista equipamentos do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID do equipamento' },
              uuid: { type: 'string', description: 'UUID do equipamento' },
              name: { type: 'string', description: 'Nome do equipamento' },
              status: { type: 'string', description: 'Status' },
              collection_interval: { type: 'number', description: 'Intervalo de coleta' },
              siren_active: { type: 'boolean', description: 'Sirene ativa' },
              siren_time: { type: 'number', description: 'Tempo da sirene' },
              tenant_id: { type: 'number', description: 'ID do tenant' },
              organization_id: { type: 'number', description: 'ID da organization' },
              workspace_id: { type: 'number', description: 'ID do workspace' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds, workspaceIds } = resolveQueryScope(request);
    const params = [];
    let query = 'SELECT * FROM equipments WHERE 1=1';
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND organization_id = ANY($${params.length}::int[])`;
    }
    if (workspaceIds && !workspaceIds.includes(0)) {
      params.push(workspaceIds);
      query += ` AND workspace_id = ANY($${params.length}::int[])`;
    }
    query += ' ORDER BY id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/equipments/:id', {
    schema: {
      description: 'Atualiza equipamento do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ex: Gerador B' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          collection_interval: { type: 'number', description: 'Ex: 60' },
          siren_active: { type: 'boolean', description: 'Ex: false' },
          siren_time: { type: 'number', description: 'Ex: 120' },
          organization_id: { type: 'number', minimum: 0, description: 'Ex: 1 (0 = todas)' },
          workspace_id: { type: 'number', minimum: 0, description: 'Ex: 10 (0 = todas)' },
        },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      status,
      collection_interval,
      siren_active,
      siren_time,
      organization_id,
      workspace_id,
    } = request.body || {};

    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    if (organization_id !== undefined && organization_id !== null) {
      const parsedOrgId = Number(organization_id);
      if (Number.isNaN(parsedOrgId) || parsedOrgId < 0) {
        return reply.code(400).send({ error: 'organization_id inválido. Use 0 ou maior' });
      }
    }
    if (workspace_id !== undefined && workspace_id !== null) {
      const parsedWsId = Number(workspace_id);
      if (Number.isNaN(parsedWsId) || parsedWsId < 0) {
        return reply.code(400).send({ error: 'workspace_id inválido. Use 0 ou maior' });
      }
    }

    if (organization_id !== undefined || workspace_id !== undefined) {
      const orgId = organization_id ?? 0;
      const wsId = workspace_id ?? 0;
      const scopeCheck = await validateOrgWorkspace(request.user.tenant_id, [Number(orgId)], [Number(wsId)]);
      if (!scopeCheck.ok) {
        return reply.code(400).send({ error: scopeCheck.error });
      }
    }

    await queryDatabase(
      `
        UPDATE equipments
        SET
          name = COALESCE($1, name),
          status = COALESCE($2::entity_status, status),
          collection_interval = COALESCE($3, collection_interval),
          siren_active = COALESCE($4, siren_active),
          siren_time = COALESCE($5, siren_time),
          organization_id = COALESCE($6, organization_id),
          workspace_id = COALESCE($7, workspace_id),
          updated_at = NOW()
        WHERE id = $8 AND tenant_id = $9
      `,
      [
        name || null,
        status || null,
        collection_interval,
        siren_active,
        siren_time,
        organization_id,
        workspace_id,
        id,
        request.user.tenant_id,
      ]
    );
    await auditLog(request, 'update', 'equipment', id, { name, status, organization_id, workspace_id });
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/equipments/:id', {
    schema: {
      description: 'Remove equipamento do tenant',
      tags: ['Tenant'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await queryDatabase(
      `DELETE FROM equipments WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'delete', 'equipment', id, {});
    return reply.send({ status: 'ok' });
  });

  // Sensors
  fastify.post('/sensors', {
    schema: {
      description: 'Cria sensor no tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['uuid', 'name', 'type', 'equipment_id'],
        properties: {
          uuid: { type: 'string', description: 'Ex: 550e8400-e29b-41d4-a716-446655440001' },
          name: { type: 'string', description: 'Ex: Temperatura' },
          type: { type: 'string', description: 'Ex: temp' },
          unit: { type: 'string', description: 'Ex: C' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          equipment_id: { type: 'number', description: 'ID do equipamento' },
          organization_id: { type: 'number', minimum: 0, description: 'Ex: 1 (0 = todas)' },
          workspace_id: { type: 'number', minimum: 0, description: 'Ex: 10 (0 = todas)' },
          manufacturer: { type: 'string', description: 'Ex: Acme' },
          model: { type: 'string', description: 'Ex: T-1000' },
          firmware: { type: 'string', description: 'Ex: 1.0.0' },
          hardware_id: { type: 'string', description: 'Ex: HW-001' },
          via_hub: { type: 'boolean', description: 'Ex: false' },
        },
      },
      response: {
        201: { type: 'object', properties: { id: { type: 'number' } } },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const {
      uuid,
      name,
      type,
      unit,
      status = 'active',
      equipment_id,
      organization_id,
      workspace_id,
      manufacturer,
      model,
      firmware,
      hardware_id,
      via_hub = false,
    } = request.body || {};

    if (!uuid || !name || !type || !equipment_id) {
      return reply.code(400).send({ error: 'uuid, name, type e equipment_id são obrigatórios' });
    }
    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    const equipment = await queryDatabase(
      `SELECT id, organization_id, workspace_id FROM equipments WHERE id = $1 AND tenant_id = $2`,
      [equipment_id, request.user.tenant_id]
    );
    if (!equipment || equipment.length === 0) {
      return reply.code(404).send({ error: 'Equipamento não encontrado' });
    }
    const eqOrgId = equipment[0].organization_id;
    const eqWsId = equipment[0].workspace_id;
    const orgId = organization_id ?? eqOrgId;
    const wsId = workspace_id ?? eqWsId;
    if (organization_id !== undefined && organization_id !== null && Number(organization_id) !== Number(eqOrgId)) {
      return reply.code(400).send({ error: 'organization_id deve ser o mesmo do equipamento' });
    }
    if (workspace_id !== undefined && workspace_id !== null && Number(workspace_id) !== Number(eqWsId)) {
      return reply.code(400).send({ error: 'workspace_id deve ser o mesmo do equipamento' });
    }
    const scopeCheck = await validateOrgWorkspace(request.user.tenant_id, [Number(orgId)], [Number(wsId)]);
    if (!scopeCheck.ok) {
      return reply.code(400).send({ error: scopeCheck.error });
    }

    const result = await queryDatabase(
      `
        INSERT INTO sensors (
          uuid, name, type, unit, status,
          equipment_id, tenant_id, organization_id, workspace_id,
          manufacturer, model, firmware, hardware_id, via_hub,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5::entity_status,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          NOW(), NOW()
        )
        RETURNING id
      `,
      [
        uuid,
        name,
        type,
        unit || null,
        status,
        equipment_id,
        request.user.tenant_id,
        orgId,
        wsId,
        manufacturer || null,
        model || null,
        firmware || null,
        hardware_id || null,
        !!via_hub,
      ]
    );
    await auditLog(request, 'create', 'sensor', result[0]?.id, { uuid, name, type, status });
    return reply.code(201).send({ id: result[0]?.id });
  });

  fastify.get('/sensors', {
    schema: {
      description: 'Lista sensores do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
          equipment_id: { anyOf: [{ type: 'number' }, { type: 'string' }], description: 'Filtro por equipamento' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID do sensor' },
              uuid: { type: 'string', description: 'UUID do sensor' },
              name: { type: 'string', description: 'Nome do sensor' },
              type: { type: 'string', description: 'Tipo do sensor' },
              unit: { type: 'string', description: 'Unidade' },
              status: { type: 'string', description: 'Status' },
              equipment_id: { type: 'number', description: 'ID do equipamento' },
              tenant_id: { type: 'number', description: 'ID do tenant' },
              organization_id: { type: 'number', description: 'ID da organization' },
              workspace_id: { type: 'number', description: 'ID do workspace' },
              manufacturer: { type: 'string', description: 'Fabricante' },
              model: { type: 'string', description: 'Modelo' },
              firmware: { type: 'string', description: 'Firmware' },
              hardware_id: { type: 'string', description: 'Hardware ID' },
              via_hub: { type: 'boolean', description: 'Via hub' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds, workspaceIds } = resolveQueryScope(request);
    const equipmentId = parseIntOrNull(request.query?.equipment_id);
    const params = [];
    let query = 'SELECT * FROM sensors WHERE 1=1';
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND organization_id = ANY($${params.length}::int[])`;
    }
    if (workspaceIds && !workspaceIds.includes(0)) {
      params.push(workspaceIds);
      query += ` AND workspace_id = ANY($${params.length}::int[])`;
    }
    if (equipmentId !== null) {
      params.push(equipmentId);
      query += ` AND equipment_id = $${params.length}`;
    }
    query += ' ORDER BY id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/sensors/:id', {
    schema: {
      description: 'Atualiza sensor do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ex: Temperatura' },
          type: { type: 'string', description: 'Ex: temp' },
          unit: { type: 'string', description: 'Ex: C' },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          manufacturer: { type: 'string', description: 'Ex: Acme' },
          model: { type: 'string', description: 'Ex: T-1000' },
          firmware: { type: 'string', description: 'Ex: 1.0.0' },
          hardware_id: { type: 'string', description: 'Ex: HW-001' },
          via_hub: { type: 'boolean', description: 'Ex: false' },
        },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const payload = request.body || {};
    if (payload.status && !['active', 'inactive', 'blocked'].includes(payload.status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }
    await queryDatabase(
      `
        UPDATE sensors
        SET
          name = COALESCE($1, name),
          type = COALESCE($2, type),
          unit = COALESCE($3, unit),
          status = COALESCE($4::entity_status, status),
          manufacturer = COALESCE($5, manufacturer),
          model = COALESCE($6, model),
          firmware = COALESCE($7, firmware),
          hardware_id = COALESCE($8, hardware_id),
          via_hub = COALESCE($9, via_hub),
          updated_at = NOW()
        WHERE id = $10 AND tenant_id = $11
      `,
      [
        payload.name || null,
        payload.type || null,
        payload.unit || null,
        payload.status || null,
        payload.manufacturer || null,
        payload.model || null,
        payload.firmware || null,
        payload.hardware_id || null,
        payload.via_hub,
        id,
        request.user.tenant_id,
      ]
    );
    await auditLog(request, 'update', 'sensor', id, payload);
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/sensors/:id', {
    schema: {
      description: 'Remove sensor do tenant',
      tags: ['Tenant'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await queryDatabase(
      `DELETE FROM sensors WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'delete', 'sensor', id, {});
    return reply.send({ status: 'ok' });
  });

  // Alert rules
  fastify.post('/alerts', {
    schema: {
      description: 'Cria regra de alerta do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          organization_id: { type: 'number', description: 'Ex: 1 (0 = todas)' },
          workspace_ids: { type: 'array', items: { type: 'number' }, description: 'Ex: [10,11] (0 = todas)' },
          threshold_percent: { type: 'number', description: 'Ex: 80' },
          enabled: { type: 'boolean', description: 'Ex: true' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { organization_id = 0, workspace_ids = [0], threshold_percent = 80, enabled = true } = request.body || {};
    const result = await queryDatabase(
      `
        INSERT INTO tenant_alert_rules (tenant_id, organization_id, workspace_ids, threshold_percent, enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `,
      [request.user.tenant_id, organization_id, workspace_ids, threshold_percent, enabled]
    );
    await auditLog(request, 'create', 'alert_rule', result[0]?.id, { organization_id, workspace_ids, threshold_percent });
    return reply.code(201).send({ id: result[0]?.id });
  });

  fastify.get('/alerts', {
    schema: {
      description: 'Lista regras de alerta do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID da regra' },
              tenant_id: { type: 'number', description: 'ID do tenant' },
              organization_id: { type: 'number', description: 'ID da organization (0 = todas)' },
              workspace_ids: { type: 'array', items: { type: 'number' }, description: 'Workspaces (0 = todas)' },
              threshold_percent: { type: 'number', description: 'Percentual de alerta' },
              enabled: { type: 'boolean', description: 'Regra habilitada' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds, workspaceIds } = resolveQueryScope(request);
    const params = [];
    let query = 'SELECT * FROM tenant_alert_rules WHERE 1=1';
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND organization_id = ANY($${params.length}::int[])`;
    }
    if (workspaceIds && !workspaceIds.includes(0)) {
      params.push(workspaceIds);
      query += ` AND workspace_ids && $${params.length}::int[]`;
    }
    query += ' ORDER BY id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/alerts/:id', {
    schema: {
      description: 'Atualiza regra de alerta do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          organization_id: { type: 'number', description: 'Ex: 1 (0 = todas)' },
          workspace_ids: { type: 'array', items: { type: 'number' }, description: 'Ex: [10,11] (0 = todas)' },
          threshold_percent: { type: 'number', description: 'Ex: 90' },
          enabled: { type: 'boolean', description: 'Ex: true' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const payload = request.body || {};
    await queryDatabase(
      `
        UPDATE tenant_alert_rules
        SET
          organization_id = COALESCE($1, organization_id),
          workspace_ids = COALESCE($2, workspace_ids),
          threshold_percent = COALESCE($3, threshold_percent),
          enabled = COALESCE($4, enabled),
          updated_at = NOW()
        WHERE id = $5 AND tenant_id = $6
      `,
      [payload.organization_id, payload.workspace_ids, payload.threshold_percent, payload.enabled, id, request.user.tenant_id]
    );
    await auditLog(request, 'update', 'alert_rule', id, payload);
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/alerts/:id', {
    schema: {
      description: 'Remove regra de alerta do tenant',
      tags: ['Tenant'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await queryDatabase(
      `DELETE FROM tenant_alert_rules WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'delete', 'alert_rule', id, {});
    return reply.send({ status: 'ok' });
  });

  // Webhooks
  fastify.post('/webhooks', {
    schema: {
      description: 'Cria webhook do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          organization_id: { type: 'number', description: 'Ex: 1 (0 = todas)' },
          workspace_ids: { type: 'array', items: { type: 'number' }, description: 'Ex: [10,11] (0 = todas)' },
          event_types: { type: 'array', items: { type: 'string' }, description: 'Ex: ["quota_80","quota_90"]' },
          url: { type: 'string', description: 'Ex: https://hook.exemplo.com/alerts' },
          secret: { type: 'string', description: 'Ex: my-secret' },
          enabled: { type: 'boolean', description: 'Ex: true' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { organization_id = 0, workspace_ids = [0], event_types = ['quota_80','quota_90','quota_100'], url, secret, enabled = false } = request.body || {};
    const result = await queryDatabase(
      `
        INSERT INTO tenant_webhooks (tenant_id, organization_id, workspace_ids, event_types, url, secret, enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `,
      [request.user.tenant_id, organization_id, workspace_ids, event_types, url || null, secret || null, enabled]
    );
    await auditLog(request, 'create', 'webhook', result[0]?.id, { organization_id, workspace_ids, event_types, url });
    return reply.code(201).send({ id: result[0]?.id });
  });

  fastify.get('/webhooks', {
    schema: {
      description: 'Lista webhooks do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID do webhook' },
              tenant_id: { type: 'number', description: 'ID do tenant' },
              organization_id: { type: 'number', description: 'ID da organization (0 = todas)' },
              workspace_ids: { type: 'array', items: { type: 'number' }, description: 'Workspaces (0 = todas)' },
              event_types: { type: 'array', items: { type: 'string' }, description: 'Tipos de evento' },
              url: { type: 'string', description: 'URL do webhook' },
              secret: { type: 'string', description: 'Segredo HMAC' },
              enabled: { type: 'boolean', description: 'Webhook habilitado' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds, workspaceIds } = resolveQueryScope(request);
    const params = [];
    let query = 'SELECT * FROM tenant_webhooks WHERE 1=1';
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND organization_id = ANY($${params.length}::int[])`;
    }
    if (workspaceIds && !workspaceIds.includes(0)) {
      params.push(workspaceIds);
      query += ` AND workspace_ids && $${params.length}::int[]`;
    }
    query += ' ORDER BY id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/webhooks/:id', {
    schema: {
      description: 'Atualiza webhook do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          organization_id: { type: 'number', description: 'Ex: 1 (0 = todas)' },
          workspace_ids: { type: 'array', items: { type: 'number' }, description: 'Ex: [10,11] (0 = todas)' },
          event_types: { type: 'array', items: { type: 'string' }, description: 'Ex: ["quota_80","quota_90"]' },
          url: { type: 'string', description: 'Ex: https://hook.exemplo.com/alerts' },
          secret: { type: 'string', description: 'Ex: my-secret' },
          enabled: { type: 'boolean', description: 'Ex: false' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const payload = request.body || {};
    await queryDatabase(
      `
        UPDATE tenant_webhooks
        SET
          organization_id = COALESCE($1, organization_id),
          workspace_ids = COALESCE($2, workspace_ids),
          event_types = COALESCE($3, event_types),
          url = COALESCE($4, url),
          secret = COALESCE($5, secret),
          enabled = COALESCE($6, enabled),
          updated_at = NOW()
        WHERE id = $7 AND tenant_id = $8
      `,
      [
        payload.organization_id,
        payload.workspace_ids,
        payload.event_types,
        payload.url,
        payload.secret,
        payload.enabled,
        id,
        request.user.tenant_id,
      ]
    );
    await auditLog(request, 'update', 'webhook', id, payload);
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/webhooks/:id', {
    schema: {
      description: 'Remove webhook do tenant',
      tags: ['Tenant'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    await queryDatabase(
      `DELETE FROM tenant_webhooks WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'delete', 'webhook', id, {});
    return reply.send({ status: 'ok' });
  });

  // Users (Tenant)
  fastify.post('/users', {
    schema: {
      description: 'Cria usuário no tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          name: { type: 'string', description: 'Ex: João Silva' },
          username: { type: 'string', description: 'Ex: joao@empresa.com' },
          email: { type: 'string', description: 'Ex: joao@empresa.com' },
          password: { type: 'string', description: 'Ex: senha@123' },
          role: {
            oneOf: [
              { type: 'string', enum: ['admin', 'manager', 'viewer'], description: 'Ex: admin' },
              { type: 'array', items: { type: 'number' }, description: 'Ex: [0]' },
              { type: 'object', description: 'Ex: {"role":"viewer"}' },
            ],
          },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          organization_id: {
            anyOf: [
              { type: 'number', minimum: 0, description: 'Ex: 1 (0 = todas)' },
              { type: 'array', items: { type: 'number', minimum: 0 }, description: 'Ex: [1,2] (0 = todas)' }
            ]
          },
          workspace_id: {
            anyOf: [
              { type: 'number', minimum: 0, description: 'Ex: 10 (0 = todas)' },
              { type: 'array', items: { type: 'number', minimum: 0 }, description: 'Ex: [10,11] (0 = todas)' }
            ]
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const {
      name,
      username,
      email,
      password,
      role = 'viewer',
      status = 'active',
      organization_id,
      workspace_id,
      user_type = 'frontend',
    } = request.body || {};

    if (!username || !password) {
      return reply.code(400).send({ error: 'username e password são obrigatórios' });
    }

    const limits = await getTenantLimits(request.user.tenant_id);
    if (limits?.users_total) {
      const countResult = await queryDatabase(
        `
          SELECT COUNT(*)::int AS total
          FROM users
          WHERE tenant_id = $1 AND status <> 'inactive'
        `,
        [request.user.tenant_id]
      );
      const total = countResult[0]?.total || 0;
      if (limitReached(limits.users_total, total)) {
        return reply.code(403).send({ error: 'Limite de usuários do plano atingido' });
      }
    }

    const orgIds = normalizeScopeArray(organization_id);
    const wsIds = normalizeScopeArray(workspace_id);
    const scopeCheck = await validateOrgWorkspace(request.user.tenant_id, orgIds, wsIds);
    if (!scopeCheck.ok) {
      return reply.code(400).send({ error: scopeCheck.error });
    }

    const rolePayload = normalizeRolePayload(role);
    if (hasSuperRole(rolePayload)) {
      return reply.code(403).send({ error: 'Role reservado ao master admin' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await queryDatabase(
      `
        INSERT INTO users (
          name, username, email, hashed_password,
          tenant_id, organization_id, workspace_id,
          role, user_type, status,
          failed_login_attempts, locked_until,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8::jsonb, $9, $10,
          0, NULL,
          NOW(), NOW()
        )
        RETURNING id
      `,
      [name || null, username, email || null, hashed, request.user.tenant_id, orgIds, wsIds, JSON.stringify(rolePayload), user_type, status]
    );
    await auditLog(request, 'create', 'user', result[0]?.id, { username, role: rolePayload, status, user_type });
    return reply.code(201).send({ id: result[0]?.id });
  });

  // Dashboard: limites efetivos do tenant (plano + overrides)
  fastify.get('/limits', {
    schema: {
      description: 'Limites efetivos do tenant (plano + overrides)',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
        },
      },
    },
  }, async (request, reply) => {
    const { tenantIds } = resolveQueryScope(request);
    if (!tenantIds || tenantIds.length === 0) {
      return reply.code(400).send({ error: 'tenant_id é obrigatório para limits' });
    }
    if (tenantIds.length > 1) {
      return reply.code(400).send({ error: 'tenant_id deve ser um único valor para limits' });
    }
    const tenantId = tenantIds[0];
    const limits = await getTenantLimits(tenantId);
    if (!limits) {
      return reply.code(404).send({ error: 'Tenant não encontrado' });
    }
    return reply.send(limits);
  });

  // Dashboard: uso diário (tenant ou por org/workspace)
  fastify.get('/usage/daily', {
    schema: {
      description: 'Uso diário do tenant (ou por org/workspace)',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
          days: { type: 'number', minimum: 1, maximum: 365 },
        },
      },
    },
  }, async (request, reply) => {
    const { days = 30, organization_id = 0, workspace_id = 0 } = request.query || {};
    const parsedDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
    const orgId = parseInt(organization_id, 10) || 0;
    const wsId = parseInt(workspace_id, 10) || 0;
    const { tenantIds } = resolveQueryScope(request);

    if (orgId === 0 && wsId === 0) {
      const params = [];
      let query = `
        SELECT day, items_count, sensors_count, bytes_ingested
        FROM tenant_usage_daily
        WHERE 1=1
      `;
      if (tenantIds && !tenantIds.includes(0)) {
        params.push(tenantIds);
        query += ` AND tenant_id = ANY($${params.length}::int[])`;
      }
      params.push(parsedDays);
      query += ` AND day >= CURRENT_DATE - ($${params.length}::int * INTERVAL '1 day')`;
      query += ' ORDER BY day ASC';
      const result = await queryDatabase(query, params);
      return reply.send(result);
    }

    const params = [];
    let query = `
      SELECT
        day,
        SUM(items_count) AS items_count,
        SUM(sensors_count) AS sensors_count,
        SUM(bytes_ingested) AS bytes_ingested
      FROM tenant_usage_daily_scoped
      WHERE 1=1
    `;
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    params.push(orgId);
    query += ` AND ($${params.length}::int = 0 OR organization_id = $${params.length})`;
    params.push(wsId);
    query += ` AND ($${params.length}::int = 0 OR workspace_id = $${params.length})`;
    params.push(parsedDays);
    query += ` AND day >= CURRENT_DATE - ($${params.length}::int * INTERVAL '1 day')`;
    query += ' GROUP BY day ORDER BY day ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  // Dashboard: alertas recentes
  fastify.get('/alerts/history', {
    schema: {
      description: 'Alertas recentes do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
          limit: { type: 'number', minimum: 1, maximum: 500 },
        },
      },
    },
  }, async (request, reply) => {
    const { limit = 50, organization_id = 0, workspace_id = 0 } = request.query || {};
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const orgId = parseInt(organization_id, 10) || 0;
    const wsId = parseInt(workspace_id, 10) || 0;
    const { tenantIds } = resolveQueryScope(request);

    const params = [];
    let query = `
      SELECT id, tenant_id, organization_id, workspace_id, alert_type, day, message, metadata, created_at, resolved_at
      FROM tenant_alerts
      WHERE 1=1
    `;
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    params.push(orgId);
    query += ` AND ($${params.length}::int = 0 OR organization_id = $${params.length})`;
    params.push(wsId);
    query += ` AND ($${params.length}::int = 0 OR workspace_id = $${params.length})`;
    params.push(parsedLimit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.get('/users', {
    schema: {
      description: 'Lista usuários do tenant',
      tags: ['Tenant'],
      querystring: {
        type: 'object',
        properties: {
          tenant_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por tenant (super admin)' },
          organization_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por organization' },
          workspace_id: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }, { type: 'array', items: { type: 'number' } }], description: 'Filtro por workspace' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'ID do usuário' },
              name: { type: 'string', description: 'Nome' },
              username: { type: 'string', description: 'Username' },
              email: { type: 'string', description: 'E-mail' },
              role: {
                anyOf: [
                  { type: 'object' },
                  { type: 'array', items: { type: 'number' } },
                  { type: 'array', items: { type: 'string' } },
                  { type: 'string' }
                ],
                description: 'Role/permissions'
              },
              status: { type: 'string', description: 'Status do usuário' },
              user_type: { type: 'string', description: 'Tipo de usuário' },
              organization_id: { type: 'array', items: { type: 'number' }, description: 'Organizations' },
              workspace_id: { type: 'array', items: { type: 'number' }, description: 'Workspaces' },
              created_at: { type: 'string', description: 'Data de criação (ISO)' },
              updated_at: { type: 'string', description: 'Data de atualização (ISO)' },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { tenantIds, organizationIds, workspaceIds } = resolveQueryScope(request);
    const params = [];
    let query = `
      SELECT id, name, username, email, role, status, user_type, organization_id, workspace_id, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    if (tenantIds && !tenantIds.includes(0)) {
      params.push(tenantIds);
      query += ` AND tenant_id = ANY($${params.length}::int[])`;
    }
    if (organizationIds && !organizationIds.includes(0)) {
      params.push(organizationIds);
      query += ` AND organization_id && $${params.length}::int[]`;
    }
    if (workspaceIds && !workspaceIds.includes(0)) {
      params.push(workspaceIds);
      query += ` AND workspace_id && $${params.length}::int[]`;
    }
    query += ' ORDER BY id ASC';
    const result = await queryDatabase(query, params);
    return reply.send(result);
  });

  fastify.put('/users/:id', {
    schema: {
      description: 'Atualiza usuário do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ex: Joao Silva' },
          email: { type: 'string', description: 'Ex: joao@empresa.com' },
          role: {
            oneOf: [
              { type: 'string', enum: ['admin', 'manager', 'viewer'], description: 'Ex: manager' },
              { type: 'array', items: { type: 'number' }, description: 'Ex: [0]' },
              { type: 'object', description: 'Ex: {"role":"viewer"}' },
            ],
          },
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: active' },
          organization_id: {
            anyOf: [
              { type: 'number', minimum: 0, description: 'Ex: 1 (0 = todas)' },
              { type: 'array', items: { type: 'number', minimum: 0 }, description: 'Ex: [1,2] (0 = todas)' }
            ]
          },
          workspace_id: {
            anyOf: [
              { type: 'number', minimum: 0, description: 'Ex: 10 (0 = todas)' },
              { type: 'array', items: { type: 'number', minimum: 0 }, description: 'Ex: [10,11] (0 = todas)' }
            ]
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      email,
      role,
      status,
      organization_id,
      workspace_id,
      user_type,
    } = request.body || {};

    const targetUser = await queryDatabase(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    if (!targetUser || targetUser.length === 0) {
      return reply.code(404).send({ error: 'Usuário não encontrado' });
    }
    const actorRole = getRoleName(request.user?.role);
    const targetRole = getRoleName(targetUser[0].role);
    if (actorRole === 'manager' && targetRole === 'admin') {
      return reply.code(403).send({ error: 'Manager não pode alterar admin' });
    }

    if (status && !['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }

    const orgIds = normalizeScopeArray(organization_id);
    const wsIds = normalizeScopeArray(workspace_id);
    const scopeCheck = await validateOrgWorkspace(request.user.tenant_id, orgIds, wsIds);
    if (!scopeCheck.ok) {
      return reply.code(400).send({ error: scopeCheck.error });
    }

    const rolePayload = role ? normalizeRolePayload(role) : null;
    if (rolePayload && hasSuperRole(rolePayload)) {
      return reply.code(403).send({ error: 'Role reservado ao master admin' });
    }
    await queryDatabase(
      `
        UPDATE users
        SET
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3::jsonb, role),
          status = COALESCE($4, status),
          organization_id = COALESCE($5, organization_id),
          workspace_id = COALESCE($6, workspace_id),
          user_type = COALESCE($7, user_type),
          updated_at = NOW()
        WHERE id = $8 AND tenant_id = $9
      `,
      [name || null, email || null, rolePayload ? JSON.stringify(rolePayload) : null, status || null, orgIds, wsIds, user_type || null, id, request.user.tenant_id]
    );
    await auditLog(request, 'update', 'user', id, { name, email, role: rolePayload || role, status, user_type });
    return reply.send({ status: 'ok' });
  });

  fastify.patch('/users/:id/password', {
    schema: {
      description: 'Atualiza senha do usuário do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', description: 'Ex: novaSenha@123' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { password } = request.body || {};
    if (!password) {
      return reply.code(400).send({ error: 'password é obrigatório' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await queryDatabase(
      `UPDATE users SET hashed_password = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [hashed, id, request.user.tenant_id]
    );
    await auditLog(request, 'update_password', 'user', id, {});
    return reply.send({ status: 'ok' });
  });

  fastify.patch('/users/:id/status', {
    schema: {
      description: 'Atualiza status do usuário do tenant',
      tags: ['Tenant'],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['active', 'inactive', 'blocked'], description: 'Ex: inactive' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { status } = request.body || {};
    if (!status) {
      return reply.code(400).send({ error: 'status é obrigatório' });
    }
    if (!['active', 'inactive', 'blocked'].includes(status)) {
      return reply.code(400).send({ error: 'status inválido. Use: active, inactive, blocked' });
    }

    const targetUser = await queryDatabase(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    if (!targetUser || targetUser.length === 0) {
      return reply.code(404).send({ error: 'Usuário não encontrado' });
    }
    if (Number(id) === Number(request.user?.user_id)) {
      return reply.code(400).send({ error: 'Você não pode alterar o próprio status' });
    }
    const actorRole = getRoleName(request.user?.role);
    const targetRole = getRoleName(targetUser[0].role);
    if (actorRole === 'manager' && targetRole === 'admin') {
      return reply.code(403).send({ error: 'Manager não pode alterar admin' });
    }

    await queryDatabase(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [status, id, request.user.tenant_id]
    );
    await auditLog(request, 'update_status', 'user', id, { status });
    return reply.send({ status: 'ok' });
  });

  fastify.delete('/users/:id', {
    schema: {
      description: 'Remove (soft delete) usuário do tenant',
      tags: ['Tenant'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { status: { type: 'string' } } },
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    if (Number(id) === Number(request.user?.user_id)) {
      return reply.code(400).send({ error: 'Você não pode excluir o próprio usuário' });
    }
    const targetUser = await queryDatabase(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    if (!targetUser || targetUser.length === 0) {
      return reply.code(404).send({ error: 'Usuário não encontrado' });
    }
    const actorRole = getRoleName(request.user?.role);
    const targetRole = getRoleName(targetUser[0].role);
    if (actorRole === 'manager' && targetRole === 'admin') {
      return reply.code(403).send({ error: 'Manager não pode excluir admin' });
    }
    await queryDatabase(
      `UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, request.user.tenant_id]
    );
    await auditLog(request, 'soft_delete', 'user', id, { status: 'inactive' });
    return reply.send({ status: 'ok' });
  });
};
