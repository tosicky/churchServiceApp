#!/bin/sh
set -e

# Docker's embedded DNS is always at a fixed 127.0.0.11; Podman's varies (it's the network
# gateway address). Read whichever this container actually has configured right now rather
# than hardcoding either, so the same image works under both.
DNS_RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
export DNS_RESOLVER

envsubst '${DNS_RESOLVER}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
