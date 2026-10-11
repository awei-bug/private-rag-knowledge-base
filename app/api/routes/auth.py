from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import create_access_token, get_current_user, refresh_access_token
from app.dependencies import authenticate_user
from app.models.auth import LoginRequest, LoginResponse, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    user = authenticate_user(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")
    return create_access_token(user)


@router.get("/me", response_model=UserProfile)
def me(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return user


@router.post("/refresh", response_model=LoginResponse)
def refresh(user: UserProfile = Depends(get_current_user)) -> LoginResponse:
    return refresh_access_token(user)
