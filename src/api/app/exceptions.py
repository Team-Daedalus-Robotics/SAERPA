class ConflictError(Exception):
    """Recurso duplicado ou conflito de estado."""


class NotFoundError(Exception):
    """Recurso não encontrado."""
