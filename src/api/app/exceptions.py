class ConflictError(Exception):
    """Recurso duplicado ou conflito de estado."""


class NotFoundError(Exception):
    """Recurso não encontrado."""


class InvalidGeometryError(Exception):
    """Geometria inválida (por exemplo, polígono que se cruza)."""


class ExternalServiceError(Exception):
    """Serviço externo (por exemplo, a NASA POWER) indisponível ou com resposta inesperada."""
