from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:admin@localhost:5432/hrm_db')
with engine.begin() as conn:
    conn.execute(text("UPDATE employees SET employee_id = 'N/A' WHERE employee_id IS NULL"))
    conn.execute(text("UPDATE employees SET phone = 'N/A' WHERE phone IS NULL"))
    conn.execute(text("UPDATE employees SET designation = 'Unassigned' WHERE designation IS NULL"))
    conn.execute(text("UPDATE employees SET address = 'N/A' WHERE address IS NULL"))
