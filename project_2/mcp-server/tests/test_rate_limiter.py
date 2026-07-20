"""Token-bucket rate limiter tests."""

import time

from src.security.rate_limiter import RateLimiter, TokenBucket


def test_burst_then_block():
    rl = RateLimiter(rpm=60, burst=3)
    assert rl.allow("client1") is True
    assert rl.allow("client1") is True
    assert rl.allow("client1") is True
    assert rl.allow("client1") is False  # burst exhausted


def test_clients_are_isolated():
    rl = RateLimiter(rpm=60, burst=1)
    assert rl.allow("a") is True
    assert rl.allow("a") is False
    assert rl.allow("b") is True  # b has its own bucket


def test_refill_over_time():
    # Deterministic: backdate last_refill so exactly 1s of refill has elapsed.
    bucket = TokenBucket(capacity=2, refill_rate=100.0, tokens=0.0)
    assert bucket.consume() is False  # empty
    bucket.last_refill = time.monotonic() - 1.0  # 1s * 100 tok/s = 100, capped at 2
    assert bucket.consume() is True
    assert bucket.consume() is True
    assert bucket.consume() is False  # capacity cap respected


def test_refill_capped_at_capacity():
    bucket = TokenBucket(capacity=2, refill_rate=1000.0, tokens=2.0)
    time.sleep(0.01)
    assert bucket.consume() is True
    assert bucket.consume() is True
    assert bucket.consume() is False  # never exceeds capacity


def test_retry_after_positive_when_empty():
    rl = RateLimiter(rpm=60, burst=1)
    assert rl.allow("c") is True
    assert rl.allow("c") is False
    assert rl.retry_after("c") > 0


def test_reset_restores_full_burst():
    rl = RateLimiter(rpm=60, burst=1)
    assert rl.allow("c") is True
    assert rl.allow("c") is False
    rl.reset("c")
    assert rl.allow("c") is True
