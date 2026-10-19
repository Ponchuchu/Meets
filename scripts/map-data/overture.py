# Overture (theme/type) по рамке Алматы → parquet. Пример: python scripts/map-data/overture.py places place places.parquet
import duckdb, os, sys
theme, typ, out = sys.argv[1], sys.argv[2], sys.argv[3]
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
con.execute("CREATE SECRET anon (TYPE s3, PROVIDER config, REGION 'us-west-2');")
if os.environ.get('HTTPS_PROXY'): con.execute(f"SET http_proxy='{os.environ['HTTPS_PROXY'].split('//')[-1]}'")
if os.environ.get('SSL_CERT_FILE'): con.execute(f"SET ca_cert_file='{os.environ['SSL_CERT_FILE']}'")
src = f"s3://overturemaps-us-west-2/release/2026-09-23.1/theme={theme}/type={typ}/*"
con.execute(f"""COPY (SELECT * EXCLUDE (geometry), ST_AsText(geometry) AS wkt FROM read_parquet('{src}', filename=true, hive_partitioning=1)
 WHERE bbox.xmin > 76.70 AND bbox.xmax < 77.20 AND bbox.ymin > 43.10 AND bbox.ymax < 43.42) TO '{out}' (FORMAT parquet)""")
print(con.execute(f"select count(*) from '{out}'").fetchall())
