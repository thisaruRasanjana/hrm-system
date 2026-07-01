from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models that use this Base so that
# Base.metadata.create_all() picks them up at startup.
import app.departments.models       # noqa: E402, F401  — must come before employees (FK target)
import app.roles.models             # noqa: E402, F401  — must come before auth.models (FK target)
import app.auth.models              # noqa: E402, F401
import app.employees.models         # noqa: E402, F401
import app.recruitment.models       # noqa: E402, F401
import app.announcements.models     # noqa: E402, F401
import app.calendar_holidays.models # noqa: E402, F401
import app.dashboard.models         # noqa: E402, F401
import app.documents.models         # noqa: E402, F401
import app.events.models            # noqa: E402, F401
import app.leave.models             # noqa: E402, F401
import app.messages.models          # noqa: E402, F401
import app.notifications.models     # noqa: E402, F401
import app.time_tracking.models     # noqa: E402, F401