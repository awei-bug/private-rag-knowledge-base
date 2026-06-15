from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.models import AppSettingsORM
from app.models.settings import UserPreferences


class SettingsService:
    def __init__(self, session_factory: sessionmaker) -> None:
        self.session_factory = session_factory

    def get_preferences(self) -> UserPreferences:
        with self.session_factory() as session:
            settings = session.scalar(select(AppSettingsORM).where(AppSettingsORM.settings_id == "default"))
            if settings is None:
                return UserPreferences()
            return UserPreferences(**(settings.preferences_json or {}))

    def update_preferences(self, payload: UserPreferences) -> UserPreferences:
        with self.session_factory() as session:
            settings = session.scalar(select(AppSettingsORM).where(AppSettingsORM.settings_id == "default"))
            if settings is None:
                settings = AppSettingsORM(settings_id="default", preferences_json=payload.model_dump())
                session.add(settings)
            else:
                settings.preferences_json = payload.model_dump()
            session.commit()
            return UserPreferences(**settings.preferences_json)
