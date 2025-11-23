import sys
from pathlib import Path

# Ensure crawler/src is importable even when pytest is launched from the repo root.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
