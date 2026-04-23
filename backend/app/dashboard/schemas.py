from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class DashboardLayoutResponse(BaseModel):
    widgets: List[Dict[str, Any]]
    role: Optional[str] = None
    allowed_widgets: Optional[List[str]] = None


class DashboardLayoutUpdate(BaseModel):
    widgets: List[Dict[str, Any]]