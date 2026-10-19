#!/bin/sh
# Starts Nginx, then reloads it whenever the Deployment Console changes /shared/route.conf
mkdir -p /shared
[ -f /shared/route.conf ] || cp /etc/nginx/route-blue.conf /shared/route.conf
nginx
last=$(md5sum /shared/route.conf | cut -d' ' -f1)
while true; do
  sleep 1
  cur=$(md5sum /shared/route.conf | cut -d' ' -f1)
  if [ "$cur" != "$last" ]; then
    if nginx -t >/dev/null 2>&1; then nginx -s reload; echo "Nginx reloaded: new route active"; else echo "Invalid route file, keeping old route"; fi
    last="$cur"
  fi
done
