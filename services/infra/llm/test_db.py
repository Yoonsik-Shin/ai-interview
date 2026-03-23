import psycopg2
from config import DB_URL
try:
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='resume'")
    print(cursor.fetchall())
except Exception as e:
    print(e)
