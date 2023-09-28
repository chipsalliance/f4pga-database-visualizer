#!/usr/bin/env python3

from datetime import datetime
from json import JSONEncoder
import os
from pathlib import Path


# Color indexes from .color-* classes in grid-view.scss
class Colors:
    GRAY   = 0
    RED    = 1
    YELLOW = 2
    GREEN  = 3
    CYAN   = 4
    BLUE   = 5
    PURPLE = 6
    PINK   = 7

    LIGHT_GRAY   = 8+0
    LIGHT_RED    = 8+1
    LIGHT_YELLOW = 8+2
    LIGHT_GREEN  = 8+3
    LIGHT_CYAN   = 8+4
    LIGHT_BLUE   = 8+5
    LIGHT_PURPLE = 8+6
    LIGHT_PINK   = 8+7

    DARK_GRAY   = 16+0
    DARK_RED    = 16+1
    DARK_YELLOW = 16+2
    DARK_GREEN  = 16+3
    DARK_CYAN   = 16+4
    DARK_BLUE   = 16+5
    DARK_PURPLE = 16+6
    DARK_PINK   = 16+7


class SdbvImport:
    def __init__(self, fileName, data):
        self.fileName = fileName
        self.data = data

    def toJson(self):
        return {"@import": str(self.fileName)}


class SdbvGridCells:
    def __init__(self, fieldOrder=[]):
        self.fieldOrder = fieldOrder
        self.fieldTemplates = None
        self.templateConsts = None
        self.data = []

    def addCell(self, cellSpec):
        cell = []
        nonesAtEnd = 0
        for field in self.fieldOrder:
            if field in cellSpec:
                cell.append(cellSpec[field])
                nonesAtEnd = 0
            else:
                cell.append(None)
                nonesAtEnd += 1
        if nonesAtEnd > 0:
            del cell[-nonesAtEnd:]
        self.data.append(cell)

    def toJson(self):
        result = {}
        result["fieldOrder"] = self.fieldOrder
        if self.fieldTemplates is not None:
            result["fieldTemplates"] = self.fieldTemplates
        if self.templateConsts is not None:
            result["templateConsts"] = self.templateConsts
        result["data"] = self.data
        return result


class SdbvGrid:
    def __init__(self):
        self.name = None
        self.colsRange = [[0, 0]]
        self.rowsRange = [[0, 0]]
        self.rowHeaders = None
        self.colHeaders = None
        self.cells = SdbvGridCells()

    def toJson(self):
        result = {}
        if self.name is not None:
            result["name"] = self.name
        result["colsRange"] = self.colsRange
        result["rowsRange"] = self.rowsRange
        if self.rowHeaders is not None:
            result["rowHeaders"] = self.rowHeaders
        if self.colHeaders is not None:
            result["colHeaders"] = self.colHeaders
        result["cells"] = self.cells
        return result


class SdbvDataFile:
    def __init__(self):
        self.name = None
        self.version = None
        self.buildDate = None;
        self.buildSources = None
        self.description = None
        self.grids = {}

    def setBuildDate(self, dt):
        if isinstance(dt, datetime):
            self.buildDate = dt.isoformat(timespec="seconds")
        else:
            self.buildDate = str(dt)

    def addBuildSource(self, text, url=None):
        if self.buildSources is None:
            self.buildSources = []
        self.buildSources.append(text if url is None else {text: url})

    def addDescriptionEntry(self, textOrKey, value=None):
        """Adds description entry

        Args:
            textOrKey (str): Entry text or key of key-value pair.
            value (None, str, list): Value of key-pair entry.
        """
        if self.description is None:
            self.description = []
        self.description.append(textOrKey if value is None else {textOrKey: value})

    def toJson(self):
        result = {}
        if self.name is not None:
            result["name"] = self.name
        if self.version is not None:
            result["version"] = self.version
        if self.buildDate is not None:
            result["buildDate"] = self.buildDate
        if self.buildSources is not None:
            result["buildSources"] = self.buildSources
        if self.description is not None:
            result["description"] = self.description
        result["grids"] = self.grids
        return result

    def writeFiles(self, mainFileName, outDir, minimalOutput=True):
        """Write main data file and `@import` files to outDir.

        Args:
            mainFileName (str): Name of main data file
            outDir (str): Directory where to save files
            minimalOutput(bool): Produces minimal JSON (without indents and line breaks) when set to True.
        """

        imports = {}
        def converter(o):
            if isinstance(o, SdbvImport):
                imports[o.fileName] = o.data

            if hasattr(o, "toJson"):
                return o.toJson()
            else:
                return JSONEncoder.default(o)

        files = []
        indent = None if minimalOutput else 2
        separators = (',', ':') if minimalOutput else (',', ': ')
        encoder = JSONEncoder(default=converter, indent=indent, separators=separators)
        filepath = os.path.normpath(os.path.join(outDir, mainFileName))
        with open(filepath, "w") as output:
            output.write(encoder.encode(o=self))
        files.append(filepath)
        for filename, obj in imports.items():
            filepath = os.path.normpath(os.path.join(outDir, filename))
            with open(filepath, "w") as output:
                output.write(encoder.encode(obj))
            files.append(filepath)

        return files


__all__ = ["Colors", "SdbvDataFile", "SdbvGrid", "SdbvGridCells", "SdbvImport"]
