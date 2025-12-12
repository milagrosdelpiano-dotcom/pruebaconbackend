import os, io, requests, psycopg, time
from PIL import Image
from services.embeddings import image_bytes_to_vec

DSN = os.getenv("DATABASE_URL")
BATCH = 50

def fetch_report_photos(cur, limit):
    cur.execute("""
      select id, photos
        from public.reports
       where embedding is null
         and photos is not null
         and jsonb_array_length(photos) > 0
       limit %s
    """, (limit,))
    return cur.fetchall()

def main():
    if not DSN: raise RuntimeError("DATABASE_URL no configurada")
    with psycopg.connect(DSN, autocommit=True) as conn, conn.cursor() as cur:
        while True:
            rows = fetch_report_photos(cur, BATCH)
            if not rows:
                print("✅ Backfill completo")
                break
            for rid, photos in rows:
                url = photos[0] if isinstance(photos, list) else None
                if not url:
                    continue
                try:
                    b = requests.get(url, timeout=20).content
                    vec = image_bytes_to_vec(b)
                    cur.execute("update public.reports set embedding=%s where id=%s::uuid", (vec, rid))
                    print("OK", rid)
                except Exception as e:
                    print("ERR", rid, e)
            time.sleep(0.2)

if __name__ == "__main__":
    main()
