#!/usr/bin/env bash
set -e
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
