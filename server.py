"""
Lure Gank - WebSocket 同步服务器
电脑运行此脚本，自动提供前端页面 + WebSocket 实时同步
手机和电脑浏览器打开同一地址即可实时同步
"""
import asyncio
import json
import time
import os
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from websockets.asyncio.server import serve

WS_PORT = 8765
HTTP_PORT = 8080

# ====== 内存存储 ======
timers_data = {}
next_id = 1
connections = set()

def log(msg):
    print(msg, flush=True)

def now_ms():
    return int(time.time() * 1000)

def clean_expired():
    global timers_data
    cutoff = now_ms() - 30000
    for tid in list(timers_data):
        t = timers_data[tid]
        if t['startedAt'] + t['totalSeconds'] * 1000 < cutoff:
            del timers_data[tid]

async def broadcast(msg):
    data = json.dumps(msg, ensure_ascii=False)
    dead = set()
    for ws in list(connections):
        try:
            await ws.send(data)
        except Exception:
            dead.add(ws)
    connections.difference_update(dead)

async def ws_handler(websocket):
    connections.add(websocket)
    remote = websocket.remote_address
    log(f'[+] 连接: {remote}  在线: {len(connections)}')

    clean_expired()
    await websocket.send(json.dumps({
        'type': 'sync',
        'timers': list(timers_data.values()),
    }, ensure_ascii=False))

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            t = msg.get('type')
            if t == 'add':
                global next_id
                tid = next_id
                next_id += 1
                timer = {
                    'id': tid,
                    'name': msg['name'],
                    'totalSeconds': msg['totalSeconds'],
                    'startedAt': now_ms(),
                }
                timers_data[tid] = timer
                log(f'  ➕ {timer["name"]} ({timer["totalSeconds"]}s)')
                await broadcast({'type': 'add', 'timer': timer})

            elif t == 'delete':
                tid = msg['id']
                if tid in timers_data:
                    name = timers_data[tid]['name']
                    del timers_data[tid]
                    log(f'  ❌ {name}')
                    await broadcast({'type': 'delete', 'id': tid})

    except Exception as e:
        log(f'[!] 异常: {e}')
    finally:
        connections.discard(websocket)
        log(f'[-] 断开: {remote}  在线: {len(connections)}')

async def cleanup_task():
    while True:
        await asyncio.sleep(15)
        clean_expired()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('114.114.114.114', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def start_http(script_dir):
    os.chdir(script_dir)
    httpd = HTTPServer(('0.0.0.0', HTTP_PORT), SimpleHTTPRequestHandler)
    log(f'🌐 HTTP 服务启动: http://0.0.0.0:{HTTP_PORT}')
    httpd.serve_forever()

async def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    local_ip = get_local_ip()

    # HTTP 服务器（独立线程）
    threading.Thread(target=start_http, args=(script_dir,), daemon=True).start()

    log('=' * 50)
    log('  🎣  Lure Gank 同步服务器')
    log('=' * 50)
    log('')
    log(f'  📡 WebSocket : ws://{local_ip}:{WS_PORT}')
    log(f'  🌐 页面地址  : http://{local_ip}:{HTTP_PORT}')
    log('')
    log(f'  📱 手机连同一 WiFi，浏览器打开：')
    log(f'     http://{local_ip}:{HTTP_PORT}')
    log('')
    log(f'  ⚡ 添加/删除操作实时同步，延迟 < 50ms')
    log(f'  ❌ Ctrl+C 停止')
    log('=' * 50)

    # WebSocket + 清理任务
    asyncio.create_task(cleanup_task())
    ws_server = await serve(ws_handler, '0.0.0.0', WS_PORT,
                            max_size=1024*1024, ping_interval=30, ping_timeout=10)

    log(f'')
    log(f'✅ 服务器已启动，等待连接...')
    log(f'')

    await ws_server.serve_forever()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log('\n👋 已停止')
