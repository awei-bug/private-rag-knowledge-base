from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.dependencies import get_analytics_service
from app.models.analytics import (
    AnalyticsOverview,
    DocumentGraphResponse,
    QueryInsightsResponse,
    SystemMetricsResponse,
)
from app.models.auth import UserProfile
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def analytics_overview(
    _: UserProfile = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsOverview:
    return service.get_overview()


@router.get("/document-graph", response_model=DocumentGraphResponse)
def document_graph(
    _: UserProfile = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service),
) -> DocumentGraphResponse:
    return service.get_document_graph()


@router.get("/query-insights", response_model=QueryInsightsResponse)
def query_insights(
    _: UserProfile = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service),
) -> QueryInsightsResponse:
    return service.get_query_insights()


@router.get("/system-metrics", response_model=SystemMetricsResponse)
def system_metrics(
    _: UserProfile = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service),
) -> SystemMetricsResponse:
    return service.get_system_metrics()
