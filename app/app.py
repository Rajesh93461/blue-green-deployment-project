import os
import socket
from flask import Flask, jsonify

app = Flask(__name__)

PAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__ENV__ __VER__</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 font-family:system-ui,Segoe UI,sans-serif;color:#fff;background:linear-gradient(135deg,__C1__,__C2__)}
.card{text-align:center;padding:40px 56px;border-radius:28px;background:rgba(255,255,255,.14);
 backdrop-filter:blur(8px);box-shadow:0 20px 60px rgba(0,0,0,.3)}
.env{letter-spacing:.3em;font-size:18px;opacity:.9}
.ver{font-size:clamp(90px,22vw,200px);font-weight:900;line-height:1;margin:8px 0;
 text-shadow:0 6px 30px rgba(0,0,0,.35);animation:pop .8s ease-out}
.pill{display:inline-block;padding:8px 22px;border-radius:99px;background:#fff;color:__C1__;
 font-weight:700;animation:pulse 2s infinite}
.meta{margin-top:22px;font-size:14px;opacity:.8}
@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}50%{box-shadow:0 0 0 14px rgba(255,255,255,0)}}
</style></head><body><div class="card">
<div class="env">__ENV__ ENVIRONMENT</div>
<div class="ver">__VER__</div>
<div class="pill">Version __VER__ is running</div>
<div class="meta">Container: __HOST__</div>
</div></body></html>"""


def cfg():
    return (
        os.getenv("ENV_NAME", "blue"),
        os.getenv("APP_VERSION", "v1"),
        os.getenv("BROKEN", "0") == "1",
    )


@app.route("/")
def home():
    env, ver, _ = cfg()
    c1, c2 = {"blue": ("#1d4ed8", "#38bdf8"), "green": ("#15803d", "#4ade80")}.get(
        env, ("#334155", "#64748b")
    )
    return (
        PAGE.replace("__ENV__", env.upper())
        .replace("__VER__", ver)
        .replace("__C1__", c1)
        .replace("__C2__", c2)
        .replace("__HOST__", socket.gethostname())
    )


@app.route("/health")
def health():
    env, ver, broken = cfg()
    if broken:  # simulates a faulty release
        return jsonify(status="error", env=env, version=ver), 500
    return jsonify(status="ok", env=env, version=ver)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
