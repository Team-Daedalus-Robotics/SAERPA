from sqlalchemy import MetaData, Table

from saerpa_shared.engine import engine

metadata = MetaData()

event_table = Table("event", metadata,autoload_with=engine)
measure_table = Table("measure", metadata, autoload_with=engine)
rotation_rule_table = Table("rotation_rule", metadata, autoload_with=engine)
crop_table = Table("crop", metadata, autoload_with=engine)
planting_table = Table("planting", metadata, autoload_with=engine)
field_table = Table("field", metadata, autoload_with=engine)
station_table = Table("station", metadata, autoload_with=engine)
