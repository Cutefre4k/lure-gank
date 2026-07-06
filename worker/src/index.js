// Lure Gank - Cloudflare Worker (WebSocket 实时同步中继)
// 所有连接的客户端共享同一个 Room，消息实时广播

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();   // WebSocket -> { id }
    this.timers = new Map();     // id -> { id, name, totalSeconds, startedAt }
    this.nextId = 1;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const sessionId = crypto.randomUUID();

    this.sessions.set(server, { id: sessionId });

    server.accept();

    // 给新客户端发送当前全量数据
    server.send(JSON.stringify({
      type: 'sync',
      timers: Array.from(this.timers.values()),
    }));

    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;

        if (type === 'add') {
          const tid = this.nextId++;
          const timer = {
            id: tid,
            name: msg.name,
            totalSeconds: msg.totalSeconds,
            startedAt: Date.now(),
          };
          this.timers.set(tid, timer);
          this.broadcast({ type: 'add', timer });
        } else if (type === 'delete') {
          const tid = msg.id;
          if (this.timers.has(tid)) {
            this.timers.delete(tid);
            this.broadcast({ type: 'delete', id: tid });
          }
        }
      } catch (e) {
        // 忽略无法解析的消息
      }
    });

    server.addEventListener('close', () => {
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
        // 忽略发送失败的连接
      }
    }
  }
}

export default {
  async fetch(request, env) {
    // 所有 WebSocket 请求路由到同一个 Room 实例
    const id = env.ROOM.idFromName('lure-gank');
    const room = env.ROOM.get(id);
    return room.fetch(request);
  },
};
