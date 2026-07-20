"""Per-client token-bucket rate limiter.

Each client_id gets a bucket with `burst` capacity refilled at `rpm/60`
tokens per second. In-memory by design: swap for a Redis-backed variant
in a multi-replica deployment.
"""

import time
from dataclasses import dataclass, field

from src.config import settings


@dataclass
class TokenBucket:
    capacity: int
    refill_rate: float  # tokens per second
    tokens: float = 0.0
    last_refill: float = field(default_factory=time.monotonic)

    def consume(self, n: int = 1) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now
        if self.tokens >= n:
            self.tokens -= n
            return True
        return False

    def retry_after_seconds(self, n: int = 1) -> float:
        """Seconds until `n` tokens will be available."""
        deficit = n - self.tokens
        if deficit <= 0:
            return 0.0
        return deficit / self.refill_rate


class RateLimiter:
    def __init__(self, rpm: int = 60, burst: int = 10):
        self.rpm = rpm
        self.burst = burst
        self._buckets: dict[str, TokenBucket] = {}

    def _bucket(self, client_id: str) -> TokenBucket:
        bucket = self._buckets.get(client_id)
        if bucket is None:
            bucket = TokenBucket(
                capacity=self.burst,
                refill_rate=self.rpm / 60.0,
                tokens=float(self.burst),
            )
            self._buckets[client_id] = bucket
        return bucket

    def allow(self, client_id: str) -> bool:
        return self._bucket(client_id).consume()

    def retry_after(self, client_id: str) -> float:
        return self._bucket(client_id).retry_after_seconds()

    def reset(self, client_id: str) -> None:
        self._buckets.pop(client_id, None)


rate_limiter = RateLimiter(rpm=settings.rate_limit_rpm, burst=settings.rate_limit_burst)
