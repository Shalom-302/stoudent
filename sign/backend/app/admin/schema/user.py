from datetime import datetime

from pydantic import ConfigDict, EmailStr, Field, HttpUrl, field_validator, model_validator
from typing_extensions import Self

from backend.common.enums import StatusType
from backend.common.schema import SchemaBase
from backend.core.conf import settings
from backend.app.admin.schema.role import GetRoleListDetails


def validate_password_strength(password: str) -> str:
    """Reject the passwords that make a credential stuffing list.

    Length does most of the work here; the character-class rule is kept mild
    on purpose, because piling on rules pushes people towards `Password1!`
    rather than towards a long passphrase.
    """
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        raise ValueError(
            f'Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long.'
        )
    if len(password) > settings.PASSWORD_MAX_LENGTH:
        raise ValueError(
            f'Password must be at most {settings.PASSWORD_MAX_LENGTH} characters long.'
        )
    classes = sum(
        (
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        )
    )
    if classes < 2:
        raise ValueError(
            'Password must mix at least two character types '
            '(lowercase, uppercase, digits, symbols).'
        )
    return password



class UserBase(SchemaBase):
    firstname: str | None = None
    lastname: str | None = None
    fullname: str | None = None
    phone: str | None = None
    pseudo: str | None = None
    email_verified: bool = False
    country_code: str | None = None
    profile_image: dict | None = None
    

def normalize_phone(value: str) -> str:
    """Bring a typed phone number to the stored form: digits, country code first.

    Ported from shaapi. ``+225 07 88 01 62 04``, ``00225...`` and a local
    ``07 88 01 62 04`` all become ``2250788016204``.
    """
    raw = value.strip()
    digits = ''.join(ch for ch in raw if ch.isdigit())
    if not raw.startswith('+') and digits.startswith('00'):
        digits = digits[2:]
    # Local number typed without the country code. Ivorian numbers keep their
    # leading 0 since the 2021 switch to 10 digits.
    elif not raw.startswith('+') and digits.startswith('0'):
        digits = settings.PHONE_DEFAULT_COUNTRY_CODE + digits
    if not (8 <= len(digits) <= 15):
        raise ValueError('Numéro de téléphone invalide (indicatif + numéro, chiffres uniquement).')
    return digits


FILIERE_MAX_LENGTH = 100
MEMBER_TYPES = ('student', 'teacher')


class UserLoginSchema(SchemaBase):
    """Log in with the WhatsApp number or, for older accounts, the email."""

    identifier: str = Field(min_length=3, max_length=200)
    password: str

    @model_validator(mode='before')
    @classmethod
    def _legacy_email(cls, data):
        # Swagger and the admin console still post ``email``.
        if isinstance(data, dict) and 'identifier' not in data and data.get('email'):
            data = {**data, 'identifier': data['email']}
        return data

    @property
    def is_email(self) -> bool:
        return '@' in self.identifier


class UserRegister(SchemaBase):
    password: str = Field(min_length=1, max_length=settings.PASSWORD_MAX_LENGTH)
    # Optional for STOUDENT; the CLI still creates email-only admins.
    email: EmailStr | None = None
    # International number, digits only (e.g. 2250152311124). Required by the
    # public register endpoint (checked in the service), used for the OTP.
    phone: str | None = None
    pseudo: str | None = Field(default=None, min_length=3, max_length=30)
    filiere: str | None = Field(default=None, min_length=2, max_length=FILIERE_MAX_LENGTH)
    institution: str | None = Field(default=None, max_length=200)
    level: str | None = Field(default=None, max_length=100)
    member_type: str = 'student'
    # Consent to STOUDENT news on WhatsApp; unticked by default.
    whatsapp_opt_in: bool = False

    _check_password = field_validator('password')(validate_password_strength)

    @field_validator('phone')
    @classmethod
    def _phone_digits(cls, v: str | None) -> str | None:
        return None if v is None else normalize_phone(v)

    @field_validator('pseudo')
    @classmethod
    def _pseudo_chars(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not all(ch.isalnum() or ch in '._-' for ch in v):
            raise ValueError('Le pseudo ne peut contenir que des lettres, chiffres, « . », « _ » et « - ».')
        return v

    @field_validator('filiere', 'institution', 'level')
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v else None

    @field_validator('member_type')
    @classmethod
    def _member_type(cls, v: str) -> str:
        if v not in MEMBER_TYPES:
            raise ValueError("Le rôle doit être « student » ou « teacher ».")
        return v


class VerifyOtpParam(SchemaBase):
    phone: str
    code: str = Field(min_length=4, max_length=8)

    _norm = field_validator('phone')(normalize_phone)


class ResendOtpParam(SchemaBase):
    phone: str

    _norm = field_validator('phone')(normalize_phone)


class ForgotPasswordParam(SchemaBase):
    phone: str

    _norm = field_validator('phone')(normalize_phone)


class ResetPasswordParam(SchemaBase):
    phone: str
    code: str = Field(min_length=4, max_length=8)
    new_password: str = Field(min_length=1, max_length=settings.PASSWORD_MAX_LENGTH)

    _norm = field_validator('phone')(normalize_phone)
    _check_password = field_validator('new_password')(validate_password_strength)


class UserUpdate(UserBase):
    pass


class UpdateUserParam(SchemaBase):
    firstname: str | None = None
    lastname: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class UserResetPassword(SchemaBase):
    new_password: str
    confirm_password: str

    _check_password = field_validator('new_password')(validate_password_strength)


class UserInfoSchemaBase(UserBase):
    email: EmailStr | None = None



class GetUserInfoNoRelationDetail(UserInfoSchemaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    x_id: str
    profile_image: dict | None = None
    status: bool
    join_time: datetime = None
    last_login_time: datetime | None = None



class GetUserInfoListDetails(GetUserInfoNoRelationDetail):
    model_config = ConfigDict(from_attributes=True)

    roles: list[GetRoleListDetails] | None = []


class GetCurrentUserInfoDetail(GetUserInfoListDetails):
    model_config = ConfigDict(from_attributes=True)

    roles: list[GetRoleListDetails] | list[str] | None = []

    @model_validator(mode='after')
    def handel(self) -> Self:
        """Dealing with sectors and roles"""
        roles = self.roles
        if roles:
            self.roles = [{'name': role.name} for role in roles]  # type: ignore
        return self


class CurrentUserIns(GetUserInfoListDetails):
    model_config = ConfigDict(from_attributes=True)


class UpdatePasswordParam(SchemaBase):
    old_password: str
    new_password: str
    confirm_password: str

    _check_password = field_validator('new_password')(validate_password_strength)


class ChangePasswordParam(SchemaBase):
    old_password: str = Field(min_length=1, max_length=settings.PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=1, max_length=settings.PASSWORD_MAX_LENGTH)

    _check_password = field_validator('new_password')(validate_password_strength)


class ChangePhoneStartParam(SchemaBase):
    password: str = Field(min_length=1, max_length=settings.PASSWORD_MAX_LENGTH)
    phone: str

    _norm = field_validator('phone')(normalize_phone)


class ChangePhoneConfirmParam(SchemaBase):
    phone: str
    code: str = Field(min_length=4, max_length=8)

    _norm = field_validator('phone')(normalize_phone)


class DeleteAccountParam(SchemaBase):
    password: str = Field(min_length=1, max_length=settings.PASSWORD_MAX_LENGTH)
