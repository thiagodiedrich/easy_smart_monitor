/**
 * Plugin de contexto multi-tenant (Fase 0).
 *
 * - Extrai tenant/org/workspace do JWT (se existir) ou de headers.
 * - Não quebra requests quando multi-tenant estiver desativado.
 * - Enforcement é opcional via MULTI_TENANT_ENFORCE.
 */
import fp from 'fastify-plugin';
import config from '../config.js';

function buildTenantContext(request) {
  const jwtClaims = request.user || {};
  const headers = request.headers || {};

  const tenantId = jwtClaims.tenant_id || headers[config.multiTenant.tenantHeader];
  const organizationId = jwtClaims.organization_id || headers[config.multiTenant.organizationHeader];
  const workspaceId = jwtClaims.workspace_id || headers[config.multiTenant.workspaceHeader];

  return {
    tenantId: tenantId || null,
    organizationId: organizationId || null,
    workspaceId: workspaceId || null,
  };
}

async function tenantContextPlugin(fastify) {
  fastify.decorateRequest('tenantContext', null);

  fastify.addHook('preHandler', async (request, reply) => {
    if (!config.multiTenant.enabled) {
      return;
    }

    const context = buildTenantContext(request);
    request.tenantContext = context;

    if (config.multiTenant.enforce && !context.tenantId) {
      reply.code(401).send({
        error: 'TENANT_REQUIRED',
        message: 'Tenant não informado',
      });
    }
  });
}

export default fp(tenantContextPlugin);
