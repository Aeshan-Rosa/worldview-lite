from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

pool = ConnectionPool(conninfo=settings.database_url, kwargs={"row_factory": dict_row}, open=False)


def open_pool() -> None:
    pool.open(wait=True)


def close_pool() -> None:
    pool.close()


@contextmanager
def get_conn() -> Iterator:
    with pool.connection() as conn:
        yield conn
