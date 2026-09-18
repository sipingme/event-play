"""Personal accounts; opaque, expiring sessions backed by the existing database.

The browser only receives an HttpOnly cookie through the Next.js BFF. Legacy
workspace capabilities remain separate and are never implicitly claimed.
"""
import asyncio
import hashlib
import json
import re
import secrets
import time

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field, field_validator

SESSION_SECONDS = 7 * 24 * 3600


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=32768,
                           r=8, p=3, maxmem=64 * 1024 * 1024).hex()
    return salt + ':' + value


def verify_password(password, encoded):
    return secrets.compare_digest(password_hash(password, encoded.split(':')[0]), encoded)


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator('email')
    @classmethod
    def email_address(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('请输入有效邮箱')
        return value


class PasswordChange(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=10, max_length=128)


class Brand(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default='#f59e0b', pattern=r'^#[0-9a-fA-F]{6}$')
    logo: str = Field(default='', max_length=700000)

    @field_validator('logo')
    @classmethod
    def image(cls, value):
        if value and not value.startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,')):
            raise ValueError('仅支持 PNG/JPEG/WebP Logo')
        return value


class Accounts:
    def __init__(self, db):
        self.db = db
        db.execute('CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, workspace TEXT UNIQUE NOT NULL, created REAL NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS account_sessions (hash TEXT PRIMARY KEY, account TEXT NOT NULL, expires REAL NOT NULL)')
        db.execute('CREATE INDEX IF NOT EXISTS session_account ON account_sessions(account)')
        db.execute('CREATE TABLE IF NOT EXISTS account_attempts (key TEXT NOT NULL, at REAL NOT NULL)')
        db.execute('CREATE INDEX IF NOT EXISTS attempt_time ON account_attempts(at)')
        db.execute('CREATE TABLE IF NOT EXISTS workspace_brands (owner TEXT PRIMARY KEY, body TEXT NOT NULL)')
        db.commit()
        self.dummy = password_hash('not-a-real-account-password')

    def limit(self, key):
        now = time.time()
        self.db.execute('DELETE FROM account_attempts WHERE at < ?', (now - 300,))
        total = self.db.execute('SELECT count(*) FROM account_attempts').fetchone()[0]
        attempts = self.db.execute('SELECT count(*) FROM account_attempts WHERE key=?', (key,)).fetchone()[0]
        if total >= 200 or attempts >= 15:
            self.db.commit()
            raise HTTPException(429, '尝试过于频繁，请在五分钟后重试')
        self.db.execute('INSERT INTO account_attempts VALUES (?,?)', (key, now))
        self.db.commit()

    def identity(self, token):
        if not token:
            raise HTTPException(401, '请先登录账号')
        row = self.db.execute('SELECT a.id,a.email,a.workspace FROM account_sessions s JOIN accounts a ON a.id=s.account WHERE s.hash=? AND s.expires>?', (digest(token), time.time())).fetchone()
        if not row:
            raise HTTPException(401, '登录已失效，请重新登录')
        return dict(id=row[0], email=row[1], workspace=row[2])

    def workspace(self, token):
        # Account sessions cannot become permanent legacy workspace capabilities.
        return self.identity(token)['workspace']

    def session(self, account):
        self.db.execute('DELETE FROM account_sessions WHERE expires <= ?', (time.time(),))
        # Retain at most ten recent device sessions per account.
        self.db.execute('DELETE FROM account_sessions WHERE account=? AND hash NOT IN (SELECT hash FROM account_sessions WHERE account=? ORDER BY expires DESC LIMIT 9)', (account, account))
        token = 'ep_session_' + secrets.token_urlsafe(32)
        self.db.execute('INSERT INTO account_sessions VALUES (?,?,?)', (digest(token), account, time.time() + SESSION_SECONDS))
        self.db.commit()
        return dict(token=token, expiresIn=SESSION_SECONDS, user=self.identity(token))


def install(app, db, lock):
    accounts = Accounts(db)
    hash_slots = asyncio.Semaphore(2)

    async def hash_work(function, *args):
        # Slow password hashing must not hold the game's state lock.
        async with hash_slots:
            return await asyncio.to_thread(function, *args)

    def token(header):
        return header[7:] if header.startswith('Bearer ') else ''

    @app.post('/accounts/register')
    async def register(data: Credentials):
        async with lock:
            accounts.limit(digest(data.email))
            if db.execute('SELECT count(*) FROM accounts').fetchone()[0] >= 20000:
                raise HTTPException(429, '注册容量已满，请联系管理员')
        encoded = await hash_work(password_hash, data.password)
        async with lock:
            # No email-ownership claims are made before a mail provider is added.
            if db.execute('SELECT 1 FROM accounts WHERE email=?', (data.email,)).fetchone():
                raise HTTPException(409, '无法使用该邮箱注册，请登录或联系管理员')
            aid = secrets.token_urlsafe(16)
            owner = digest(secrets.token_urlsafe(32))
            with db:
                db.execute('INSERT INTO workspaces VALUES (?)', (owner,))
                db.execute('INSERT INTO accounts VALUES (?,?,?,?,?)', (aid, data.email, encoded, owner, time.time()))
            return accounts.session(aid)

    @app.post('/accounts/login')
    async def login(data: Credentials):
        async with lock:
            accounts.limit(digest(data.email))
            row = db.execute('SELECT id,password FROM accounts WHERE email=?', (data.email,)).fetchone()
        valid = await hash_work(verify_password, data.password, row[1] if row else accounts.dummy)
        async with lock:
            if not row or not valid:
                raise HTTPException(401, '邮箱或密码错误')
            if db.execute('SELECT password FROM accounts WHERE id=?', (row[0],)).fetchone()[0] != row[1]:
                raise HTTPException(401, '密码已更新，请重新登录')
            return accounts.session(row[0])

    @app.get('/accounts/me')
    async def me(authorization: str = Header(default='')):
        async with lock:
            return accounts.identity(token(authorization))

    @app.post('/accounts/logout')
    async def logout(authorization: str = Header(default='')):
        async with lock:
            db.execute('DELETE FROM account_sessions WHERE hash=?', (digest(token(authorization)),))
            db.commit()
            return {'ok': True}

    @app.post('/accounts/password')
    async def change_password(data: PasswordChange, authorization: str = Header(default='')):
        async with lock:
            user = accounts.identity(token(authorization))
            accounts.limit(digest(user['email']))
            old = db.execute('SELECT password FROM accounts WHERE id=?', (user['id'],)).fetchone()[0]
        if not await hash_work(verify_password, data.currentPassword, old):
            raise HTTPException(400, '当前密码错误')
        encoded = await hash_work(password_hash, data.password)
        async with lock:
            accounts.identity(token(authorization))
            if db.execute('SELECT password FROM accounts WHERE id=?', (user['id'],)).fetchone()[0] != old:
                raise HTTPException(409, '密码已更新，请重新登录')
            with db:
                db.execute('UPDATE accounts SET password=? WHERE id=?', (encoded, user['id']))
                db.execute('DELETE FROM account_sessions WHERE account=?', (user['id'],))
            return accounts.session(user['id'])

    @app.get('/accounts/brand')
    async def brand(authorization: str = Header(default='')):
        async with lock:
            owner = accounts.workspace(token(authorization))
            row = db.execute('SELECT body FROM workspace_brands WHERE owner=?', (owner,)).fetchone()
            return json.loads(row[0]) if row else dict(name='', color='#f59e0b', logo='')

    @app.post('/accounts/brand')
    async def save_brand(data: Brand, authorization: str = Header(default='')):
        async with lock:
            owner = accounts.workspace(token(authorization))
            db.execute('INSERT OR REPLACE INTO workspace_brands VALUES (?,?)', (owner, json.dumps(data.model_dump())))
            db.commit()
            return data

    return accounts
