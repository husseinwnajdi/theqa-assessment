import { EventEmitter } from "node:events";

const SESSION_UPDATED = "session-updated";

class SessionEvents {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(sessionId: string): void {
    this.emitter.emit(SESSION_UPDATED, sessionId);
  }

  subscribe(callback: (sessionId: string) => void): () => void {
    this.emitter.on(SESSION_UPDATED, callback);
    return () => {
      this.emitter.off(SESSION_UPDATED, callback);
    };
  }
}

const globalForSessionEvents = globalThis as unknown as {
  sessionEvents: SessionEvents | undefined;
};

export const sessionEvents = globalForSessionEvents.sessionEvents ?? new SessionEvents();

if (process.env.NODE_ENV !== "production") {
  globalForSessionEvents.sessionEvents = sessionEvents;
}
