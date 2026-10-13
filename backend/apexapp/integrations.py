"""Outbound integration registry (capabilities 15, 16).

Secrets are read from environment variables and never exposed to the frontend.
Add a service by giving it a base_url and the env var holding its secret, e.g.

    INTEGRATIONS = {
        "hubspot": {"base_url": "https://api.hubapi.com", "secret_env": "HUBSPOT_TOKEN"},
    }

The frontend then calls it by name via POST /api/integrations/hubspot.
"""
import os

INTEGRATIONS = {
    "SAP_S4HANA": {
        "base_url": "https://api.sap-s4hana.example.com",
        "secret_env": "SAP_S4_API_KEY"
    },
    "COUPA": {
        "base_url": "https://api.coupa.com",
        "secret_env": "COUPA_API_KEY"
    },
    "FastDraft": {
        "base_url": "https://api.fastdraft.example.com",
        "secret_env": "FASTDRAFT_API_KEY"
    },
    "Primavera_P6": {
        "base_url": "https://api.primavera-p6.example.com",
        "secret_env": "P6_API_KEY"
    }
}


def config(name: str):
    return INTEGRATIONS.get(name)


def secret(cfg: dict):
    return os.environ.get(cfg.get("secret_env", "")) if cfg else None
