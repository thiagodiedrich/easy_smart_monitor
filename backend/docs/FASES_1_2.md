# Fases da Evolução Multi-Tenant (1.2.x)

Este documento resume as fases executadas para transformar o backend em um SaaS multi-tenant.

---

## 1.2.0 — Fase 0 (Base Multi-Tenant)
- Tabelas SaaS base: `tenants`, `organizations`, `workspaces`
- Contexto multi-tenant opcional (Gateway/Workers)
- Migração: `006_tenant_organization_workspace`

## 1.2.1 — Fase 1 (Tenant nos usuários e equipamentos)
- `tenant_id` em `users` e `equipments`
- JWT passa a carregar `tenant_id`
- Backfill para tenant legado
- Migração: `007_tenant_id_users_equipments`

## 1.2.2 — Fase 2 (Org/Workspace em equipamentos)
- `organization_id` e `workspace_id` em `equipments`
- Propagação de contexto na ingestão (Kafka)
- Migração: `008_org_workspace_in_equipments`

## 1.2.3 — Fase 3 (Isolamento + enforcement)
- Filtros por tenant/org/workspace nos analytics
- Rate limit por tenant
- Enforcement controlado por flags

## 1.2.4 — Fase 4 (Observabilidade / Billing-ready)
- Uso diário por tenant
- Metadados de ingestão (itens/sensores/bytes)
- Migração: `009_tenant_usage_daily`

## 1.2.5 — Fase 5 (Planos e Quotas)
- Tabelas `plans` e `tenant_limits`
- Enforcement de quotas na ingestão
- Migração: `010_plans_and_limits`

## 1.2.6 — Fase 6 (Admin global + eventos billing)
- Bootstrap do usuário master (`tenant_id=0`)
- `organization_id`/`workspace_id` em `users`
- Eventos de billing por tenant
- Migrações: `011_tenant_billing_events`, `012_org_workspace_in_users`

## 1.2.7 — Fase 7 (Alertas + Webhooks)
- Alertas globais e por tenant/org/workspace (80/90/100)
- Webhooks globais e por tenant
- Cron configurável e atraso por plano/tenant
- Uso diário por org/workspace
- Migrações: `013_tenant_usage_daily_scoped`, `014_alerting_tables`, `015_alert_delay_seconds`

---

Para detalhes técnicos, consulte:
- `docs/ARCHITECTURE.md`
- `docs/API_ANALYTICS.md`
- `docs/SECURITY.md`
