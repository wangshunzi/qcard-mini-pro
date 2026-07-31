const SESSION_KEY = "qcard.session.v1";

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
    this.state = session;
    wx.setStorageSync(SESSION_KEY, session);
    this.emit();
  }

  clear() {
    this.state = null;
    wx.removeStorageSync(SESSION_KEY);
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
