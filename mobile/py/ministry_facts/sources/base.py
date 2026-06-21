"""Source interface: yield normalized MinistryEntry objects."""
from abc import ABC, abstractmethod
from collections.abc import Iterator
from ministry_facts.core.models import MinistryEntry


class Source(ABC):
    name: str  # e.g. 'tarim', 'titck', 'gubis', 'eu'

    @abstractmethod
    def fetch(self, since: str | None = None) -> Iterator[MinistryEntry]:
        ...
