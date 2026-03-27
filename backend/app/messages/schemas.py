from pydantic import BaseModel
from datetime import datetime

class MessageCreate(BaseModel):
    sender_name: str
    sender_role: str
    target_group: str
    subject: str
    content: str

class MessageUpdate(BaseModel):
    subject: str
    content: str

class MessageResponse(BaseModel):
    id: int
    sender_name: str
    sender_role: str
    target_group: str
    subject: str
    content: str
    is_deleted: int
    created_at: datetime

    class Config:
        from_attributes = True
