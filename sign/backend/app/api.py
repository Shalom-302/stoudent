import importlib
import logging
import pkgutil

from fastapi import APIRouter

from backend.app import Handlers
from backend.core.conf import settings

logger = logging.getLogger(__name__)

# One router per feature sub-application. ``admin`` is the back-office surface;
# ``client`` is the student-facing SignalLab API mounted at the site root, so the
# frontend calls `/api/v1/...` exactly as the fiche technique specifies.
admin_router = APIRouter(prefix=f"{settings.FASTAPI_API_V1_PATH}")
client_router = APIRouter(prefix=f"{settings.FASTAPI_API_V1_PATH}")

_SUB_APP_ROUTERS = {
    'admin': admin_router,
    'client': client_router,
}

for handler in Handlers.iterator():
    if getattr(handler, 'router', None):
        # 'backend.app.<sub_app>.api.v1.<module>' -> <sub_app>
        sub_app = handler.__name__.split('.')[-4]
        target = _SUB_APP_ROUTERS.get(sub_app)
        if target is not None:
            target.include_router(handler.router)


def _load_plugins() -> None:
    """Auto-discover plugins added with `shaapi add <name>`.

    Each plugin lives in ``backend/plugins/<name>/`` and exposes a ``router`` in
    its ``router`` module. Nothing is imported unless the plugin exists — the
    opposite of loading every plugin at startup. A fresh project has no
    ``backend/plugins`` package, so this is a no-op there.
    """
    try:
        import backend.plugins as plugins_pkg
    except ModuleNotFoundError:
        return
    for mod_info in pkgutil.iter_modules(plugins_pkg.__path__):
        if mod_info.name.startswith('_'):
            continue
        module_name = f'backend.plugins.{mod_info.name}.router'
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to load plugin '%s': %s", mod_info.name, exc)
            continue
        router = getattr(module, 'router', None)
        if router is not None:
            admin_router.include_router(router)
            logger.info("Loaded plugin '%s'", mod_info.name)


_load_plugins()
