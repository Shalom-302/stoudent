"""Role-based route guards.

Casbin covers fine-grained permissions; this module covers the coarse question
"is the caller an administrator", which is all the SignManager back-office
needs and which must not depend on a policy table being seeded correctly.
"""
from fastapi import Depends, Request

from backend.common.enums import Role as RoleEnum
from backend.common.exception import errors


def _role_names(request: Request) -> set[str]:
    user = getattr(request, 'user', None)
    roles = getattr(user, 'roles', None) or []
    names: set[str] = set()
    for role in roles:
        # `request.user` is a Pydantic model whose roles may be objects or, when
        # served from the Redis cache, plain dicts.
        name = getattr(role, 'name', None) if not isinstance(role, dict) else role.get('name')
        if name:
            names.add(str(name))
    return names


def require_roles(*allowed: str):
    """Dependency factory: allow the request only for one of ``allowed``."""

    async def dependency(request: Request) -> None:
        if not getattr(request, 'user', None) or not getattr(request.user, 'id', None):
            raise errors.AuthorizationError(msg='Authentication required')
        if not _role_names(request) & set(allowed):
            raise errors.ForbiddenError(msg='Insufficient permissions')

    return dependency


def is_admin(request: Request) -> bool:
    return RoleEnum.ADMIN.value in _role_names(request)


# Ready-made dependency for the back-office routers.
DependsAdmin = Depends(require_roles(RoleEnum.ADMIN.value))
