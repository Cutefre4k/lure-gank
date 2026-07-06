var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var Room = class {
  static {
    __name(this, "Room");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = /* @__PURE__ */ new Map();
    this.timers = /* @__PURE__ */ new Map();
    this.nextId = 1;
  }
  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const sessionId = crypto.randomUUID();
    this.sessions.set(server, { id: sessionId });
    server.accept();
    server.send(JSON.stringify({
      type: "sync",
      timers: Array.from(this.timers.values())
    }));
    server.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;
        if (type === "add") {
          const tid = this.nextId++;
          const timer = {
            id: tid,
            name: msg.name,
            totalSeconds: msg.totalSeconds,
            startedAt: Date.now()
          };
          this.timers.set(tid, timer);
          this.broadcast({ type: "add", timer });
        } else if (type === "delete") {
          const tid = msg.id;
          if (this.timers.has(tid)) {
            this.timers.delete(tid);
            this.broadcast({ type: "delete", id: tid });
          }
        }
      } catch (e) {
      }
    });
    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const [ws] of this.sessions) {
      try {
        ws.send(data);
      } catch (e) {
      }
    }
  }
};
var index_default = {
  async fetch(request, env) {
    const id = env.ROOM.idFromName("lure-gank");
    const room = env.ROOM.get(id);
    return room.fetch(request);
  }
};
export {
  Room,
  index_default as default
};
//# sourceMappingURL=index.js.map
