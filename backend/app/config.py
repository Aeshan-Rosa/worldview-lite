from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "WorldView-Lite API"
    environment: str = "dev"
    cors_origins: str = "http://localhost:5173"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "worldview"
    db_user: str = "worldview"
    db_password: str = "worldview"

    usgs_feed_url: str = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
    ingest_interval_seconds: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}@"
            f"{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
