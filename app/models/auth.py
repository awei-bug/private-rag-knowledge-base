from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    username: str
    role: str
    allowed_acl: list[str] = Field(default_factory=list)
    display_name: str | None = None


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile


class AuthenticatedUser(UserProfile):
    password: str
