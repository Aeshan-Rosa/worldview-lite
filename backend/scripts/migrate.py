from __future__ import annotations

from pathlib import Path

from psycopg import connect

from app.config import settings


def ensure_migrations_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    conn.commit()


def applied_versions(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}


def apply_sql_file(conn, version: str, sql_path: Path) -> None:
    sql = sql_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (version,))
    conn.commit()


def main() -> None:
    migration_dir = Path(__file__).resolve().parents[1] / "migrations"
    sql_files = sorted(migration_dir.glob("*.sql"))

    with connect(settings.database_url) as conn:
        ensure_migrations_table(conn)
        already = applied_versions(conn)

        for sql_file in sql_files:
            version = sql_file.stem
            if version in already:
                continue
            print(f"Applying migration: {version}")
            apply_sql_file(conn, version, sql_file)


if __name__ == "__main__":
    main()
