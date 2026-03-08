from pydantic import BaseModel
from typing import List, Dict, Any


class DashboardLayoutResponse(BaseModel):
    widgets: List[Dict[str, Any]]


class DashboardLayoutUpdate(BaseModel):
    widgets: List[Dict[str, Any]]