import secrets
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPBearer
from fastapi.security.utils import get_authorization_scheme_param
from jwt import ExpiredSignatureError, PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import User
from backend.common.dataclasses import AccessToken, NewToken, RefreshToken
from backend.common.exception.errors import AuthorizationError, TokenError
from backend.core.conf import settings
from backend.database.db_redis import redis_client
from backend.utils.timezone import timezone

# bcrypt cost. 12 is the current sane default: ~250 ms per hash on commodity
# hardware, which is painful to brute-force and invisible to a user logging in.
BCRYPT_ROUNDS = 12

# bcrypt only consumes the first 72 bytes of the input and ignores the rest.
# Truncating explicitly keeps the behaviour identical to the passlib-generated
# hashes already in the database instead of raising on long passphrases.
BCRYPT_MAX_BYTES = 72


# JWT authorizes dependency injection
DependsJwtAuth = Depends(HTTPBearer())


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode('utf-8')[:BCRYPT_MAX_BYTES]


def get_hash_password(password: str) -> str:
    """
    Encrypt passwords using the hash algorithm

    :param password:
    :return:
    """
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(_to_bcrypt_bytes(password), salt).decode('utf-8')


def password_verify(plain_password: str, hashed_password: str) -> bool:
    """
    Password verification

    :param plain_password: The password to verify
    :param hashed_password: The hash ciphers to compare
    :return:
    """
    if not hashed_password:
        # Still spend the time: an early return here is a login oracle that
        # tells an attacker which accounts exist.
        bcrypt.checkpw(_to_bcrypt_bytes(plain_password), bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
        return False
    try:
        return bcrypt.checkpw(
            _to_bcrypt_bytes(plain_password), hashed_password.encode('utf-8')
        )
    except ValueError:
        # Malformed/legacy hash in the database: treat as a failed login.
        return False


async def create_access_token(sub: str, multi_login: bool) -> AccessToken:
    """
    Generate encryption token

    :param sub: The subject/userid of the JWT
    :param multi_login: multipoint login for user
    :return:
    """
    expire = timezone.now() + timedelta(seconds=settings.TOKEN_EXPIRE_SECONDS)
    expire_seconds = settings.TOKEN_EXPIRE_SECONDS

    # 'type' is defence in depth: the refresh token also lives in Redis under a
    # different prefix, but a claim makes the two impossible to confuse.
    # 'jti' makes every token unique: two tokens minted for the same user in the
    # same second were byte-identical, so rotating or revoking one (the Redis
    # key is the token itself) silently killed the other session too.
    to_encode = {'exp': expire, 'sub': sub, 'iat': timezone.now(), 'type': 'access', 'jti': secrets.token_hex(8)}
    access_token = jwt.encode(
        to_encode, settings.TOKEN_SECRET_KEY, algorithm=settings.TOKEN_ALGORITHM
    )

    if multi_login is False:
        key_prefix = f'{settings.TOKEN_REDIS_PREFIX}:{sub}'
        await redis_client.delete_prefix(key_prefix)

    key = f'{settings.TOKEN_REDIS_PREFIX}:{sub}:{access_token}'
    await redis_client.setex(key, expire_seconds, access_token)
    return AccessToken(access_token=access_token, access_token_expire_time=expire)


async def create_refresh_token(sub: str, multi_login: bool) -> RefreshToken:
    """
    Generate encryption refresh token, only used to create a new token

    :param sub: The subject/userid of the JWT
    :param multi_login: multipoint login for user
    :return:
    """
    expire = timezone.now() + timedelta(seconds=settings.TOKEN_REFRESH_EXPIRE_SECONDS)
    expire_seconds = settings.TOKEN_REFRESH_EXPIRE_SECONDS

    to_encode = {'exp': expire, 'sub': sub, 'iat': timezone.now(), 'type': 'refresh', 'jti': secrets.token_hex(8)}
    refresh_token = jwt.encode(
        to_encode, settings.TOKEN_SECRET_KEY, algorithm=settings.TOKEN_ALGORITHM
    )

    if multi_login is False:
        key_prefix = f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{sub}'
        await redis_client.delete_prefix(key_prefix)

    key = f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{sub}:{refresh_token}'
    await redis_client.setex(key, expire_seconds, refresh_token)
    return RefreshToken(refresh_token=refresh_token, refresh_token_expire_time=expire)


async def create_new_token(sub: str, token: str | None, refresh_token: str, multi_login: bool) -> NewToken:
    """
    Generate new token

    :param sub:
    :param token
    :param refresh_token:
    :param multi_login:
    :return:
    """
    redis_refresh_token = await redis_client.get(f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{sub}:{refresh_token}')
    if not redis_refresh_token or redis_refresh_token != refresh_token:
        raise TokenError(msg='Refresh Token has expired')

    new_access_token = await create_access_token(sub, multi_login)
    new_refresh_token = await create_refresh_token(sub, multi_login)

    # ``token`` is absent when the browser comes back with only the refresh
    # cookie (access token expired and dropped): nothing to revoke then.
    if token:
        await redis_client.delete(f'{settings.TOKEN_REDIS_PREFIX}:{sub}:{token}')
    refresh_token_key = f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{sub}:{refresh_token}'
    await redis_client.delete(refresh_token_key)
    return NewToken(
        new_access_token=new_access_token.access_token,
        new_access_token_expire_time=new_access_token.access_token_expire_time,
        new_refresh_token=new_refresh_token.refresh_token,
        new_refresh_token_expire_time=new_refresh_token.refresh_token_expire_time,
    )


def get_token(request: Request) -> str:
    """
    Get token for request header

    :return:
    """
    authorization = request.headers.get('Authorization')
    scheme, token = get_authorization_scheme_param(authorization)
    if not authorization or scheme.lower() != 'bearer':
        raise TokenError(msg='Token is invalid')
    return token


def jwt_decode(token: str) -> int:
    """
    Decode token

    :param token:
    :return:
    """
    try:
        payload = jwt.decode(
            token,
            settings.TOKEN_SECRET_KEY,
            algorithms=[settings.TOKEN_ALGORITHM],
            # Pinning the algorithm list and requiring the claims we rely on
            # closes the classic 'alg: none' / missing-exp family of bypasses.
            options={'require': ['exp', 'sub'], 'verify_exp': True, 'verify_signature': True},
        )
        user_id = payload.get('sub')
        if not user_id:
            raise TokenError(msg='Token is invalid')
    except ExpiredSignatureError:
        raise TokenError(msg='Token has expired')
    except (PyJWTError, Exception):
        raise TokenError(msg='Token is invalid')
    return user_id


async def jwt_authentication(token: str) -> str:
    """
    JWT authentication

    :param token:
    :return:
    """
    user_id = jwt_decode(token)
    key = f'{settings.TOKEN_REDIS_PREFIX}:{user_id}:{token}'
    token_verify = await redis_client.get(key)
    if not token_verify:
        raise TokenError(msg='Token has expired')
    return user_id


async def get_current_user(db: AsyncSession, sub: str) -> User:
    """
    Get the current user through token

    :param db:
    :param pk:
    :return:
    """
    from backend.crud.crud_user import user_dao

    user = await user_dao.get_with_relation(db, x_id=sub)
    if not user:
        raise TokenError(msg='Token is invalid')
    if not user.status:
        raise AuthorizationError(msg='The user has been locked out, please contact the administrator')
    # if user.dept_id:
    #     if not user.dept.status:
    #         raise AuthorizationError(msg='User\'s department is locked')
    #     if user.dept.del_flag:
    #         raise AuthorizationError(msg='The department to which the user belongs has been deleted')
    if user.roles:
        role_status = [role.status for role in user.roles]
        if all(status == 0 for status in role_status):
            raise AuthorizationError(msg='User\'s role is locked')
    return user

def superuser_verify(request: Request) -> bool:
    """
    Verify the current user permissions through token

    :param request:
    :return:
    """
    superuser = request.user.is_superuser
    if not superuser or not request.user.is_staff:
        raise AuthorizationError
    return superuser
