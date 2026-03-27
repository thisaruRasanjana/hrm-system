from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.messages import models, schemas
from typing import List

router = APIRouter()

@router.post("/", response_model=schemas.MessageResponse)
def create_message(message: schemas.MessageCreate, db: Session = Depends(get_db)):
    db_message = models.Message(**message.model_dump())
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

@router.get("/", response_model=List[schemas.MessageResponse])
def get_messages(target_group: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.Message)
    if target_group:
        query = query.filter(models.Message.target_group == target_group)
    return query.order_by(models.Message.created_at.desc()).offset(skip).limit(limit).all()

@router.put("/{message_id}", response_model=schemas.MessageResponse)
def update_message(message_id: int, message_update: schemas.MessageUpdate, db: Session = Depends(get_db)):
    db_message = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db_message.subject = message_update.subject
    db_message.content = message_update.content
    db.commit()
    db.refresh(db_message)
    return db_message

@router.delete("/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db)):
    db_message = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if db_message.is_deleted == 0:
        db_message.is_deleted = 1
        db.commit()
        return {"detail": "Message moved to trash"}
    else:
        db.delete(db_message)
        db.commit()
        return {"detail": "Message permanently deleted"}
