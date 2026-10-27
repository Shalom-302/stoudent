"""Photos of exercise statements.

Every upload is decoded and re-encoded as JPEG: it proves the file is an
image (not a script with a .jpg name), caps its size for slow mobile data,
and drops the EXIF metadata - including the GPS position phones write in it.
Files live in MinIO under a random name and are served back by the API, so
the object store never needs a public route.
"""
import io
import re
import uuid

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.common.exception import errors
from backend.core.conf import settings

UPLOAD_PREFIX = 'community/'
URL_PREFIX = f'{settings.FASTAPI_API_V1_PATH}/community/uploads/'
NAME_RE = re.compile(r'^[a-f0-9]{32}\.jpg$')
URL_RE = re.compile(r'^' + re.escape(URL_PREFIX) + r'[a-f0-9]{32}\.jpg$')

# Refuse decompression bombs early (a 40-megapixel photo is already huge).
Image.MAX_IMAGE_PIXELS = 40_000_000


def _storage():
    # Imported lazily: the client connects to MinIO when constructed.
    from backend.common.cloud_storage import mstorage

    return mstorage


def store_image(raw: bytes) -> str:
    """Validate, shrink, strip metadata, store. Returns the URL to save on the question."""
    if not raw:
        raise errors.RequestError(msg='Fichier vide.')
    if len(raw) > settings.UPLOAD_MAX_BYTES:
        raise errors.RequestError(msg=f'Photo trop lourde ({settings.UPLOAD_MAX_BYTES // (1024 * 1024)} Mo maximum).')
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise errors.RequestError(msg='Ce fichier n’est pas une image lisible (JPEG, PNG ou WebP).') from exc

    # Apply the phone's rotation before dropping the EXIF that carries it.
    image = ImageOps.exif_transpose(image).convert('RGB')
    image.thumbnail((settings.UPLOAD_MAX_SIDE, settings.UPLOAD_MAX_SIDE))
    out = io.BytesIO()
    image.save(out, format='JPEG', quality=82, optimize=True)
    data = out.getvalue()

    name = f'{uuid.uuid4().hex}.jpg'
    storage = _storage()
    storage.client.put_object(
        bucket_name=storage.bucket_name,
        object_name=UPLOAD_PREFIX + name,
        data=io.BytesIO(data),
        length=len(data),
        content_type='image/jpeg',
    )
    return URL_PREFIX + name


def read_image(name: str) -> bytes:
    if not NAME_RE.match(name):
        raise errors.NotFoundError(msg='Image introuvable.')
    storage = _storage()
    try:
        obj = storage.client.get_object(storage.bucket_name, UPLOAD_PREFIX + name)
        try:
            return obj.read()
        finally:
            obj.close()
            obj.release_conn()
    except Exception as exc:  # noqa: BLE001 - S3Error and connection errors alike
        raise errors.NotFoundError(msg='Image introuvable.') from exc
