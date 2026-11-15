from importlib import util as importlib_util
from pathlib import Path

from alembic import command
from alembic.config import Config

_SHARED_ROOT = Path(importlib_util.find_spec("saerpa_shared").origin).parent.parent.parent
_ALEMBIC_INI = _SHARED_ROOT / "alembic.ini"


def run_migrations() -> None:
    config = Config(str(_ALEMBIC_INI))
    config.set_main_option("script_location", str(_SHARED_ROOT / "migrations"))
    command.upgrade(config, "head")
