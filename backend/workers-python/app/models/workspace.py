"""
Modelo Workspace.

Contexto operacional (ambiente, projeto, produto).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class Workspace(Base):
    """Modelo de workspace."""

    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    class Status(str, enum.Enum):
        ACTIVE = "active"
        INACTIVE = "inactive"
        BLOCKED = "blocked"

    status = Column(
        Enum(Status, name="workspace_status"),
        default=Status.ACTIVE,
        nullable=False
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="workspaces")

    def __repr__(self) -> str:
        return f"<Workspace(name='{self.name}', organization_id='{self.organization_id}')>"
