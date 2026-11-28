#!/usr/bin/env python3
"""Mirror the runtime env into the Jenkins volume, readable by the CI build.

Why two copies: the container is isolated, so /root/smartpro.env on the host is
invisible to Jenkins. The Deploy stage needs it on the host (docker run
--env-file), while the Build stage needs it inside Jenkins (to inline VITE_*).

Both are kept at mode 600. The Jenkins copy is written with uid/gid 1000 so the
jenkins user owns it; root inside the container could read it either way, but
owning it avoids permission surprises for workspace scripts.
"""
import json
import os
import shutil
import subprocess
import sys

HOST_SRC = "/root/smartpro.env"
VOL = "/var/lib/docker/volumes/jenkins_home/_data"
DEST = os.path.join(VOL, ".smartpro.env")

if not os.path.exists(HOST_SRC):
    sys.exit(f"missing {HOST_SRC}")

# Sanity: required keys present before copying anything.
required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
text = open(HOST_SRC).read()
missing = [
    k for k in required
    if not any(l.strip().startswith(f"{k}=") and len(l.split("=", 1)[1].strip()) > 0
               for l in text.splitlines())
]
if missing:
    sys.exit(f"source env missing: {missing}")

shutil.copyfile(HOST_SRC, DEST)
os.chmod(DEST, 0o600)
os.chown(DEST, 1000, 1000)

st = os.stat(DEST)
print(f"wrote {DEST}")
print(f"  mode={oct(st.st_mode)[-3:]} uid={st.st_uid} gid={st.st_gid} bytes={st.st_size}")

# Verify Jenkins can actually read it and sees the three keys.
check = subprocess.run(
    ["docker", "exec", "jenkins_server", "sh", "-c",
     'for k in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do '
     'v=$(grep -E "^$k=..*" /var/jenkins_home/.smartpro.env | head -1 | cut -d= -f2-); '
     'echo "$k len=${#v}"; done'],
    capture_output=True, text=True, timeout=120,
)
print("inside Jenkins:")
print(check.stdout.strip() or check.stderr.strip()[:300])
sys.exit(0 if check.returncode == 0 else 1)
