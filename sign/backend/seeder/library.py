"""The BTS library: links to sujets, corrigés, cours and TD hosted elsewhere.

    python -m backend.cli seed-library

The catalogue lives in ``seeder/data/library_bts.json`` (title, link, filière,
matière, type, session, source, author). STOUDENT stores the link and the
attribution only: the student opens the document on the site that hosts it,
which keeps the author's rights and the site's audience intact.

Idempotent: a document is matched on its link. Rows the library account added
are refreshed from the file (a corrected matière, a better title); visits,
reports and moderation are left alone.
"""
import json
import secrets

from pathlib import Path

from sqlalchemy import select

from backend.app.admin.schema.user import UserRegister
from backend.crud.crud_user import user_dao
import backend.models  # noqa: F401  (every table registered for create_table)

from backend.database.db_postgres import async_db_session, create_table
from backend.models.community import Resource

DATA = Path(__file__).parent / 'data' / 'library_bts.json'
# The account the catalogue is filed under. Its number is in the 225 00 range,
# which no Ivorian operator assigns, like the demo accounts.
LIBRARY_PSEUDO = 'bibliotheque'
LIBRARY_PHONE = '2250000000100'
FIELDS = ('title', 'filiere', 'subject', 'kind', 'chapter', 'session_year', 'source', 'original_author', 'description')


async def seed() -> int:
    entries: list[dict] = json.loads(DATA.read_text(encoding='utf-8'))
    created = updated = 0
    # On a fresh database the community tables come from create_all, which the
    # API runs at startup, after this seeder: create them now (no-op otherwise).
    await create_table()
    async with async_db_session.begin() as db:
        account = await user_dao.get_by_pseudo(db, LIBRARY_PSEUDO)
        if account is None:
            account = await user_dao.add(
                db,
                UserRegister(
                    phone=LIBRARY_PHONE,
                    pseudo=LIBRARY_PSEUDO,
                    # Nobody signs in as the library.
                    password=f'Lib-{secrets.token_urlsafe(16)}',
                ),
            )
        existing = {
            r.url: r
            for r in (await db.execute(select(Resource).where(Resource.url.in_([e['url'] for e in entries]))))
            .unique()
            .scalars()
            .all()
        }
        for entry in entries:
            values = {field: entry.get(field) for field in FIELDS}
            row = existing.get(entry['url'])
            if row is None:
                db.add(Resource(author_id=account.id, url=entry['url'], status='published', **values))
                created += 1
            elif row.author_id == account.id:
                changed = False
                for field, value in values.items():
                    if getattr(row, field) != value:
                        setattr(row, field, value)
                        changed = True
                updated += changed

        # A document taken out of the file (an author asked, a dead link) leaves
        # the library too.
        urls = {e['url'] for e in entries}
        withdrawn = 0
        for row in (
            await db.execute(
                select(Resource).where(Resource.author_id == account.id, Resource.status == 'published')
            )
        ).unique().scalars().all():
            if row.url not in urls:
                row.status = 'withdrawn'
                withdrawn += 1

    print(
        f'[ok] library: {created} created, {updated} updated, {withdrawn} withdrawn, '
        f'{len(entries)} in the catalogue'
    )
    return 0
