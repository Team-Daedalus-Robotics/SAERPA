import os
import subprocess
import time

import requests

from suggestion.confing import BASE_URL, MODEL


STARTUP_TIMEOUT_SECONDS = float(os.environ.get("LAYA_STARTUP_TIMEOUT_SECONDS", "60"))
_server_process: subprocess.Popen[bytes] | None = None
_model_ready = False


def ensure_laya_server() -> None:
    global _server_process
    global _model_ready

    if not _is_laya_available():
        if _server_process is None or _server_process.poll() is not None:
            try:
                _server_process = subprocess.Popen(
                    ["ollaya", "serve"],
                    stdin=subprocess.DEVNULL,
                )
            except FileNotFoundError as error:
                raise RuntimeError(
                    "Ollaya não está instalado ou o comando 'ollaya' não está no PATH."
                ) from error

        deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            if _is_laya_available():
                break
            if _server_process.poll() is not None:
                raise RuntimeError("O processo 'ollaya serve' encerrou antes de ficar pronto.")
            time.sleep(0.5)
        else:
            raise RuntimeError(
                f"Ollaya não respondeu em {BASE_URL} após {STARTUP_TIMEOUT_SECONDS:g} segundos."
            )

    if not _model_ready:
        try:
            subprocess.run(
                ["ollaya", "pull", MODEL],
                check=True,
                timeout=600,
            )
        except subprocess.CalledProcessError as error:
            raise RuntimeError(f"Não foi possível baixar o modelo Ollaya '{MODEL}'.") from error
        except subprocess.TimeoutExpired as error:
            raise RuntimeError(
                f"O download do modelo Ollaya '{MODEL}' excedeu 10 minutos."
            ) from error
        except FileNotFoundError as error:
            raise RuntimeError(
                "Ollaya não está instalado ou o comando 'ollaya' não está no PATH."
            ) from error
        _model_ready = True


def _is_laya_available() -> bool:
    try:
        response = requests.get(f"{BASE_URL}/api/tags", timeout=1)
        return response.ok
    except requests.RequestException:
        return False
