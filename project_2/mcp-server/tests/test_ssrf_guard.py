"""SSRF guard tests: private ranges, metadata endpoints, schemes, credentials."""

import pytest

from src.security.ssrf_guard import SSRFError, validate_url


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/admin",
    "http://127.0.0.1:8080/internal",
    "http://169.254.169.254/latest/meta-data/",      # AWS metadata
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://localhost:8080",
    "http://LOCALHOST/x",                             # case-insensitive
    "http://localhost./x",                            # trailing-dot bypass
    "http://192.168.1.1",
    "http://10.0.0.5/secrets",
    "http://172.16.0.1/",
    "http://100.64.0.1/",                             # CGNAT
    "http://0.0.0.0/",
    "http://[::1]/secret",                            # IPv6 loopback
    "http://[fc00::1]/",                              # IPv6 unique local
    "http://[fe80::1]/",                              # IPv6 link-local
    "http://[::ffff:127.0.0.1]/",                     # IPv4-mapped bypass
    "ftp://evil.com/file",                            # scheme
    "file:///etc/passwd",                             # scheme
    "gopher://evil.com/",                             # scheme
    "http://user:pass@evil.com",                      # embedded credentials
])
def test_ssrf_blocked(url):
    with pytest.raises(SSRFError):
        validate_url(url)


@pytest.mark.parametrize("url", [
    "https://api.example.com/data",
    "https://google.com",
    "http://8.8.8.8/dns",
    "https://sub.domain.example.org/path?q=1",
])
def test_safe_urls_allowed(url):
    assert validate_url(url) == url


def test_no_hostname_rejected():
    with pytest.raises(SSRFError):
        validate_url("https:///path-only")


def test_dns_resolution_check_blocks_loopback():
    """With resolve_dns=True a hostname resolving to loopback is rejected."""
    with pytest.raises(SSRFError):
        validate_url("http://localhost/x", resolve_dns=True)
