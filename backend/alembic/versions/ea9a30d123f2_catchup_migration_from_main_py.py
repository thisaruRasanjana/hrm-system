"""catchup_migration_from_main_py

Revision ID: ea9a30d123f2
Revises: 23a865db923c
Create Date: 2026-07-16 11:06:11.340145

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea9a30d123f2'
down_revision: Union[str, Sequence[str], None] = '23a865db923c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
        # ── Patch users table with columns added in dev branch ────────────
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100)")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'employee'")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_number VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_start VARCHAR DEFAULT '22:00'")
        op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours_end VARCHAR DEFAULT '08:00'")

        # ── Patch document_requests with the inbound email body column ───
        op.execute("ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS requester_message TEXT")

        # ── Patch document_types with the upload/request catalogue column ─
        op.execute("ALTER TABLE document_types ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'UPLOAD'")

        # ── Patch notifications table with category + entity columns ────
        op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR")
        op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR")
        op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id VARCHAR")

        # ── Time Tracking: new tables + columns for pause/resume ─────────
        op.execute("""
            CREATE TABLE IF NOT EXISTS time_check_pairs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                date DATE NOT NULL,
                check_in TIMESTAMP NOT NULL,
                check_out TIMESTAMP,
                seconds INTEGER,
                created_at TIMESTAMP DEFAULT now()
            )
        """)
        op.execute("""
            CREATE TABLE IF NOT EXISTS overtime_threshold_history (
                id SERIAL PRIMARY KEY,
                threshold_hours NUMERIC(5,2) NOT NULL,
                effective_date DATE NOT NULL,
                created_by_user_id INTEGER,
                created_at TIMESTAMP DEFAULT now()
            )
        """)
        op.execute("ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS applied_threshold NUMERIC(5,2)")
        # Create indexes for performance
        op.execute("CREATE INDEX IF NOT EXISTS idx_time_check_pairs_user_date ON time_check_pairs (user_id, date)")
        op.execute("CREATE INDEX IF NOT EXISTS idx_overtime_threshold_effective ON overtime_threshold_history (effective_date)")

        # ── Patch employees table with columns added in dev branch ───────
        op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)")
        op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)")
        op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE")

        # ── Link employees to users by matching email ─────────────────────
        op.execute("""
            UPDATE employees e
            SET user_id = u.id
            FROM users u
            WHERE e.email = u.email
              AND e.user_id IS NULL
        """)

        # ── Backfill user_roles from scalar role_id for users missing entries ──
        op.execute("""
            INSERT INTO user_roles (user_id, role_id)
            SELECT u.id, u.role_id
            FROM users u
            WHERE u.role_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM user_roles ur
                  WHERE ur.user_id = u.id AND ur.role_id = u.role_id
              )
        """)

        # ── Patch permissions table (dev uses permission_name, resource, action) ──
        op.execute("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS permission_name VARCHAR(255)")
        op.execute("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS resource VARCHAR(100)")
        op.execute("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS action VARCHAR(100)")
        op.execute("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()")
        # Copy existing 'name' into 'permission_name' where not already set
        op.execute("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'permissions' AND column_name = 'name') THEN
                    UPDATE permissions
                    SET permission_name = name
                    WHERE permission_name IS NULL AND name IS NOT NULL;
                END IF;
            END $$;
        """)
        # Legacy 'name' column is NOT NULL but unmapped in the current model —
        # without this, every new permission INSERT fails and seed_roles is
        # silently skipped on startup.
        op.execute("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'permissions' AND column_name = 'name') THEN
                    ALTER TABLE permissions ALTER COLUMN name DROP NOT NULL;
                END IF;
            END $$;
        """)

        # ── Patch roles table (dev uses role_name) ────────────────────────
        op.execute("ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_name VARCHAR(100)")
        op.execute("ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()")
        # Copy existing 'name' into 'role_name' where not already set
        op.execute("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'roles' AND column_name = 'name') THEN
                    UPDATE roles
                    SET role_name = name
                    WHERE role_name IS NULL AND name IS NOT NULL;
                END IF;
            END $$;
        """)
        # Same legacy-column guard as permissions.name above
        op.execute("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'roles' AND column_name = 'name') THEN
                    ALTER TABLE roles ALTER COLUMN name DROP NOT NULL;
                END IF;
            END $$;
        """)

        # ── Leave types: per-type annual entitlement ──────────────────────
        op.execute("ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS default_days FLOAT")
        op.execute("ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS directly_requestable BOOLEAN NOT NULL DEFAULT TRUE")
        op.execute("UPDATE leave_types SET directly_requestable = FALSE WHERE LOWER(name) = 'medical'")
        op.execute("ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS parent_request_id INTEGER REFERENCES leave_requests(leave_request_id) ON DELETE SET NULL")
        op.execute("""
            CREATE TABLE IF NOT EXISTS leave_medical_conversions (
                id SERIAL PRIMARY KEY,
                leave_request_id INTEGER NOT NULL REFERENCES leave_requests(leave_request_id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                attachment_urls JSONB,
                reason TEXT,
                status VARCHAR(20) DEFAULT 'PENDING',
                reviewer_id INTEGER,
                reviewer_comment TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)

        # ── Leave requests: who assigned it (HR-on-behalf-of flow) ────────
        op.execute("ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS assigned_by INTEGER")

        # ── Patch recruitment tables created by an older model version ────
        op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file_path VARCHAR(500)")
        op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT now()")
        op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ai_reasoning TEXT")
        op.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT")
        op.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now()")
        # Multi-round panel evaluation columns (added with the panel workflow refactor)
        op.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS active_round INTEGER NOT NULL DEFAULT 1")
        op.execute("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS round_number SMALLINT NOT NULL DEFAULT 1")
        op.execute("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS needs_another_round BOOLEAN NOT NULL DEFAULT FALSE")
        op.execute("ALTER TABLE interview_evaluations ADD COLUMN IF NOT EXISTS evaluator_user_id INTEGER")
        # Migrate data from the old column names where present
        op.execute("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'candidates' AND column_name = 'cv_path') THEN
                    UPDATE candidates SET cv_file_path = cv_path
                    WHERE cv_file_path IS NULL AND cv_path IS NOT NULL;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'candidates' AND column_name = 'ai_summary') THEN
                    UPDATE candidates SET ai_reasoning = ai_summary
                    WHERE ai_reasoning IS NULL AND ai_summary IS NOT NULL;
                END IF;
            END $$;
        """)

        # ── Patch employee_leave_accrual_rules ───────────────────────────────────
        op.execute("ALTER TABLE employee_leave_accrual_rules ADD COLUMN IF NOT EXISTS max_carry_forward FLOAT")
        op.execute("ALTER TABLE employee_leave_accrual_rules ADD COLUMN IF NOT EXISTS total_leaves_cap FLOAT")
        op.execute("ALTER TABLE employee_leave_accrual_rules ADD COLUMN IF NOT EXISTS carry_forward_allowed BOOLEAN NOT NULL DEFAULT FALSE")
        op.execute("ALTER TABLE employee_leave_accrual_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()")

        # ── Add missing messages column ───────────────────────────────────
        op.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_permanent_deleted BOOLEAN DEFAULT FALSE")

        # Create message_groups table for custom superadmin groups
        op.execute("""
            CREATE TABLE IF NOT EXISTS message_groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)

        # Drop deprecated columns that cause NotNullViolations during inserts
        op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS is_active")
        op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS department")
        op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS date_joined")
        op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS job_title")
        op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS employee_number")

        # Migrate data
        op.execute("UPDATE employees SET email = REPLACE(email, '@hrm.local', '@hrm.com') WHERE email LIKE '%@hrm.local'")
        op.execute("UPDATE users SET email = REPLACE(email, '@hrm.local', '@hrm.com') WHERE email LIKE '%@hrm.local'")
        op.execute("UPDATE employees SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'inactive')")


def downgrade() -> None:
    """Downgrade schema."""
    pass
