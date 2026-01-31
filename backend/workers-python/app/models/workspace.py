"""
Modelo Workspace.

Contexto operacional (ambiente, projeto, produto).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Workspace(Base):
    """Modelo de workspace."""

    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="workspaces")

    def __repr__(self) -> str:
        return f"<Workspace(name='{self.name}', organization_id='{self.organization_id}')>"
