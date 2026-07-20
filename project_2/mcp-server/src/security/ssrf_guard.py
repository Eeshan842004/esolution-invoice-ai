"""SSRF (Server-Side Request Forgery) protection.

Validates any URL before an outbound request is made on behalf of a client:
blocks private/loopback/link-local IP ranges (including cloud metadata
endpoints), non-HTTP schemes, credential-bearing URLs, and resolves
hostnames so DNS-rebinding to a private address is caught too.
"""

import ipaddress
import socket
from urllib.parse import urlparse

from fastmcp.exceptions import ToolError

BLOCKED_IP_RANGES = [
    ipaddress.ip_network("127.0.0.0/8"),      # loopback
    ipaddress.ip_network("10.0.0.0/8"),       # private
    ipaddress.ip_network("172.16.0.0/12"),    # private
    ipaddress.ip_network("192.168.0.0/16"),   # private
    ipaddress.ip_network("169.254.0.0/16"),   # link-local / cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),        # unspecified
    ipaddress.ip_network("100.64.0.0/10"),    # carrier-grade NAT
    ipaddress.ip_network("192.0.0.0/24"),     # IETF protocol assignments
    ipaddress.ip_network("198.18.0.0/15"),    # benchmarking
    ipaddress.ip_network("::1/128"),          # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
    ipaddress.ip_network("::ffff:0:0/96"),    # IPv4-mapped IPv6
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "169.254.169.254",
}

ALLOWED_SCHEMES = {"http", "https"}


class SSRFError(ToolError, ValueError):
    """Raised when a URL fails SSRF validation.

    Subclasses ToolError so FastMCP surfaces the message to the client; still
    a ValueError for standalone use.
    """


def _check_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, origin: str) -> None:
    for network in BLOCKED_IP_RANGES:
        if ip.version == network.version and ip in network:
            raise SSRFError(f"Blocked IP range: {origin} resolves into {network}")


def validate_url(url: str, resolve_dns: bool = False) -> str:
    """Validate that `url` is safe to fetch. Returns the URL or raises SSRFError.

    Args:
        url: The URL to validate.
        resolve_dns: Also resolve the hostname and check every resolved
            address (protects against DNS pointing at private ranges).
    """
    parsed = urlparse(url.strip())

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise SSRFError(f"Blocked scheme: {parsed.scheme!r} (only http/https allowed)")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("No hostname in URL")

    if parsed.username or parsed.password:
        raise SSRFError("URLs with embedded credentials are blocked")

    host_lower = hostname.lower().rstrip(".")
    if host_lower in BLOCKED_HOSTNAMES:
        raise SSRFError(f"Blocked hostname: {hostname}")

    # Literal IP address in the URL?
    try:
        ip = ipaddress.ip_address(host_lower)
    except ValueError:
        ip = None
    if ip is not None:
        _check_ip(ip, hostname)

    if ip is None and resolve_dns:
        try:
            infos = socket.getaddrinfo(host_lower, None)
        except socket.gaierror as exc:
            raise SSRFError(f"Hostname does not resolve: {hostname}") from exc
        for info in infos:
            resolved = ipaddress.ip_address(info[4][0])
            _check_ip(resolved, hostname)

    return url
