"""Generated seed data + a default admin user (capability 10)."""
import datetime, uuid

from . import auth, db

SEED = {
  "purchaseorder": [
    {
      "po_number": "4500123456",
      "supplier_name": "AquaTech Engineering Ltd",
      "contract_reference": "CT-2025-WAT-001",
      "total_value": 485000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "contract_level",
      "created_date": "2026-01-15",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123457",
      "supplier_name": "Pipeline Solutions UK",
      "contract_reference": "CT-2025-WAT-002",
      "total_value": 620000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "contract_level",
      "created_date": "2026-01-22",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123458",
      "supplier_name": "Northern Construction Group",
      "contract_reference": "CT-2026-INF-015",
      "total_value": 1250000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "project_level",
      "created_date": "2026-02-10",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123459",
      "supplier_name": "Meter Install Services",
      "contract_reference": "CT-2026-MTR-008",
      "total_value": 340000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "wbs_level",
      "created_date": "2026-02-18",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123460",
      "supplier_name": "WaterWorks Civils Ltd",
      "contract_reference": "CT-2025-WAT-003",
      "total_value": 892000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "contract_level",
      "created_date": "2026-03-05",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123461",
      "supplier_name": "Thames Engineering Partners",
      "contract_reference": "CT-2026-WW-012",
      "total_value": 765000,
      "currency": "GBP",
      "approval_status": "pending",
      "approval_grain": "project_level",
      "created_date": "2026-03-20",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123462",
      "supplier_name": "Gas Infrastructure Ltd",
      "contract_reference": "CT-2026-GAS-004",
      "total_value": 420000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "contract_level",
      "created_date": "2026-04-02",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123463",
      "supplier_name": "AquaTech Engineering Ltd",
      "contract_reference": "CT-2026-WAT-009",
      "total_value": 595000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "contract_level",
      "created_date": "2026-04-15",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123464",
      "supplier_name": "Regulatory Compliance Solutions",
      "contract_reference": "CT-2026-REG-001",
      "total_value": 125000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "wbs_level",
      "created_date": "2026-05-01",
      "source_system": "COUPA"
    },
    {
      "po_number": "4500123465",
      "supplier_name": "Northern Construction Group",
      "contract_reference": "CT-2026-INF-016",
      "total_value": 980000,
      "currency": "GBP",
      "approval_status": "approved",
      "approval_grain": "project_level",
      "created_date": "2026-05-12",
      "source_system": "COUPA"
    }
  ],
  "poline": [
    {
      "po_id": "PO-5001",
      "line_number": 10,
      "description": "Water main rehabilitation - design, materials and installation",
      "quantity": 1,
      "unit_price": 285000,
      "line_total": 285000,
      "wbs_element": "WBS-PRJ001-01",
      "activity_type": "Pipe Laying"
    },
    {
      "po_id": "PO-5001",
      "line_number": 20,
      "description": "Site restoration and reinstatement works",
      "quantity": 1,
      "unit_price": 200000,
      "line_total": 200000,
      "wbs_element": "WBS-PRJ001-02",
      "activity_type": "Site Restoration"
    },
    {
      "po_id": "PO-5002",
      "line_number": 10,
      "description": "Trunk main replacement programme - Phase 1",
      "quantity": 1,
      "unit_price": 380000,
      "line_total": 380000,
      "wbs_element": "WBS-PRJ001-03",
      "activity_type": "Pipe Laying"
    },
    {
      "po_id": "PO-5002",
      "line_number": 20,
      "description": "Pressure testing and commissioning",
      "quantity": 1,
      "unit_price": 240000,
      "line_total": 240000,
      "wbs_element": "WBS-PRJ001-03",
      "activity_type": "Testing & Commissioning"
    },
    {
      "po_id": "PO-5003",
      "line_number": 10,
      "description": "Wastewater treatment works upgrade - civils and MEP",
      "quantity": 1,
      "unit_price": 1250000,
      "line_total": 1250000,
      "wbs_element": "WBS-PRJ002-01",
      "activity_type": "Civil Works"
    },
    {
      "po_id": "PO-5004",
      "line_number": 10,
      "description": "Smart meter installation programme",
      "quantity": 1,
      "unit_price": 340000,
      "line_total": 340000,
      "wbs_element": "WBS-PRJ003-01",
      "activity_type": "Meter Installation"
    },
    {
      "po_id": "PO-5005",
      "line_number": 10,
      "description": "Pumping station construction and equipment",
      "quantity": 1,
      "unit_price": 542000,
      "line_total": 542000,
      "wbs_element": "WBS-PRJ002-02",
      "activity_type": "Mechanical Installation"
    },
    {
      "po_id": "PO-5005",
      "line_number": 20,
      "description": "Electrical control systems and SCADA integration",
      "quantity": 1,
      "unit_price": 350000,
      "line_total": 350000,
      "wbs_element": "WBS-PRJ002-02",
      "activity_type": "Electrical Installation"
    },
    {
      "po_id": "PO-5006",
      "line_number": 10,
      "description": "Sewer network rehabilitation and renewal",
      "quantity": 1,
      "unit_price": 765000,
      "line_total": 765000,
      "wbs_element": "WBS-PRJ003-02",
      "activity_type": "Sewer Rehabilitation"
    },
    {
      "po_id": "PO-5007",
      "line_number": 10,
      "description": "Gas mains replacement - polyethylene pipe installation",
      "quantity": 1,
      "unit_price": 420000,
      "line_total": 420000,
      "wbs_element": "WBS-PRJ004-01",
      "activity_type": "Pipe Laying"
    },
    {
      "po_id": "PO-5008",
      "line_number": 10,
      "description": "Reservoir cleaning, inspection and coating",
      "quantity": 1,
      "unit_price": 595000,
      "line_total": 595000,
      "wbs_element": "WBS-PRJ001-01",
      "activity_type": "Asset Maintenance"
    },
    {
      "po_id": "PO-5009",
      "line_number": 10,
      "description": "Regulatory compliance assessment and documentation",
      "quantity": 1,
      "unit_price": 125000,
      "line_total": 125000,
      "wbs_element": "WBS-PRJ003-01",
      "activity_type": "Project Management"
    }
  ],
  "supplierschedule": [
    {
      "po_id": "PO-5001",
      "submission_date": "2026-02-28",
      "period": "2026-02",
      "total_submitted": 161850,
      "validation_status": "approved",
      "source": "FastDraft"
    },
    {
      "po_id": "PO-5002",
      "submission_date": "2026-03-15",
      "period": "2026-03",
      "total_submitted": 11680,
      "validation_status": "approved",
      "source": "FastDraft"
    },
    {
      "po_id": "PO-5003",
      "submission_date": "2026-03-31",
      "period": "2026-03",
      "total_submitted": 91780,
      "validation_status": "approved",
      "source": "FastDraft"
    },
    {
      "po_id": "PO-5005",
      "submission_date": "2026-04-30",
      "period": "2026-04",
      "total_submitted": 65120,
      "validation_status": "approved",
      "source": "FastDraft"
    },
    {
      "po_id": "PO-5004",
      "submission_date": "2026-05-15",
      "period": "2026-05",
      "total_submitted": 44160,
      "validation_status": "pending",
      "source": "APS"
    },
    {
      "po_id": "PO-5007",
      "submission_date": "2026-05-31",
      "period": "2026-05",
      "total_submitted": 174000,
      "validation_status": "approved",
      "source": "FastDraft"
    },
    {
      "po_id": "PO-5008",
      "submission_date": "2026-06-15",
      "period": "2026-06",
      "total_submitted": 178500,
      "validation_status": "approved",
      "source": "FastDraft"
    },
    {
      "po_id": "PO-5006",
      "submission_date": "2026-06-20",
      "period": "2026-06",
      "total_submitted": 229500,
      "validation_status": "pending",
      "source": "FastDraft"
    }
  ],
  "supplierscheduleline": [
    {
      "schedule_id": "SS-2026-01",
      "wbs_element": "PRJ001.WBS.001",
      "site": "Manchester North",
      "activity_type": "Excavation",
      "intervention_id": "INT-W-2601",
      "cost_category": "Labour",
      "quantity": 320,
      "unit": "Hours",
      "rate": 65.0,
      "amount": 20800.0
    },
    {
      "schedule_id": "SS-2026-01",
      "wbs_element": "PRJ001.WBS.001",
      "site": "Manchester North",
      "activity_type": "Pipe Installation",
      "intervention_id": "INT-W-2601",
      "cost_category": "Labour",
      "quantity": 480,
      "unit": "Hours",
      "rate": 72.5,
      "amount": 34800.0
    },
    {
      "schedule_id": "SS-2026-01",
      "wbs_element": "PRJ001.WBS.001",
      "site": "Manchester North",
      "activity_type": "Materials Supply",
      "intervention_id": "INT-W-2601",
      "cost_category": "Materials",
      "quantity": 850,
      "unit": "Metres",
      "rate": 125.0,
      "amount": 106250.0
    },
    {
      "schedule_id": "SS-2026-02",
      "wbs_element": "PRJ001.WBS.002",
      "site": "Manchester North",
      "activity_type": "Quality Testing",
      "intervention_id": "INT-W-2601",
      "cost_category": "Inspection",
      "quantity": 96,
      "unit": "Hours",
      "rate": 85.0,
      "amount": 8160.0
    },
    {
      "schedule_id": "SS-2026-02",
      "wbs_element": "PRJ001.WBS.002",
      "site": "Manchester North",
      "activity_type": "Documentation",
      "intervention_id": "INT-W-2601",
      "cost_category": "Administration",
      "quantity": 64,
      "unit": "Hours",
      "rate": 55.0,
      "amount": 3520.0
    },
    {
      "schedule_id": "SS-2026-03",
      "wbs_element": "PRJ002.WBS.001",
      "site": "Birmingham Central",
      "activity_type": "Concrete Works",
      "intervention_id": "INT-WW-2604",
      "cost_category": "Labour",
      "quantity": 560,
      "unit": "Hours",
      "rate": 68.0,
      "amount": 38080.0
    },
    {
      "schedule_id": "SS-2026-03",
      "wbs_element": "PRJ002.WBS.001",
      "site": "Birmingham Central",
      "activity_type": "Formwork",
      "intervention_id": "INT-WW-2604",
      "cost_category": "Labour",
      "quantity": 240,
      "unit": "Hours",
      "rate": 62.5,
      "amount": 15000.0
    },
    {
      "schedule_id": "SS-2026-03",
      "wbs_element": "PRJ002.WBS.001",
      "site": "Birmingham Central",
      "activity_type": "Materials Supply",
      "intervention_id": "INT-WW-2604",
      "cost_category": "Materials",
      "quantity": 180,
      "unit": "Cubic Metres",
      "rate": 215.0,
      "amount": 38700.0
    },
    {
      "schedule_id": "SS-2026-04",
      "wbs_element": "PRJ002.WBS.002",
      "site": "Birmingham Central",
      "activity_type": "Equipment Installation",
      "intervention_id": "INT-WW-2604",
      "cost_category": "Labour",
      "quantity": 640,
      "unit": "Hours",
      "rate": 78.0,
      "amount": 49920.0
    },
    {
      "schedule_id": "SS-2026-04",
      "wbs_element": "PRJ002.WBS.002",
      "site": "Birmingham Central",
      "activity_type": "Commissioning",
      "intervention_id": "INT-WW-2604",
      "cost_category": "Specialist Services",
      "quantity": 160,
      "unit": "Hours",
      "rate": 95.0,
      "amount": 15200.0
    },
    {
      "schedule_id": "SS-2026-05",
      "wbs_element": "PRJ003.WBS.001",
      "site": "Leeds West",
      "activity_type": "Leak Survey",
      "intervention_id": "INT-W-2603",
      "cost_category": "Specialist Services",
      "quantity": 480,
      "unit": "Hours",
      "rate": 92.0,
      "amount": 44160.0
    },
    {
      "schedule_id": "SS-2026-06",
      "wbs_element": "PRJ004.WBS.001",
      "site": "Liverpool South",
      "activity_type": "Sewer Lining",
      "intervention_id": "INT-W-2606",
      "cost_category": "Specialist Services",
      "quantity": 1200,
      "unit": "Metres",
      "rate": 145.0,
      "amount": 174000.0
    }
  ],
  "wbs": [
    {
      "wbs_code": "PRJ001.WBS.001",
      "description": "Mains Replacement - Phase 1 - Site Engineering and Installation",
      "project_id": "PRJ-001",
      "site": "Manchester North",
      "status": "Active",
      "investment_reference": "INV-REG-2026-01",
      "intervention_id": "INT-W-2601",
      "created_date": "2025-11-15"
    },
    {
      "wbs_code": "PRJ001.WBS.002",
      "description": "Mains Replacement - Phase 1 - Quality Assurance and Testing",
      "project_id": "PRJ-001",
      "site": "Manchester North",
      "status": "Active",
      "investment_reference": "INV-REG-2026-01",
      "intervention_id": "INT-W-2601",
      "created_date": "2025-11-15"
    },
    {
      "wbs_code": "PRJ001.WBS.003",
      "description": "Mains Replacement - Phase 1 - Project Management and Controls",
      "project_id": "PRJ-001",
      "site": "Manchester North",
      "status": "Active",
      "investment_reference": "INV-REG-2026-01",
      "intervention_id": "INT-W-2602",
      "created_date": "2025-11-20"
    },
    {
      "wbs_code": "PRJ002.WBS.001",
      "description": "Treatment Works Upgrade - Civil Engineering Works",
      "project_id": "PRJ-002",
      "site": "Birmingham Central",
      "status": "Active",
      "investment_reference": "INV-REG-2026-02",
      "intervention_id": "INT-WW-2604",
      "created_date": "2025-10-05"
    },
    {
      "wbs_code": "PRJ002.WBS.002",
      "description": "Treatment Works Upgrade - Mechanical and Electrical Installation",
      "project_id": "PRJ-002",
      "site": "Birmingham Central",
      "status": "Active",
      "investment_reference": "INV-REG-2026-02",
      "intervention_id": "INT-WW-2604",
      "created_date": "2025-10-05"
    },
    {
      "wbs_code": "PRJ003.WBS.001",
      "description": "Leak Detection Programme - Survey and Investigation",
      "project_id": "PRJ-003",
      "site": "Leeds West",
      "status": "Active",
      "investment_reference": "INV-REG-2026-03",
      "intervention_id": "INT-W-2603",
      "created_date": "2026-01-10"
    },
    {
      "wbs_code": "PRJ003.WBS.002",
      "description": "Leak Detection Programme - Repair and Reinstatement",
      "project_id": "PRJ-003",
      "site": "Leeds West",
      "status": "Active",
      "investment_reference": "INV-REG-2026-03",
      "intervention_id": "INT-W-2603",
      "created_date": "2026-01-10"
    },
    {
      "wbs_code": "PRJ004.WBS.001",
      "description": "Sewer Rehabilitation - Lining and Structural Repair",
      "project_id": "PRJ-004",
      "site": "Liverpool South",
      "status": "Active",
      "investment_reference": "INV-REG-2026-04",
      "intervention_id": "INT-W-2606",
      "created_date": "2025-12-01"
    }
  ],
  "financialtransaction": [
    {
      "transaction_id": "SAP-FI-2026-00145",
      "posting_date": "2026-02-15",
      "period": "2026-02",
      "wbs_element": "PRJ001.WBS.001",
      "cost_element": "620100",
      "amount": 20800.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100234567",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00146",
      "posting_date": "2026-02-15",
      "period": "2026-02",
      "wbs_element": "PRJ001.WBS.001",
      "cost_element": "620100",
      "amount": 34800.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100234568",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00147",
      "posting_date": "2026-02-20",
      "period": "2026-02",
      "wbs_element": "PRJ001.WBS.001",
      "cost_element": "630200",
      "amount": 106250.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100234789",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00148",
      "posting_date": "2026-03-05",
      "period": "2026-03",
      "wbs_element": "PRJ001.WBS.002",
      "cost_element": "620300",
      "amount": 8160.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100245123",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00149",
      "posting_date": "2026-03-05",
      "period": "2026-03",
      "wbs_element": "PRJ001.WBS.002",
      "cost_element": "620400",
      "amount": 3520.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100245124",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00150",
      "posting_date": "2026-03-12",
      "period": "2026-03",
      "wbs_element": "PRJ002.WBS.001",
      "cost_element": "620100",
      "amount": 38080.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100256890",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00151",
      "posting_date": "2026-03-12",
      "period": "2026-03",
      "wbs_element": "PRJ002.WBS.001",
      "cost_element": "620100",
      "amount": 15000.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100256891",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00152",
      "posting_date": "2026-03-18",
      "period": "2026-03",
      "wbs_element": "PRJ002.WBS.001",
      "cost_element": "630200",
      "amount": 38700.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100267234",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00153",
      "posting_date": "2026-04-08",
      "period": "2026-04",
      "wbs_element": "PRJ002.WBS.002",
      "cost_element": "620100",
      "amount": 49920.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100278456",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00154",
      "posting_date": "2026-04-08",
      "period": "2026-04",
      "wbs_element": "PRJ002.WBS.002",
      "cost_element": "620500",
      "amount": 15200.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100278457",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00155",
      "posting_date": "2026-05-14",
      "period": "2026-05",
      "wbs_element": "PRJ003.WBS.001",
      "cost_element": "620500",
      "amount": 44160.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100289123",
      "reconciliation_status": "Reconciled"
    },
    {
      "transaction_id": "SAP-FI-2026-00156",
      "posting_date": "2026-06-20",
      "period": "2026-06",
      "wbs_element": "PRJ004.WBS.001",
      "cost_element": "620500",
      "amount": 174000.0,
      "currency": "GBP",
      "source_system": "SAP_S4",
      "document_number": "5100298765",
      "reconciliation_status": "Reconciled"
    }
  ],
  "investment": [
    {
      "investment_reference": "WINV-2026-WTR-MAIN-01",
      "regulatory_driver": "Water Quality Compliance - EPA Consent Order",
      "description": "Mains rehabilitation programme to address leakage reduction targets and water quality compliance in North Region distribution network",
      "planned_amount": 4850000,
      "committed_amount": 3920000,
      "actual_spend": 1680000,
      "status": "Active",
      "submission_date": "2025-11-15"
    },
    {
      "investment_reference": "WINV-2026-WW-TREAT-02",
      "regulatory_driver": "Urban Wastewater Treatment Directive",
      "description": "Wastewater treatment works upgrade to meet revised discharge consents and nutrient removal obligations at Eastside and Riverside facilities",
      "planned_amount": 6200000,
      "committed_amount": 5100000,
      "actual_spend": 3870000,
      "status": "Active",
      "submission_date": "2025-10-22"
    },
    {
      "investment_reference": "WINV-2026-WTR-ASSET-03",
      "regulatory_driver": "Drinking Water Quality Standards - Lead Reduction",
      "description": "Service pipe replacement programme targeting lead remediation and customer supply resilience in priority areas",
      "planned_amount": 2920000,
      "committed_amount": 2350000,
      "actual_spend": 1580000,
      "status": "Active",
      "submission_date": "2025-12-01"
    },
    {
      "investment_reference": "WINV-2026-WW-NET-04",
      "regulatory_driver": "Combined Sewer Overflow Improvement - Environmental Agency",
      "description": "Wastewater network enhancement to reduce CSO spill frequency and improve river water quality in designated catchments",
      "planned_amount": 3750000,
      "committed_amount": 2890000,
      "actual_spend": 465000,
      "status": "Active",
      "submission_date": "2025-11-08"
    },
    {
      "investment_reference": "WINV-2026-OPS-EFF-05",
      "description": "Operational efficiency and digital transformation initiatives including SCADA upgrade, telemetry expansion and predictive maintenance capability",
      "regulatory_driver": "Non-Regulatory - Operational Efficiency",
      "planned_amount": 1580000,
      "committed_amount": 1150000,
      "actual_spend": 620000,
      "status": "Active",
      "submission_date": "2026-01-10"
    }
  ],
  "project": [
    {
      "project_code": "WTR-NR-MAIN-2026",
      "name": "North Region Mains Renewal Phase 2",
      "manager": "Sarah Mitchell",
      "status": "Execution",
      "budget": 2850000,
      "forecast": 2920000,
      "actual_cost": 1680000,
      "investment_id": "INV-REG-2026-01"
    },
    {
      "project_code": "WW-ES-UPGRADE-2026",
      "name": "Eastside WwTW Nutrient Removal Upgrade",
      "manager": "James Chen",
      "status": "Execution",
      "budget": 3100000,
      "forecast": 3280000,
      "actual_cost": 2340000,
      "investment_id": "INV-REG-2026-02"
    },
    {
      "project_code": "WW-RS-UPGRADE-2026",
      "name": "Riverside WwTW Process Optimisation",
      "manager": "Emma Thompson",
      "status": "Execution",
      "budget": 2000000,
      "forecast": 2050000,
      "actual_cost": 1530000,
      "investment_id": "INV-REG-2026-02"
    },
    {
      "project_code": "WTR-LEAD-REM-2026",
      "name": "Lead Service Pipe Replacement Programme",
      "manager": "Michael Roberts",
      "status": "Execution",
      "budget": 2350000,
      "forecast": 2420000,
      "actual_cost": 1580000,
      "investment_id": "INV-REG-2026-03"
    },
    {
      "project_code": "WW-CSO-IMP-2026",
      "name": "CSO Reduction - Millbrook Catchment",
      "manager": "Rachel Foster",
      "status": "Planning",
      "budget": 2890000,
      "forecast": 2890000,
      "actual_cost": 465000,
      "investment_id": "INV-REG-2026-04"
    }
  ],
  "intervention": [
    {
      "intervention_code": "INT-MAIN-DI-315-2026",
      "description": "DI mains replacement - 315mm trunk main renewal at Oakfield Avenue and connecting streets (1.8km)",
      "asset_type": "Water Distribution Main",
      "regulatory_category": "Mains Rehabilitation",
      "status": "In Progress",
      "planned_cost": 680000,
      "actual_cost": 173530
    },
    {
      "intervention_code": "INT-MAIN-PE-180-2026",
      "description": "PE mains installation - 180mm PE replacement of aging AC mains in Riverside district (2.4km)",
      "asset_type": "Water Distribution Main",
      "regulatory_category": "Mains Rehabilitation",
      "status": "In Progress",
      "planned_cost": 420000,
      "actual_cost": 285000
    },
    {
      "intervention_code": "INT-MAIN-DI-225-2026",
      "description": "DI mains renewal - 225mm critical supply main at Station Road commercial zone (0.9km)",
      "asset_type": "Water Distribution Main",
      "regulatory_category": "Mains Rehabilitation",
      "status": "In Progress",
      "planned_cost": 390000,
      "actual_cost": 44160
    },
    {
      "intervention_code": "INT-NUTRIENT-BNR-ES-2026",
      "description": "Biological nutrient removal plant - new BNR process lanes, secondary clarifiers and chemical dosing at Eastside WwTW",
      "asset_type": "Wastewater Treatment Process",
      "regulatory_category": "WwTW Upgrade - Nutrient Removal",
      "status": "In Progress",
      "planned_cost": 2100000,
      "actual_cost": 156900
    },
    {
      "intervention_code": "INT-PROCESS-OPT-RS-2026",
      "description": "Process optimisation - aeration upgrade, RAS control and SCADA integration at Riverside WwTW",
      "asset_type": "Wastewater Treatment Process",
      "regulatory_category": "WwTW Upgrade - Process Enhancement",
      "status": "In Progress",
      "planned_cost": 1050000,
      "actual_cost": 1530000
    },
    {
      "intervention_code": "INT-SERVICE-LEAD-2026",
      "description": "Lead service pipe replacement - property boundary to main connection renewal across priority zones (1240 properties)",
      "asset_type": "Water Service Connection",
      "regulatory_category": "Lead Remediation",
      "status": "In Progress",
      "planned_cost": 1580000,
      "actual_cost": 174000
    }
  ],
  "exception": [
    {
      "exception_type": "reconciliation_break",
      "severity": "high",
      "description": "Supplier schedule total \u00a3485,000 does not reconcile to PO total \u00a3500,000. Variance of \u00a315,000 detected.",
      "detected_date": "2026-09-15",
      "status": "open",
      "assigned_to": "Sarah Mitchell",
      "related_entity_type": "PurchaseOrder",
      "related_entity_id": "PO-5001",
      "resolution_notes": None
    },
    {
      "exception_type": "missing_intervention_link",
      "severity": "medium",
      "description": "WBS element WBS-PRJ003-02 has no valid intervention assignment. Required for regulatory traceability.",
      "detected_date": "2026-09-18",
      "status": "in_progress",
      "assigned_to": "James Reynolds",
      "related_entity_type": "WBS",
      "related_entity_id": "WBS-PRJ003-02",
      "resolution_notes": "Awaiting intervention mapping approval from project controls team."
    },
    {
      "exception_type": "posting_to_closed_wbs",
      "severity": "high",
      "description": "Financial transaction attempted to post \u00a342,500 to closed WBS element WBS-PRJ001-03.",
      "detected_date": "2026-09-20",
      "status": "resolved",
      "assigned_to": "Rachel Thompson",
      "related_entity_type": "FinancialTransaction",
      "related_entity_id": "FI-2026-00151",
      "resolution_notes": "Transaction rerouted to correct WBS element WBS-PRJ001-02. Finance team confirmed posting complete."
    },
    {
      "exception_type": "variance_threshold_breach",
      "severity": "medium",
      "description": "Reconciliation variance of \u00a38,200 exceeds 5% tolerance threshold for PO line POL-5005-02.",
      "detected_date": "2026-09-22",
      "status": "open",
      "assigned_to": "Michael Chen",
      "related_entity_type": "POLine",
      "related_entity_id": "POL-5005-02",
      "resolution_notes": None
    },
    {
      "exception_type": "missing_wbs_reference",
      "severity": "low",
      "description": "Purchase order PO-5008 created without mandatory WBS element reference in line POL-5008-01.",
      "detected_date": "2026-09-25",
      "status": "in_progress",
      "assigned_to": "David Hughes",
      "related_entity_type": "PurchaseOrder",
      "related_entity_id": "PO-5008",
      "resolution_notes": "Project manager contacted to provide correct WBS assignment."
    },
    {
      "exception_type": "duplicate_transaction",
      "severity": "high",
      "description": "Potential duplicate financial posting detected. Transaction FI-2026-00154 matches amount and WBS of FI-2026-00149.",
      "detected_date": "2026-09-27",
      "status": "open",
      "assigned_to": "Sarah Mitchell",
      "related_entity_type": "FinancialTransaction",
      "related_entity_id": "FI-2026-00154",
      "resolution_notes": None
    }
  ],
  "reconciliationitem": [
    {
      "po_line_id": "POL-5001-01",
      "supplier_schedule_line_id": "SSL-2026-01-001",
      "financial_transaction_id": "FI-2026-00145",
      "match_confidence": 0.98,
      "variance_amount": 0,
      "reconciliation_status": "matched",
      "reconciled_by": "Rachel Thompson",
      "reconciled_date": "2026-09-16"
    },
    {
      "po_line_id": "POL-5001-01",
      "supplier_schedule_line_id": "SSL-2026-01-002",
      "financial_transaction_id": "FI-2026-00146",
      "match_confidence": 0.95,
      "variance_amount": 500,
      "reconciliation_status": "matched",
      "reconciled_by": "Rachel Thompson",
      "reconciled_date": "2026-09-16"
    },
    {
      "po_line_id": "POL-5002-01",
      "supplier_schedule_line_id": "SSL-2026-02-001",
      "financial_transaction_id": "FI-2026-00147",
      "match_confidence": 1.0,
      "variance_amount": 0,
      "reconciliation_status": "matched",
      "reconciled_by": "Michael Chen",
      "reconciled_date": "2026-09-17"
    },
    {
      "po_line_id": "POL-5002-02",
      "supplier_schedule_line_id": "SSL-2026-02-002",
      "financial_transaction_id": "FI-2026-00148",
      "match_confidence": 0.92,
      "variance_amount": 1200,
      "reconciliation_status": "variance_accepted",
      "reconciled_by": "Michael Chen",
      "reconciled_date": "2026-09-18"
    },
    {
      "po_line_id": "POL-5003-01",
      "supplier_schedule_line_id": "SSL-2026-03-001",
      "financial_transaction_id": "FI-2026-00149",
      "match_confidence": 0.97,
      "variance_amount": 0,
      "reconciliation_status": "matched",
      "reconciled_by": "Sarah Mitchell",
      "reconciled_date": "2026-09-19"
    },
    {
      "po_line_id": "POL-5004-01",
      "supplier_schedule_line_id": "SSL-2026-04-001",
      "financial_transaction_id": "FI-2026-00150",
      "match_confidence": 0.88,
      "variance_amount": 3400,
      "reconciliation_status": "under_review",
      "reconciled_by": None,
      "reconciled_date": None
    },
    {
      "po_line_id": "POL-5005-01",
      "supplier_schedule_line_id": "SSL-2026-05-001",
      "financial_transaction_id": "FI-2026-00152",
      "match_confidence": 0.99,
      "variance_amount": 0,
      "reconciliation_status": "matched",
      "reconciled_by": "David Hughes",
      "reconciled_date": "2026-09-21"
    },
    {
      "po_line_id": "POL-5005-02",
      "supplier_schedule_line_id": None,
      "financial_transaction_id": "FI-2026-00153",
      "match_confidence": 0.65,
      "variance_amount": 8200,
      "reconciliation_status": "unmatched",
      "reconciled_by": None,
      "reconciled_date": None
    },
    {
      "po_line_id": "POL-5006-01",
      "supplier_schedule_line_id": "SSL-2026-06-001",
      "financial_transaction_id": "FI-2026-00154",
      "match_confidence": 0.94,
      "variance_amount": 750,
      "reconciliation_status": "matched",
      "reconciled_by": "James Reynolds",
      "reconciled_date": "2026-09-23"
    },
    {
      "po_line_id": "POL-5007-01",
      "supplier_schedule_line_id": None,
      "financial_transaction_id": "FI-2026-00155",
      "match_confidence": 0.72,
      "variance_amount": 5600,
      "reconciliation_status": "under_review",
      "reconciled_by": None,
      "reconciled_date": None
    }
  ],
  "forecast": [
    {
      "wbs_element": "WBS-PRJ001-01",
      "period": "2026-Q1",
      "forecast_type": "baseline",
      "amount": 850000,
      "version": "V1.0",
      "as_at_date": "2026-01-15",
      "preparer": "Sarah Mitchell",
      "approval_status": "approved"
    },
    {
      "wbs_element": "WBS-PRJ001-02",
      "period": "2026-Q1",
      "forecast_type": "baseline",
      "amount": 620000,
      "version": "V1.0",
      "as_at_date": "2026-01-15",
      "preparer": "Sarah Mitchell",
      "approval_status": "approved"
    },
    {
      "wbs_element": "WBS-PRJ002-01",
      "period": "2026-Q2",
      "forecast_type": "revised",
      "amount": 1450000,
      "version": "V2.1",
      "as_at_date": "2026-04-20",
      "preparer": "Michael Chen",
      "approval_status": "approved"
    },
    {
      "wbs_element": "WBS-PRJ002-02",
      "period": "2026-Q2",
      "forecast_type": "revised",
      "amount": 780000,
      "version": "V2.1",
      "as_at_date": "2026-04-20",
      "preparer": "Michael Chen",
      "approval_status": "approved"
    },
    {
      "wbs_element": "WBS-PRJ003-01",
      "period": "2026-Q3",
      "forecast_type": "current",
      "amount": 925000,
      "version": "V3.0",
      "as_at_date": "2026-07-10",
      "preparer": "James Reynolds",
      "approval_status": "pending"
    },
    {
      "wbs_element": "WBS-PRJ004-01",
      "period": "2026-Q4",
      "forecast_type": "baseline",
      "amount": 1875000,
      "version": "V1.0",
      "as_at_date": "2026-10-05",
      "preparer": "David Hughes",
      "approval_status": "approved"
    },
    {
      "wbs_element": "WBS-PRJ001-01",
      "period": "2027-Q1",
      "forecast_type": "estimate_to_complete",
      "amount": 425000,
      "version": "V4.2",
      "as_at_date": "2026-12-15",
      "preparer": "Sarah Mitchell",
      "approval_status": "draft"
    },
    {
      "wbs_element": "WBS-PRJ002-01",
      "period": "2027-Q2",
      "forecast_type": "estimate_to_complete",
      "amount": 685000,
      "version": "V4.2",
      "as_at_date": "2026-12-15",
      "preparer": "Michael Chen",
      "approval_status": "draft"
    }
  ]
}

DEFAULT_USERS = [{"email": "admin@demo.app", "password": "admin", "role": "admin"}]


def run_seed():
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with db._lock, db.connect() as conn:
        if conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0:
            for u in DEFAULT_USERS:
                conn.execute(
                    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?,?,?,?,?)",
                    (uuid.uuid4().hex, u["email"], auth.hash_password(u["password"]), u["role"], now),
                )
        for table, rows in SEED.items():
            if conn.execute('SELECT COUNT(*) AS n FROM "%s"' % table).fetchone()["n"] > 0:
                continue
            for row in rows:
                cols = list(row.keys())
                keys = ["id", "created_at"] + cols
                ph = ", ".join("?" for _ in keys)
                colsql = ", ".join('"%s"' % k for k in keys)
                conn.execute(
                    'INSERT INTO "%s" (%s) VALUES (%s)' % (table, colsql, ph),
                    [uuid.uuid4().hex, now] + [row[c] for c in cols],
                )
