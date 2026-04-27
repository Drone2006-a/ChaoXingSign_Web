import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CryptoJS from 'crypto-js';
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Code2,
  Download,
  Eye,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Plus,
  QrCode,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import './styles.css';

const COMM_AES_KEY = 'c4ok6lu^oWp4_COM';
const COMM_AES_IV = 'c4ok6lu^oWp4_COM';
const COMM_SIGN_KEY = 'comm_sign_key_2026';
const STORAGE_COOKIE = 'chaoxing_web_state';
const COOKIE_CHUNK_PREFIX = `${STORAGE_COOKIE}_`;
const COOKIE_MAX = 2800;
const CLOUD_API_URL = 'https://tk.udrone.vip/api.php';
const CHAOXING_PASSPORT_URL = 'https://passport2.chaoxing.com';
const CHAOXING_PASSPORT_API_URL = 'https://passport2-api.chaoxing.com';

const defaultState = {
  users: [],
  currentPhone: '',
  settings: {
    notifications: true,
    bypassCaptcha: false,
    batchSignIn: false,
    customNameEnabled: false,
    customName: '',
    developerMode: false,
  },
  signHistory: [],
};

function readCookie(name) {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

function writeCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function loadState() {
  try {
    const chunkCount = Number(readCookie(`${STORAGE_COOKIE}_chunks`) || 0);
    const raw = chunkCount
      ? Array.from({ length: chunkCount }, (_, index) => readCookie(`${COOKIE_CHUNK_PREFIX}${index}`) || '').join('')
      : readCookie(STORAGE_COOKIE);

    if (!raw) return defaultState;
    const parsed = JSON.parse(decodeURIComponent(raw));
    return {
      ...defaultState,
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      users: Array.isArray(parsed.users) ? parsed.users : [],
      signHistory: Array.isArray(parsed.signHistory) ? parsed.signHistory : [],
    };
  } catch {
    return defaultState;
  }
}

function saveState(nextState) {
  const encoded = encodeURIComponent(JSON.stringify(nextState));
  const oldChunkCount = Number(readCookie(`${STORAGE_COOKIE}_chunks`) || 0);
  removeCookie(STORAGE_COOKIE);
  for (let i = 0; i < oldChunkCount; i += 1) removeCookie(`${COOKIE_CHUNK_PREFIX}${i}`);

  if (encoded.length <= COOKIE_MAX) {
    removeCookie(`${STORAGE_COOKIE}_chunks`);
    writeCookie(STORAGE_COOKIE, encoded);
    return;
  }

  const chunks = encoded.match(new RegExp(`.{1,${COOKIE_MAX}}`, 'g')) || [];
  writeCookie(`${STORAGE_COOKIE}_chunks`, String(chunks.length));
  chunks.forEach((chunk, index) => writeCookie(`${COOKIE_CHUNK_PREFIX}${index}`, chunk));
}

function useCookieState() {
  const [state, setState] = useState(loadState);
  const commit = updater => {
    setState(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveState(next);
      return next;
    });
  };
  return [state, commit];
}

function getCloudEndpoint() {
  return import.meta.env.VITE_CLOUD_API_URL || (import.meta.env.PROD ? CLOUD_API_URL : '/cloud-api');
}

async function cloudCall(params) {
  const json = JSON.stringify(params);
  const payload = CryptoJS.AES.encrypt(json, CryptoJS.enc.Utf8.parse(COMM_AES_KEY), {
    iv: CryptoJS.enc.Utf8.parse(COMM_AES_IV),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = CryptoJS.MD5(payload + timestamp + COMM_SIGN_KEY).toString();
  const body = new URLSearchParams({ payload, sign, t: timestamp });

  const response = await fetch(getCloudEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const encrypted = await response.text();
  if (!response.ok) throw new Error(`云端接口错误 ${response.status}`);
  const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Utf8.parse(COMM_AES_KEY), {
    iv: CryptoJS.enc.Utf8.parse(COMM_AES_IV),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
  const parsed = JSON.parse(decrypted);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.result;
}

function resolveApiUrl(url) {
  if (!import.meta.env.PROD) return url;
  if (url.startsWith('/chaoxing-passport-api')) {
    return `${CHAOXING_PASSPORT_API_URL}${url.replace('/chaoxing-passport-api', '')}`;
  }
  if (url.startsWith('/chaoxing-passport')) {
    return `${CHAOXING_PASSPORT_URL}${url.replace('/chaoxing-passport', '')}`;
  }
  return url;
}

async function postForm(url, params) {
  const response = await fetch(resolveApiUrl(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
    credentials: 'include',
  });
  const text = await response.text();
  return JSON.parse(text);
}

function maskPhone(phone = '') {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(7)}` : phone;
}

function createUser(phone, cookies = {}) {
  return {
    phone,
    uid: cookies._uid || '',
    name: '',
    uname: '',
    nick: '',
    schoolname: '',
    dept: '',
    fid: '',
    dwcode: '',
    puid: '',
    facePhoto: '',
    signLocationName: '',
    signLongitude: '',
    signLatitude: '',
    cookies,
  };
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type || ''}`}>
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="关闭提示">
        <X size={16} />
      </button>
    </div>
  );
}

function Modal({ title, children, onClose, actions }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useCookieState();
  const [screen, setScreen] = useState(state.currentPhone ? 'main' : 'login');
  const [tab, setTab] = useState('users');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const currentUser = useMemo(
    () => state.users.find(user => user.phone === state.currentPhone) || null,
    [state.users, state.currentPhone],
  );

  const notify = (message, type = '') => {
    setToast({ message, type });
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 3000);
  };

  const upsertUser = user => {
    setState(current => {
      const exists = current.users.some(item => item.phone === user.phone);
      const users = exists
        ? current.users.map(item => (item.phone === user.phone ? { ...item, ...user } : item))
        : [...current.users, user];
      return {
        ...current,
        users,
        currentPhone: user.phone,
      };
    });
  };

  const switchUser = phone => {
    setState(current => ({ ...current, currentPhone: phone }));
    notify(`已切换到 ${phone}`, 'success');
  };

  const deleteUser = phone => {
    setState(current => {
      const users = current.users.filter(user => user.phone !== phone);
      return {
        ...current,
        users,
        currentPhone: current.currentPhone === phone ? users[0]?.phone || '' : current.currentPhone,
      };
    });
    notify('账号已删除', 'success');
  };

  const updateSettings = patch => {
    setState(current => ({ ...current, settings: { ...current.settings, ...patch } }));
  };

  const logout = () => {
    setState(current => ({ ...current, currentPhone: '' }));
    setScreen('login');
    notify('已退出当前账号');
  };

  if (screen === 'login') {
    return (
      <>
        <LoginView
          users={state.users}
          onLogin={user => {
            upsertUser(user);
            setScreen('main');
            setTab('users');
            notify('登录信息已保存到浏览器 Cookie', 'success');
          }}
          onSwitchUser={() => {
            setScreen('main');
            setTab('users');
          }}
          notify={notify}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="phone-shell">
      <main className="content">
        {tab === 'users' && (
          <UsersView
            users={state.users}
            currentPhone={state.currentPhone}
            onAdd={() => setScreen('login')}
            onSwitch={switchUser}
            onDelete={deleteUser}
            onModal={setModal}
            onUpdateUser={upsertUser}
          />
        )}
        {tab === 'sign' && (
          <SignInView
            currentUser={currentUser}
            settings={state.settings}
            history={state.signHistory}
            notify={notify}
            onHistory={item => setState(current => ({ ...current, signHistory: [item, ...current.signHistory].slice(0, 20) }))}
          />
        )}
        {tab === 'settings' && (
          <SettingsView
            state={state}
            currentUser={currentUser}
            updateSettings={updateSettings}
            logout={logout}
            notify={notify}
            onModal={setModal}
            clearAll={() => {
              saveState(defaultState);
              setState(defaultState);
              setScreen('login');
            }}
          />
        )}
        {tab === 'developer' && <DeveloperView state={state} setState={setState} notify={notify} />}
      </main>
      <nav className="bottom-nav">
        <NavButton active={tab === 'users'} icon={<UserRound />} label="用户" onClick={() => setTab('users')} />
        <NavButton active={tab === 'sign'} icon={<QrCode />} label="签到" onClick={() => setTab('sign')} />
        <NavButton active={tab === 'settings'} icon={<Settings />} label="设置" onClick={() => setTab('settings')} />
        {state.settings.developerMode && (
          <NavButton active={tab === 'developer'} icon={<Code2 />} label="开发者" onClick={() => setTab('developer')} />
        )}
      </nav>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {modal}
    </div>
  );
}

function LoginView({ users, onLogin, onSwitchUser, notify }) {
  const [mode, setMode] = useState('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [manualCookies, setManualCookies] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const parseManualCookies = () => {
    if (!manualCookies.trim()) return {};
    return manualCookies.split(';').reduce((acc, part) => {
      const [key, ...value] = part.trim().split('=');
      if (key && value.length) acc[key] = value.join('=');
      return acc;
    }, {});
  };

  const finishLogin = cookies => {
    onLogin(createUser(phone, cookies));
  };

  const handlePasswordLogin = async event => {
    event.preventDefault();
    if (!phone.trim()) return notify('请输入手机号', 'error');
    if (mode === 'password' && !password.trim()) return notify('请输入密码', 'error');
    if (mode === 'code' && !code.trim()) return notify('请输入验证码', 'error');

    const manual = parseManualCookies();
    if (Object.keys(manual).length) {
      finishLogin(manual);
      return;
    }

    try {
      setLoading(true);
      if (mode === 'password') {
        const encryptedPhone = await cloudCall({ action: 'encrypt_aes', data: phone });
        const encryptedPassword = await cloudCall({ action: 'encrypt_aes', data: password });
        const result = await postForm('/chaoxing-passport/fanyalogin', {
          fid: '-1',
          uname: encryptedPhone,
          password: encryptedPassword,
          refer: 'https%3A%2F%2Fwww.chaoxing.com%2F',
          t: 'true',
          forbidotherlogin: '0',
          validate: '',
          doubleFactorLogin: '0',
          independentId: '0',
          independentNameId: '0',
        });
        if (result.status || result.result || result.msg === 'ok') {
          finishLogin({});
        } else {
          notify(result.msg2 || result.mes || '登录接口返回失败，可粘贴 Cookies 后保存', 'error');
        }
      } else {
        const logininfo = await cloudCall({ action: 'encrypt_login', phone, code });
        const result = await postForm('/chaoxing-passport-api/v11/loginregister?cx_xxt_passport=json', {
          logininfo,
          countrycode: '86',
          loginType: '2',
          roleSelect: 'true',
          entype: '1',
        });
        if (result.url) finishLogin({});
        else notify(result.mes || '验证码登录失败，可粘贴 Cookies 后保存', 'error');
      }
    } catch (error) {
      notify(`${error.message}。浏览器可能拦截跨域登录，可粘贴 Cookies 后保存。`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    if (!phone.trim()) return notify('请输入手机号', 'error');
    try {
      setLoading(true);
      const timestamp = Date.now().toString();
      const enc = await cloudCall({ action: 'calculate_enc', phone, timestamp });
      await postForm('/chaoxing-passport-api/api/sendcaptcha', {
        to: phone,
        countrycode: '86',
        time: timestamp,
        enc,
      });
      setCountdown(60);
      const timer = window.setInterval(() => {
        setCountdown(value => {
          if (value <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return value - 1;
        });
      }, 1000);
      notify('验证码已发送', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={handlePasswordLogin}>
        <img className="logo" src="/logo.png" alt="超星签到助手" />
        <h1>超星签到助手</h1>
        <p>从老师的手中解放</p>
        <div className="tabs" role="tablist">
          <button type="button" className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')}>
            密码登录
          </button>
          <button type="button" className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>
            验证码登录
          </button>
        </div>
        <Field icon={<Smartphone size={20} />} label="手机号">
          <input value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" maxLength={11} />
        </Field>
        {mode === 'password' ? (
          <Field icon={<LockKeyhole size={20} />} label="密码">
            <input value={password} onChange={event => setPassword(event.target.value)} type="password" />
          </Field>
        ) : (
          <div className="inline-field">
            <Field icon={<ShieldCheck size={20} />} label="验证码">
              <input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" maxLength={6} />
            </Field>
            <button type="button" className="secondary-button" disabled={loading || countdown > 0} onClick={sendCode}>
              {countdown > 0 ? `${countdown}秒` : '发送验证码'}
            </button>
          </div>
        )}
        <label className="manual-cookie">
          <span>Cookies</span>
          <textarea
            value={manualCookies}
            onChange={event => setManualCookies(event.target.value)}
            placeholder="_uid=...; UID=...; fid=..."
          />
        </label>
        <button className="primary-button tall" type="submit" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
        <button className="text-link" type="button" onClick={onSwitchUser} disabled={!users.length}>
          切换用户
        </button>
        <span className="version">v1.0.3.10260</span>
      </form>
    </div>
  );
}

function Field({ icon, label, children }) {
  return (
    <label className="field">
      <span className="field-icon">{icon}</span>
      <span className="floating-label">{label}</span>
      {children}
    </label>
  );
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {React.cloneElement(icon, { size: 24 })}
      <span>{label}</span>
    </button>
  );
}

function Toolbar({ title, action }) {
  return (
    <header className="toolbar">
      <h2>{title}</h2>
      {action}
    </header>
  );
}

function UsersView({ users, currentPhone, onAdd, onSwitch, onDelete, onModal, onUpdateUser }) {
  const showCookies = user => {
    const body = Object.keys(user.cookies || {}).length
      ? Object.entries(user.cookies).map(([key, value]) => `${key}: ${value}`).join('\n')
      : '暂无 Cookies 信息';
    onModal(
      <Modal title={`Cookies 信息 - ${user.phone}`} onClose={() => onModal(null)}>
        <pre className="code-block">{body}</pre>
      </Modal>,
    );
  };

  const editLocation = user => {
    let locationName = user.signLocationName || '';
    let longitude = user.signLongitude || '';
    let latitude = user.signLatitude || '';
    onModal(
      <Modal
        title="设置签到地点"
        onClose={() => onModal(null)}
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onUpdateUser({ ...user, signLocationName: locationName, signLongitude: longitude, signLatitude: latitude });
              onModal(null);
            }}
          >
            保存
          </button>
        }
      >
        <input className="plain-input" placeholder="地点名称" defaultValue={locationName} onChange={e => (locationName = e.target.value)} />
        <input className="plain-input" placeholder="经度" defaultValue={longitude} onChange={e => (longitude = e.target.value)} />
        <input className="plain-input" placeholder="纬度" defaultValue={latitude} onChange={e => (latitude = e.target.value)} />
      </Modal>,
    );
  };

  return (
    <section className="page">
      <Toolbar
        title="已登录用户"
        action={
          <button type="button" className="icon-button" onClick={() => onModal(<UserInfoModal user={users.find(u => u.phone === currentPhone)} onClose={() => onModal(null)} />)} aria-label="用户信息">
            <Info size={22} />
          </button>
        }
      />
      <div className="scroll-area">
        {users.length ? (
          <div className="user-list">
            {users.map(user => (
              <article className="user-card" key={user.phone}>
                <div className="avatar">
                  {user.facePhoto ? <img src={user.facePhoto} alt={user.name || user.phone} /> : <CircleUserRound size={38} />}
                </div>
                <div className="user-main">
                  <div className="user-heading">
                    <h3>{user.name || user.nick || maskPhone(user.phone)}</h3>
                    {user.phone === currentPhone && <span>当前</span>}
                  </div>
                  <p>{user.phone}</p>
                  <p>{user.uname ? `学号: ${user.uname}` : '学号: 暂无'}</p>
                  <p>{user.schoolname ? `学校: ${user.schoolname}` : '学校: 暂无'}</p>
                </div>
                <div className="button-strip">
                  <button type="button" onClick={() => onSwitch(user.phone)}>切换</button>
                  <button type="button" onClick={() => showCookies(user)}>查看Cookies</button>
                  <label>
                    设置人脸
                    <input
                      type="file"
                      accept="image/*"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => onUpdateUser({ ...user, facePhoto: reader.result });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => editLocation(user)}>设置签到地点</button>
                  <button type="button" className="danger-text" onClick={() => onDelete(user.phone)}>删除</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">暂无已登录账号</div>
        )}
      </div>
      <button className="fab" type="button" onClick={onAdd} aria-label="添加账号">
        <Plus size={28} />
      </button>
    </section>
  );
}

function UserInfoModal({ user, onClose }) {
  const lines = user
    ? [
        ['手机号', user.phone],
        ['姓名', user.name],
        ['学号', user.uname],
        ['昵称', user.nick],
        ['学校', user.schoolname],
        ['院系', user.dept],
        ['UID', user.uid],
        ['FID', user.fid],
        ['DWCode', user.dwcode],
      ].filter(([, value]) => value)
    : [];
  return (
    <Modal title="当前用户信息" onClose={onClose}>
      {lines.length ? lines.map(([key, value]) => <p className="info-line" key={key}><b>{key}</b>{value}</p>) : <p>暂无已登录用户</p>}
    </Modal>
  );
}

function SignInView({ currentUser, settings, history, notify, onHistory }) {
  const [qrValue, setQrValue] = useState('');

  const handleScan = () => {
    if (!qrValue.trim()) {
      notify('请先粘贴二维码链接或扫码结果', 'error');
      return;
    }
    const item = {
      id: Date.now(),
      time: new Date().toLocaleString('zh-CN'),
      course: currentUser?.name || currentUser?.phone || '未选择用户',
      status: '已打开签到链接',
      url: qrValue,
    };
    onHistory(item);
    window.open(qrValue, '_blank', 'noopener,noreferrer');
    notify(settings.batchSignIn ? '正在启动批量签到...' : '已打开签到页面', 'success');
  };

  return (
    <section className="page">
      <Toolbar title="签到中心" />
      <div className="scroll-area padded">
        <article className="scan-card" onClick={() => document.getElementById('qrInput')?.focus()}>
          <QrCode size={82} />
          <h3>扫码签到</h3>
          <p>将二维码链接或扫码内容放入下方</p>
          <textarea id="qrInput" value={qrValue} onChange={event => setQrValue(event.target.value)} placeholder="https://..." />
          <button type="button" className="primary-button pill" onClick={handleScan}>
            <QrCode size={18} /> 扫码签到
          </button>
        </article>
        <section className="history">
          <h3>签到记录</h3>
          {history.length ? history.map(item => (
            <article key={item.id} className="history-item">
              <Check size={20} />
              <div>
                <strong>{item.status}</strong>
                <span>{item.course}</span>
                <small>{item.time}</small>
              </div>
            </article>
          )) : <div className="empty compact">暂无签到记录</div>}
        </section>
      </div>
    </section>
  );
}

function SettingsView({ state, currentUser, updateSettings, logout, notify, onModal, clearAll }) {
  const setDeveloperMode = async enabled => {
    if (!enabled) {
      updateSettings({ developerMode: false });
      return;
    }
    let password = '';
    onModal(
      <Modal
        title="请输入开发者密码"
        onClose={() => onModal(null)}
        actions={
          <button
            className="primary-button"
            type="button"
            onClick={async () => {
              try {
                const result = await cloudCall({ action: 'verify_developer', password });
                if (result === true || result === 'true') {
                  updateSettings({ developerMode: true });
                  notify('开发者模式已开启', 'success');
                  onModal(null);
                } else {
                  notify('密码错误', 'error');
                }
              } catch (error) {
                notify(error.message, 'error');
              }
            }}
          >
            确定
          </button>
        }
      >
        <input className="plain-input" type="password" onChange={event => (password = event.target.value)} />
      </Modal>,
    );
  };

  const setCustomName = enabled => {
    if (!enabled) {
      updateSettings({ customNameEnabled: false, customName: '' });
      return;
    }
    if (state.settings.batchSignIn) {
      notify('更改姓名与批量签到不能同时使用，请先关闭批量签到', 'error');
      return;
    }
    let customName = state.settings.customName || '';
    onModal(
      <Modal
        title="更改姓名"
        onClose={() => onModal(null)}
        actions={
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              if (!customName.trim()) return notify('姓名不能为空', 'error');
              updateSettings({ customNameEnabled: true, customName: customName.trim() });
              onModal(null);
            }}
          >
            确定
          </button>
        }
      >
        <p className="muted">输入的姓名将在签到时替换真实姓名提交。</p>
        <input className="plain-input" defaultValue={customName} onChange={event => (customName = event.target.value)} />
      </Modal>,
    );
  };

  const accountLines = currentUser
    ? `手机号: ${currentUser.phone}\n姓名: ${currentUser.name || '暂无'}\n学号: ${currentUser.uname || '暂无'}\n学校: ${currentUser.schoolname || '暂无'}\nUID: ${currentUser.uid || '暂无'}`
    : '未登录';

  return (
    <section className="page">
      <Toolbar title="设置" />
      <div className="scroll-area padded">
        <SettingsGroup title="账号设置">
          <SettingRow icon={<UserRound />} label="账号设置" onClick={() => onModal(<Modal title="账号信息" onClose={() => onModal(null)}><pre className="code-block">{accountLines}</pre></Modal>)} />
          <SettingRow icon={<Bell />} label="通知设置" control={<Switch checked={state.settings.notifications} onChange={value => updateSettings({ notifications: value })} />} />
        </SettingsGroup>
        <SettingsGroup title="签到设置">
          <SettingRow icon={<LockKeyhole />} label="绕过签到验证码" control={<Switch checked={state.settings.bypassCaptcha} onChange={value => updateSettings({ bypassCaptcha: value })} />} />
          <SettingRow
            icon={<QrCode />}
            label="开启批量签到"
            control={
              <Switch
                checked={state.settings.batchSignIn}
                onChange={value => {
                  updateSettings(value ? { batchSignIn: true, customNameEnabled: false, customName: '' } : { batchSignIn: false });
                }}
              />
            }
          />
          <SettingRow
            icon={<UserRound />}
            label="更改姓名"
            hint={state.settings.customNameEnabled ? `当前自定义姓名: ${state.settings.customName}` : ''}
            control={<Switch checked={state.settings.customNameEnabled} onChange={setCustomName} />}
          />
        </SettingsGroup>
        <SettingsGroup title="关于我们">
          <SettingRow icon={<Info />} label="关于我们" onClick={() => onModal(<Modal title="关于我们" onClose={() => onModal(null)}><p>超星签到助手<br />版本: 1.0.3.10260<br /><br />仅供学习使用</p></Modal>)} />
          <SettingRow icon={<Trash2 />} label="清除缓存" onClick={() => notify('缓存已清除', 'success')} />
          <SettingRow icon={<Code2 />} label="开发者模式" control={<Switch checked={state.settings.developerMode} onChange={setDeveloperMode} />} />
        </SettingsGroup>
        <button type="button" className="outline-danger" onClick={logout}>
          <LogOut size={18} /> 退出登录
        </button>
        <button type="button" className="outline-muted" onClick={clearAll}>
          <Trash2 size={18} /> 清空浏览器数据
        </button>
      </div>
    </section>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <section className="settings-group">
      <h3>{title}</h3>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function SettingRow({ icon, label, hint, control, onClick }) {
  return (
    <button type="button" className="setting-row" onClick={onClick}>
      <span className="setting-icon">{React.cloneElement(icon, { size: 24 })}</span>
      <span className="setting-label">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      {control || <ChevronRight size={20} />}
    </button>
  );
}

function Switch({ checked, onChange }) {
  return (
    <span
      className={`switch ${checked ? 'checked' : ''}`}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={event => {
        event.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') onChange(!checked);
      }}
    >
      <span />
    </span>
  );
}

function DeveloperView({ state, setState, notify }) {
  const exportAccounts = () => {
    const blob = new Blob([JSON.stringify({ accounts: state.users.map(user => ({ user, cookies: user.cookies })) }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chaoxing_accounts_backup.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importAccounts = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        const imported = (backup.accounts || []).map(item => ({ ...item.user, cookies: item.cookies || item.user?.cookies || {} }));
        setState(current => ({ ...current, users: imported, currentPhone: imported[0]?.phone || current.currentPhone }));
        notify(`导入成功，共导入 ${imported.length} 个账号`, 'success');
      } catch (error) {
        notify('无效的备份文件', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="page">
      <Toolbar title="开发者模式" />
      <div className="scroll-area padded">
        <article className="developer-card">
          <h3>账号管理</h3>
          <p>备份或还原所有账号数据，包括 Cookies 和 SwitchInfo。</p>
          <div className="developer-actions">
            <button type="button" className="outline-button" onClick={exportAccounts}>
              <Download size={18} /> 导出账号
            </button>
            <label className="outline-button">
              <Upload size={18} /> 导入账号
              <input type="file" accept="application/json" onChange={importAccounts} />
            </label>
          </div>
        </article>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
