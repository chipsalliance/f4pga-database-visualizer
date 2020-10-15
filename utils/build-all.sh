#!/bin/bash

set -e -u -o pipefail
shopt -s nullglob
shopt -s extglob

logi() { printf '\033[32m[%s]\033[0m \033[92m%s\033[0m\n' "INF" "$*"; }
loge() { printf '\033[31m[%s]\033[0m \033[91m%s\033[0m\n' "ERR" "$*"; }

#─────────────────────────────────────────────────────────────────────────────
# Early test for variables required later

if [[ ! -d ${PRJXRAYDB_DIR:-} ]]; then
	loge "'PRJXRAYDB_DIR' environment variable must contain path to" \
	     "Project X-Ray database (https://github.com/SymbiFlow/prjxray-db)" \
	     "directory."
	exit 1
fi

#─────────────────────────────────────────────────────────────────────────────

SELF_DIR="$(dirname $(readlink -f ${BASH_SOURCE[0]}))"
TOP="$SELF_DIR/.."

#APP_OUT_DIR="$(realpath -s ${1:-$TOP/dist/production})"
APP_OUT_DIR="$(realpath -ms $TOP/dist/production)"
DATA_OUT_DIR="$APP_OUT_DIR/data"

mkdir -p "$APP_OUT_DIR" "$DATA_OUT_DIR"
rm -r $APP_OUT_DIR/*

data_files_name_list=()
data_files_path_list=()

#─────────────────────────────────────────────────────────────────────────────
# Build app bundle

logi "Building app bundle"
(
	cd $TOP
	npm run build
)

#─────────────────────────────────────────────────────────────────────────────
# Process Project X-Ray database entries

PRJXRAYDB_DIR="$(realpath -s $PRJXRAYDB_DIR)"
prjxraydbconverter() { $TOP/utils/datafilegen/prjxraydbconverter "$@"; }

for chip_dir in $PRJXRAYDB_DIR/*/xc*/; do
	IFS=$'/' read -a chip_dir_parts <<< "$chip_dir"
	partname="${chip_dir_parts[-1]}"
	family="${chip_dir_parts[-2]}"

	name="$family ($partname)"
	out="$DATA_OUT_DIR/prjxraydb/$family/${partname}.json"

	logi "Processing: prjxray: $name"
	prjxraydbconverter "$chip_dir" "$out" || continue
	data_files_name_list+=("$name")
	data_files_path_list+=("$out")
done

#─────────────────────────────────────────────────────────────────────────────
# Process SymbiFlow Arch Defs' arch.xml entries

# TODO

#─────────────────────────────────────────────────────────────────────────────
# Generate config

SDBV_CONFIG_JSON="$APP_OUT_DIR/sdbv.config.json"
make_config_from_lines() { python3 $SELF_DIR/make_config_from_lines.py; }

logi "Generating config"
for ((i=0; i<${#data_files_name_list[@]}; i++)) {
	name="${data_files_name_list[$i]}"
	url="$(realpath --relative-to="$APP_OUT_DIR" "${data_files_path_list[$i]}")"
	printf '%s\0%s\n' "$name" "$url"
} | make_config_from_lines > "$SDBV_CONFIG_JSON"

logi "Done. Output directory: $APP_OUT_DIR"
exit 0
