"""ApexStudio-generated FastAPI application."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db
from . import auth_router, entities_router, files_router, events_router
from . import ai_router, integrations_router, payments_router, insights_router

APP_NAME = "Project Cost Granularity Controller"

app = FastAPI(title=APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('APEX_CORS', '*').split(','),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

db.init_db()

for _r in (auth_router.router, entities_router.router, files_router.router,
           events_router.router, ai_router.router, integrations_router.router,
           payments_router.router, insights_router.router):
    app.include_router(_r)


@app.get('/health')
def health():
    return {'status': 'ok', 'app': APP_NAME}
