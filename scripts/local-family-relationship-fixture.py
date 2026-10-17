"""Create name-only characters in an explicitly owned, disposable localhost live-test work.

Profiles and family relations are created later through the public API in the E2E test.
No credentials or API tokens are printed; the existing local-live-account fixture owns cleanup.
"""
import argparse
import json
import os
import uuid
from urllib.parse import urlsplit
import psycopg

parser = argparse.ArgumentParser()
parser.add_argument('--work-id', type=uuid.UUID, required=True)
parser.add_argument('--member-id', type=int, required=True)
parser.add_argument('--email', required=True)
args = parser.parse_args()
if not args.email.startswith('image-live-') or not args.email.endswith('@local.invalid'):
    raise RuntimeError('Only a generated disposable fixture account is allowed.')
dsn = os.environ['CATCHHOLE_E2E_DATABASE_URL']
api = os.environ['CATCHHOLE_E2E_API_BASE_URL']
for address in (dsn, api):
    if urlsplit(address).hostname not in ('localhost', '127.0.0.1', '::1'):
        raise RuntimeError('This fixture requires an explicitly configured localhost API and database.')
if urlsplit(dsn).path in ('', '/', '/postgres', '/template0', '/template1'):
    raise RuntimeError('Use a dedicated local fixture database.')
characters = {name: str(uuid.uuid4()) for name in ('서준', '민지', '도윤')}
with psycopg.connect(dsn) as connection, connection.cursor() as cur:
    cur.execute('''SELECT w.id FROM works w JOIN members m ON m.id=w.member_id
        WHERE w.id=%s AND w.member_id=%s AND m.email=%s AND w.lifecycle_status='ACTIVE' FOR UPDATE OF w''',
        (args.work_id, args.member_id, args.email))
    if cur.fetchone() is None:
        raise RuntimeError('Disposable account does not own this active work.')
    cur.execute('SELECT count(*) FROM characters WHERE work_id=%s', (args.work_id,))
    if cur.fetchone()[0] != 0:
        raise RuntimeError('This fixture requires a new empty work.')
    for name, character_id in characters.items():
        cur.execute('''INSERT INTO characters(id,work_id,name,status,snapshot_version,created_at,updated_at)
            VALUES(%s,%s,%s,'ACTIVE',0,now(),now())''', (character_id, args.work_id, name))
print(json.dumps(characters, ensure_ascii=False))
