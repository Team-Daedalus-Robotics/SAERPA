class ConflictError(Exception):
    """Recurso duplicado ou conflito de estado."""


class NotFoundError(Exception):
    """Recurso não encontrado."""


class InvalidGeometryError(Exception):
    """Geometria inválida (por exemplo, polígono que se cruza)."""
