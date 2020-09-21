#!/usr/bin/env python3

import argparse
from sdbvdatafile import *
import json
import sys
import re
from datetime import datetime
import os


class TilegridConverter:
    def __init__(self, file):
        self.file = file
        self.sdbv = SdbvDataFile()

    # https://github.com/SymbiFlow/prjxray/blob/master/docs/dev_database/part_specific/tilegrid.rst

    def convert(self):
        obj = None
        with self.file as file:
            obj = json.load(file)

        df = SdbvDataFile()
        df.setBuildDate(datetime.now())

        # Grid-related properties
        col_headers = None
        row_headers = None
        cols_range = [None, None]
        rows_range = [None, None]

        def update_range(range, value):
            if range[0] is None or value < range[0]:
                range[0] = value
            if range[1] is None or value > range[1]:
                range[1] = value

        df.grids[""].cells.fieldOrder = ["col", "row", "fullName", "type"]
        df.grids[""].cells.templateConsts = {
            "COLORS": {}
        }
        df.grids[""].cells.fieldTemplates = {
            "color": r"{get(COLORS, type)}",
            # \u00a0 = non-breaking space
            "name": r"{replace(fullName, 'INTERFACE_','IFACE_', '_(.)_','\u00a0$1_', '^(.)_','$1\u00a0', '_',' ')}"
        }
        i = 0

        color_map = [
            (r"NULL|.*BRK.*", None),
            (r".*IO.*", "#757575"),
            (r"INT_INTERFACE_[LR]|DSP_[LR]", "#AB47BC"),
            (r"BRAM_INT_INTERFACE_[LR]|BRAM_[LR]", "#4DD0E1"),
            (r"HCLK_[LR]", "#D4E157"),
            (r".*CLK.*", "#8BC34A"),
            (r".*CMT.*", "#43A047"),
            (r"CLBLM_[LR]", "#FF5722"),
            (r"CLBLL_[LR]", "#FFC107"),
            (r"INT_L|INT_R", "#1E88E5"),
            (r".*INT_FEEDTHRU.*", "#1565C0"),
            (r".*", "#BDBDBD")
        ]
        color_map = [(re.compile(pat), color) for pat,color in color_map]

        def lookup_color(cellType):
            for (pat, color) in color_map:
                if pat.fullmatch(cellType):
                    return color
            return None

        for name, entries in obj.items():
            col = entries["grid_x"]
            row = entries["grid_y"]
            typ = entries["type"]
            cell = {
                "fullName": name,
                "col":  entries["grid_x"],
                "row":  entries["grid_y"],
                "type": entries["type"],
            }
            update_range(cols_range, col)
            update_range(rows_range, row)

            if entries["type"] not in df.grids[""].cells.templateConsts["COLORS"]:
                df.grids[""].cells.templateConsts["COLORS"][entries["type"]] = lookup_color(entries["type"])


            df.grids[""].cells.addCell(cell)

        df.grids[""].colsRange = cols_range
        df.grids[""].rowsRange = rows_range

        return df


def DirectoryType(path):
    if not os.path.isdir(path):
        raise NotADirectoryError(path)
    elif not os.access(path, os.W_OK):
        raise PermissionError(path)
    else:
        return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-O", "--output-dir", type=DirectoryType, help="Output directory")
    parser.add_argument("-o", "--output-file-name", type=str, required=True, help="Output file name")

    parser.add_argument("--input", type=argparse.FileType("r"), required=True, help="Input file")

    args = parser.parse_args()

    df = None
    with args.input as in_file:
        converter = TilegridConverter(in_file)
        df = converter.convert()

    if args.output_dir is not None:
        nameprefix, dotext = os.path.splitext(os.path.basename(args.output_file_name))
        for name, grid in df.grids.items():
            if name != "":
                name = "." + name
            grid.cells.data = SdbvImport(f"./{nameprefix}{name}.data{dotext}", grid.cells.data)

    files = df.writeFiles(args.output_file_name, args.output_dir if args.output_dir is not None else os.getcwd())

    for file in files:
        print(file)


if __name__ == "__main__":
    main()
