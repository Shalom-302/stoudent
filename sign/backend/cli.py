"""Project management commands that run *inside* the api container.

The host ``shaapi`` wrapper invokes these over ``docker compose exec``. For
example ``shaapi auth init`` runs, inside the container::

    python -m backend.cli create-admin --email you@example.com --password ...

Kept on argparse + asyncio (stdlib only) so it has no extra dependency beyond
the backend itself.
"""
from __future__ import annotations

import argparse
import asyncio


async def create_admin(email: str, password: str, pseudo: str | None = None) -> int:
    """Create an admin user (idempotent) so you can log into Swagger."""
    from backend.app.admin.schema.user import UserRegister
    from backend.common.enums import Role as RoleEnum
    from backend.crud.crud_role import role_dao
    from backend.crud.crud_user import user_dao
    from backend.database.db_postgres import async_db_session
    from backend.models import Role

    async with async_db_session() as db:
        if await user_dao.get_by_email(db, email) is not None:
            print(f"[skip] A user with email {email} already exists.")
            return 0

        # user_dao.add() attaches the admin role *by name*, so make sure it
        # exists first. The Role model has no data_scope column, so we build it
        # directly rather than through CreateRoleParam.
        if await role_dao.get_by_name(db, RoleEnum.ADMIN.value) is None:
            db.add(Role(name=RoleEnum.ADMIN.value))
            await db.flush()

        # Explicitly an administrator: user_dao.add() defaults to the plain
        # 'user' role so the public registration endpoint cannot mint admins.
        if pseudo and await user_dao.get_by_pseudo(db, pseudo) is not None:
            print(f"[error] The pseudo {pseudo} is already taken.")
            return 1
        # The pseudo is the name shown on the answers the admin posts.
        await user_dao.add(
            db, UserRegister(email=email, password=password, pseudo=pseudo), role=RoleEnum.ADMIN.value
        )
        await db.commit()

    print(f"[ok] Admin user created: {email}")
    print("     Log in at /admin/api/v1/docs with this email and password.")
    return 0


def storage_init() -> int:
    """Ensure the configured object-storage bucket exists."""
    # Importing the singleton constructs the client, which creates the bucket
    # if it is missing (see MinioStorage.__init__).
    from backend.common.cloud_storage import mstorage
    from backend.core.conf import settings

    bucket = settings.MINIO_BUCKET_NAME
    if not mstorage.client.bucket_exists(bucket):
        mstorage.create_bucket()
        print(f"[ok] Created bucket: {bucket}")
    else:
        print(f"[skip] Bucket already exists: {bucket}")
    return 0


async def seed_demo(password: str | None) -> int:
    """Demo accounts (one per filière) and their questions. Idempotent."""
    import secrets

    from backend.seeder.demo import seed

    # Nobody needs to sign in as a demo student: a random password is enough.
    return await seed(password or f"Demo-{secrets.token_urlsafe(12)}")


async def seed_labs() -> int:
    """Seed the lab catalogue (labs, experiments, badges). Idempotent."""
    from backend.seeder.signallab import seed

    return await seed()


async def seed_library() -> int:
    """Seed the BTS library (links to sujets, corrigés, cours, TD). Idempotent."""
    from backend.seeder.library import seed

    return await seed()


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backend.cli", description="sign project management commands"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    ca = sub.add_parser("create-admin", help="Create an admin user")
    ca.add_argument("--email", required=True, help="Admin email (login).")
    ca.add_argument("--password", required=True, help="Admin password.")
    ca.add_argument("--pseudo", help="Public name shown on the admin's answers.")

    sub.add_parser("storage-init", help="Ensure the object-storage bucket exists")

    sd = sub.add_parser(
        "seed-demo", help="Create demo students (one per filière) and their questions"
    )
    sd.add_argument("--password", help="Password for the demo accounts (random if omitted).")

    sub.add_parser(
        "seed-labs", help="Seed the lab catalogue (labs, experiments, badges)"
    )

    sub.add_parser(
        "seed-library", help="Seed the BTS library (links and attribution, never copies)"
    )

    args = parser.parse_args()
    if args.command == "create-admin":
        return asyncio.run(create_admin(args.email, args.password, args.pseudo))
    if args.command == "storage-init":
        return storage_init()
    if args.command == "seed-demo":
        return asyncio.run(seed_demo(args.password))
    if args.command == "seed-labs":
        return asyncio.run(seed_labs())
    if args.command == "seed-library":
        return asyncio.run(seed_library())
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
