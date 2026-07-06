// Lure Gank - Cloudflare Durable Object WebSocket Relay
export class Room {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.timers = [];
    this.nextId = 1;
    this.sessions = [];
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Lure Gank WS Relay", { headers: { "Content-Type": "text/plain" } });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "add") {
        const tid = this.nextId++;
        const timer = { id: tid, name: msg.name, totalSeconds: msg.totalSeconds, startedAt: Date.now() };
        this.timers.push(timer);
        this.broadcast({ type: "add", timer });
      } else if (msg.type === "delete") {
        this.timers = this.timers.filter(t => t.id !== msg.id);
        this.broadcast({ type: "delete", id: msg.id });
      }
    } catch(e) {}
  }

  async webSocketClose(ws, code, reason, wasClean) {}

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch(e) {}
    }
  }
}

export default {
  async fetch(request, env) {
    const id = env.ROOM.idFromName("lobby");
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  },
};
