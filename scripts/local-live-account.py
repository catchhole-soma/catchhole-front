"""Local PostgreSQL fixture only; clones a dedicated test account, never signs up or sends mail."""
import argparse
import json
import os
import time
import uuid
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import psycopg

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['create', 'cleanup'])
parser.add_argument('--character', action='store_true')
parser.add_argument('--member-id', type=int)
parser.add_argument('--email')
args = parser.parse_args()
dsn = os.environ['CATCHHOLE_E2E_DATABASE_URL']
api = os.environ['CATCHHOLE_E2E_API_BASE_URL'].rstrip('/')
for address in (dsn, api):
    if urlsplit(address).hostname not in ('localhost', '127.0.0.1', '::1'):
        raise RuntimeError('Fixture requires an explicitly configured localhost database and API.')
if urlsplit(dsn).path in ('', '/', '/postgres', '/template0', '/template1'):
    raise RuntimeError('Use a dedicated local fixture database.')
seed_email = os.environ['CATCHHOLE_E2E_SEED_EMAIL']
password = os.environ['CATCHHOLE_E2E_SEED_PASSWORD']

def call(path, body=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = Request(api + '/api/v1' + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
    with urlopen(req, timeout=15) as response:
        return json.load(response)['data']

if args.action == 'create':
    email = 'image-live-' + uuid.uuid4().hex + '@local.invalid'
    with psycopg.connect(dsn) as connection, connection.cursor() as cur:
        cur.execute("""INSERT INTO members (email,password_hash,phone_verified,email_verified,display_name,status,role,created_at,updated_at)
            SELECT %s,password_hash,false,true,'이미지 테스트','ACTIVE','AUTHOR',now(),now()
            FROM members WHERE email=%s AND status='ACTIVE' RETURNING id""", (email, seed_email))
        member = cur.fetchone()
        if member is None:
            raise RuntimeError('Dedicated seed account was not found.')
        result = {'memberId': member[0], 'email': email}
        if args.character:
            work_id, character_id = uuid.uuid4(), uuid.uuid4()
            cur.execute("""INSERT INTO works(id,member_id,title,genre,latest_episode_no,lifecycle_status,created_at,updated_at)
                VALUES(%s,%s,'캐릭터 이미지 검증','FANTASY',0,'ACTIVE',now(),now())""", (work_id, member[0]))
            cur.execute("""INSERT INTO characters(id,work_id,name,status,snapshot_version,created_at,updated_at)
                VALUES(%s,%s,'이름만 있는 인물','ACTIVE',0,now(),now())""", (character_id, work_id))
            result.update(workId=str(work_id), characterId=str(character_id))
    print(json.dumps(result))
else:
    if not args.member_id or not args.email or not args.email.startswith('image-live-') or not args.email.endswith('@local.invalid'):
        raise RuntimeError('Only generated fixture accounts can be cleaned up.')
    token = call('/auth/login', {'email': args.email, 'password': password})['accessToken']
    for work in call('/works', token=token):
        job = call('/works/' + work['id'], {'confirmation': '영구 삭제'}, token, 'DELETE')
        for _ in range(120):
            state = call('/works/purge-requests/' + job['requestId'], token=token)
            if state['status'] == 'COMPLETED':
                break
            if state['status'] in ('FAILED', 'PARTIAL_FAILED'):
                raise RuntimeError('Fixture work purge failed; account preserved for inspection.')
            time.sleep(.5)
        else:
            raise RuntimeError('Fixture work purge timed out; account preserved for inspection.')
    with psycopg.connect(dsn) as connection, connection.cursor() as cur:
        cur.execute('SELECT id FROM members WHERE id=%s AND email=%s FOR UPDATE', (args.member_id, args.email))
        if cur.fetchone() is None:
            raise RuntimeError('Fixture identity did not match.')
        cur.execute('SELECT count(*) FROM works WHERE member_id=%s', (args.member_id,))
        if cur.fetchone()[0] != 0:
            raise RuntimeError('Fixture still has works; account preserved.')
        cur.execute('DELETE FROM refresh_tokens WHERE member_id=%s', (args.member_id,))
        cur.execute('DELETE FROM work_purge_requests WHERE member_id=%s', (args.member_id,))
        cur.execute('DELETE FROM members WHERE id=%s AND email=%s', (args.member_id, args.email))
