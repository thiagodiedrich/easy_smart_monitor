"""
Modelo Tenant.

Representa o cliente SaaS (empresa pagante).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship

from app.core.database import Base


class Tenant(Base):
    """Modelo de tenant SaaS."""

    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(20), default="active", nullable=False)
    plan_code = Column(String(50), nullable=True)
    is_white_label = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organizations = relationship("Organization", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Tenant(name='{self.name}', slug='{self.slug}', status='{self.status}')>"
