"""Generated data model. Edit here to evolve the schema."""
ENTITIES = {
  "purchaseorder": {
    "name": "PurchaseOrder",
    "columns": [
      {
        "name": "po_number",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "supplier_name",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "contract_reference",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "total_value",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "currency",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "approval_status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "approval_grain",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "created_date",
        "type": "date",
        "sqlite": "TEXT"
      },
      {
        "name": "source_system",
        "type": "enum",
        "sqlite": "TEXT"
      }
    ]
  },
  "poline": {
    "name": "POLine",
    "columns": [
      {
        "name": "po_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "line_number",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "description",
        "type": "text",
        "sqlite": "TEXT"
      },
      {
        "name": "quantity",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "unit_price",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "line_total",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "wbs_element",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "activity_type",
        "type": "string",
        "sqlite": "TEXT"
      }
    ]
  },
  "supplierschedule": {
    "name": "SupplierSchedule",
    "columns": [
      {
        "name": "po_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "submission_date",
        "type": "date",
        "sqlite": "TEXT"
      },
      {
        "name": "period",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "total_submitted",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "validation_status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "source",
        "type": "enum",
        "sqlite": "TEXT"
      }
    ]
  },
  "supplierscheduleline": {
    "name": "SupplierScheduleLine",
    "columns": [
      {
        "name": "schedule_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "wbs_element",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "site",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "activity_type",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "intervention_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "cost_category",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "quantity",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "unit",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "rate",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "amount",
        "type": "number",
        "sqlite": "REAL"
      }
    ]
  },
  "financialtransaction": {
    "name": "FinancialTransaction",
    "columns": [
      {
        "name": "transaction_id",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "posting_date",
        "type": "date",
        "sqlite": "TEXT"
      },
      {
        "name": "period",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "wbs_element",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "cost_element",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "amount",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "currency",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "source_system",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "document_number",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "reconciliation_status",
        "type": "enum",
        "sqlite": "TEXT"
      }
    ]
  },
  "wbs": {
    "name": "WBS",
    "columns": [
      {
        "name": "wbs_code",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "description",
        "type": "text",
        "sqlite": "TEXT"
      },
      {
        "name": "project_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "site",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "investment_reference",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "intervention_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "created_date",
        "type": "date",
        "sqlite": "TEXT"
      }
    ]
  },
  "intervention": {
    "name": "Intervention",
    "columns": [
      {
        "name": "intervention_code",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "description",
        "type": "text",
        "sqlite": "TEXT"
      },
      {
        "name": "asset_type",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "regulatory_category",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "planned_cost",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "actual_cost",
        "type": "number",
        "sqlite": "REAL"
      }
    ]
  },
  "investment": {
    "name": "Investment",
    "columns": [
      {
        "name": "investment_reference",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "regulatory_driver",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "description",
        "type": "text",
        "sqlite": "TEXT"
      },
      {
        "name": "planned_amount",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "committed_amount",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "actual_spend",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "submission_date",
        "type": "date",
        "sqlite": "TEXT"
      }
    ]
  },
  "project": {
    "name": "Project",
    "columns": [
      {
        "name": "project_code",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "name",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "manager",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "budget",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "forecast",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "actual_cost",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "investment_id",
        "type": "id",
        "sqlite": "TEXT"
      }
    ]
  },
  "exception": {
    "name": "Exception",
    "columns": [
      {
        "name": "exception_type",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "severity",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "description",
        "type": "text",
        "sqlite": "TEXT"
      },
      {
        "name": "detected_date",
        "type": "date",
        "sqlite": "TEXT"
      },
      {
        "name": "status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "assigned_to",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "related_entity_type",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "related_entity_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "resolution_notes",
        "type": "text",
        "sqlite": "TEXT"
      }
    ]
  },
  "reconciliationitem": {
    "name": "ReconciliationItem",
    "columns": [
      {
        "name": "po_line_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "supplier_schedule_line_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "financial_transaction_id",
        "type": "id",
        "sqlite": "TEXT"
      },
      {
        "name": "match_confidence",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "variance_amount",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "reconciliation_status",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "reconciled_by",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "reconciled_date",
        "type": "date",
        "sqlite": "TEXT"
      }
    ]
  },
  "forecast": {
    "name": "Forecast",
    "columns": [
      {
        "name": "wbs_element",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "period",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "forecast_type",
        "type": "enum",
        "sqlite": "TEXT"
      },
      {
        "name": "amount",
        "type": "number",
        "sqlite": "REAL"
      },
      {
        "name": "version",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "as_at_date",
        "type": "date",
        "sqlite": "TEXT"
      },
      {
        "name": "preparer",
        "type": "string",
        "sqlite": "TEXT"
      },
      {
        "name": "approval_status",
        "type": "enum",
        "sqlite": "TEXT"
      }
    ]
  }
}

ROLES = ["admin", "manager", "employee", "viewer"]
WRITE_ROLES = ["admin", "manager", "employee"]
DELETE_ROLES = ["admin"]
