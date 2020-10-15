#!/usr/bin/env python3
import json
import sys

obj = {"dataFilesList": []}

for line in sys.stdin:
    line = line.rstrip()
    (name, url) = line.split("\0")
    print({"name": name, "url": url}, file=sys.stderr)
    obj["dataFilesList"].append({"name": name, "url": url})

json.dump(obj, sys.stdout, indent=1)
