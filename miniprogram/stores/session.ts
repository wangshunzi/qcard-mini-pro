import {
  invalidateData,
  trackVipExpiry,
  type DataDomain,
} from "./dataInvalidation";

const SESSION_KEY = "qcard.session.v1";

const SESSION_DATA_DOMAINS: DataDomain[] = [
  "account",
  "wallet",
  "learning",
  "content",
  "favorites",
  "orders",
  "challenge",
];

export interface SessionUser {
  id: string;
  phoneNumber?: string;
  nickname?: string;
  avatar?: string;
  primaryLoginType: string;
}

export interface SessionState {
  accessToken: string;
  sessionId?: string;
  user: SessionUser;
}

type Listener = (state: SessionState | null) => void;

class SessionStore {
  private state: SessionState | null = null;
  private listeners = new Set<Listener>();

  hydrate() {
    const saved = wx.getStorageSync(SESSION_KEY) as SessionState | undefined;
    this.state = saved?.accessToken ? saved : null;
    this.emit();
  }

  getState() {
    return this.state;
  }

  setSession(session: SessionState) {
    const changedUser = this.state?.user.id !== session.user.id;
    this.state = session;
    wx.setStorageSync(SESSION_KEY, session);
    if (changedUser) invalidateData(...SESSION_DATA_DOMAINS);
    this.emit();
  }

  clear() {
    this.state = null;
    wx.removeStorageSync(SESSION_KEY);
    trackVipExpiry(false);
    invalidateData(...SESSION_DATA_DOMAINS);
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const sessionStore = new SessionStore();
