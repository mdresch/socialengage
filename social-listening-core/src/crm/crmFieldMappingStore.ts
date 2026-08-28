import { withTenant } from '../db/withTenant';

export interface CRMFieldMappingRow {
  id: string;
  tenantId: string;
  crmConnectorId: string;
  entityType: 'lead' | 'opportunity' | 'support';
  sourceField: string;
  targetField: string;
  isRequired: boolean;
  defaultValue: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawCRMFieldMappingRow {
  id: string;
  tenant_id: string;
  crm_connector_id: string;
  entity_type: 'lead' | 'opportunity' | 'support';
  source_field: string;
  target_field: string;
  is_required: boolean;
  default_value: string | null;
  created_at: Date;
  updated_at: Date;
}

function toCamel(row: RawCRMFieldMappingRow): CRMFieldMappingRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    crmConnectorId: row.crm_connector_id,
    entityType: row.entity_type,
    sourceField: row.source_field,
    targetField: row.target_field,
    isRequired: row.is_required,
    defaultValue: row.default_value,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listFieldMappings(
  tenantId: string,
  crmConnectorId?: string,
  entityType?: string
): Promise<CRMFieldMappingRow[]> {
  return withTenant(tenantId, async (client) => {
    const conditions = ['1=1'];
    const params: any[] = [];

    if (crmConnectorId) {
      params.push(crmConnectorId);
      conditions.push(`crm_connector_id = $${params.length}`);
    }

    if (entityType) {
      params.push(entityType);
      conditions.push(`entity_type = $${params.length}`);
    }

    const { rows } = await client.query<RawCRMFieldMappingRow>(
      `SELECT * FROM crm_field_mappings
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ASC`,
      params
    );
    return rows.map(toCamel);
  });
}

export async function upsertFieldMapping(
  tenantId: string,
  input: {
    crmConnectorId: string;
    entityType: 'lead' | 'opportunity' | 'support';
    sourceField: string;
    targetField: string;
    isRequired?: boolean;
    defaultValue?: string | null;
  }
): Promise<CRMFieldMappingRow> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawCRMFieldMappingRow>(
      `INSERT INTO crm_field_mappings
         (tenant_id, crm_connector_id, entity_type, source_field, target_field, is_required, default_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, crm_connector_id, entity_type, source_field)
       DO UPDATE SET
         target_field = EXCLUDED.target_field,
         is_required = EXCLUDED.is_required,
         default_value = EXCLUDED.default_value,
         updated_at = now()
       RETURNING *`,
      [
        tenantId,
        input.crmConnectorId,
        input.entityType,
        input.sourceField,
        input.targetField,
        input.isRequired ?? false,
        input.defaultValue ?? null,
      ]
    );
    return toCamel(rows[0]);
  });
}

export async function deleteFieldMapping(tenantId: string, id: string): Promise<boolean> {
  return withTenant(tenantId, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM crm_field_mappings WHERE id = $1`,
      [id]
    );
    return (rowCount ?? 0) > 0;
  });
}
