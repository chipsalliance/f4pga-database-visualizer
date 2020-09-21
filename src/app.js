import "lodash";
import {MDCTabBar} from '@material/tab-bar';
import {MDCRipple} from "@material/ripple";
import {findMostContrastingColor, findNearestPaletteColor, firstColorWithContrast} from "./utils/colors";

import {Database} from "./db/db";
import * as HTMLHelpers from "./htmlhelpers";
import {readFileXHR, XHRError} from "./datasources/read-file-xhr";
import {JsonReader} from "./datasources/json-reader";

import AppParams from "./app-params";
import ErrorScreen from "./views/error-screen";

import "./styles.scss";


var mdc_tab_bars = {}
document.querySelectorAll('.mdc-tab-bar').forEach((el, _, __) => {
    const tabBar = new MDCTabBar(el);

    function setPageVisible(page, visible) {
        page.setAttribute("aria-expanded", (!!visible).toString());
        page.hidden = !visible;
    }

    var i = 0;
    var tabIndexes = {};
    const pages = [].map.call(el.querySelectorAll(".mdc-tab"), (tab) => {
        const pageId = tab.getAttribute("aria-controls");
        const page = pageId ? document.getElementById(pageId) : null;
        if (page) {
            const selected = tab.getAttribute("aria-selected") == "true";
            setPageVisible(page, selected);
            if (selected) {
                page.parentElement.style.setProperty("--tab-view-current-index", i);
            }
            tabIndexes[pageId] = i;
        }
        i++;
        return page;
    });

    tabBar.listen("MDCTabBar:activated", (event) => {
        const index = event.detail.index;
        pages.forEach((page, i, _) => {
            if (page) {
                page.parentElement.style.setProperty("--tab-view-current-index", index);
                setPageVisible(page, i == index)
            }
        })
    });

    if (el.id) {
        mdc_tab_bars[el.id] = {mdc: tabBar, element: el, tabIndexes: tabIndexes};
    }
});

function renderDescription(containerNode, description) {
    if(!description)
        return;
    let dlBuilder = null;

    for (const entry of description) {
        if (entry instanceof Object) {
            if (!dlBuilder) {
                dlBuilder = new HTMLHelpers.DefinitionListBuilder();
            }
            let value;
            if (entry.value instanceof Array) {
                let listBuilder = new HTMLHelpers.ListBuilder("ul");
                entry.value.forEach((vv)=>listBuilder.addEntry(vv.toString(10)));
                value = [listBuilder.build()];
            } else {
                value = entry.value;
            }
            dlBuilder.addEntry(entry.key, value);
        } else {
            if (dlBuilder) {
                containerNode.appendChild(dlBuilder.build());
                dlBuilder = null;
            }
            if (typeof entry == "string") {
                let p = document.createElement("p");
                p.innerText = entry;
                containerNode.appendChild(p);
            } else {
                console.warn("Unknown element in Description:", entry);
            }
        }
    }
    if (dlBuilder) {
        containerNode.appendChild(dlBuilder.build());
    }
}

const gridChildElementsLUT = [];
gridChildElementsLUT.getElement   = function(x, y) {return this[y * this.width + x];}
gridChildElementsLUT.setElement   = function(x, y, element) {this[y * this.width + x] = element;}
gridChildElementsLUT.getCell      = function(x, y) {return this.getElement(x+1, y+1);}
gridChildElementsLUT.setCell      = function(x, y, element) {this.setElement(x+1, y+1, element);}
gridChildElementsLUT.getColHeader = function(x) {return this.getElement(x+1, 0);}
gridChildElementsLUT.setColHeader = function(x, element) {this.setElement(x+1, 0, element)}
gridChildElementsLUT.getRowHeader = function(y) {return this.getElement(0, y+1);}
gridChildElementsLUT.setRowHeader = function(y, element) {this.setElement(0, y+1, element)}

let gridActiveElements = new Set();

let firstTileClickEvent = true;

function elementFromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

const openTileGridButton = {
    node: undefined,
    mdc: undefined,
    get: function (url, gridName) {
        if (!this.node) {
            this.node = elementFromHtml(`<a class="mdc-button action-link">
                <div class="mdc-button__ripple"></div>
                <i class="material-icons mdc-button__icon" aria-hidden="true">launch</i>
                <span class="mdc-button__label">Open tile grid</span>
            </a>`);

            this.mdc = new MDCRipple(this.node);
        }
        this.node.href = url.toString();
        this.node.title = "Open tile grid" + (gridName ? ` (${gridName})`: "");
        return this.node;
    }
};
async function tileClickEventHandler(event) {
    const tileElement = event.target;
    const cellElement = tileElement.classList.contains("cell") ? tileElement : tileElement.parentElement;
    const itemInfoElement = document.getElementById("item-info");
    const cells = await this.getCells();
    const cell = await cells.getById(parseInt(tileElement.getAttribute("data-id")));
    const cellFullName = cell.fullName || cell.name;

    gridActiveElements.forEach((el) => el.classList.remove("active"));
    gridActiveElements.clear();
    tileElement.classList.add("active");
    gridActiveElements.add(tileElement);
    if (cellElement != tileElement) {
        cellElement.classList.add("active");
        gridActiveElements.add(cellElement);
    }

    const [columnsRange, rowsRange] = [await this.getColumnsRange(), await this.getRowsRange()];
    const x = columnsRange.indexOf(cell.col);
    const y = rowsRange.indexOf(cell.row);

    const rowHeader = gridChildElementsLUT.getRowHeader(y);
    const colHeader = gridChildElementsLUT.getColHeader(x);
    rowHeader.classList.add("active");
    colHeader.classList.add("active");
    gridActiveElements.add(rowHeader);
    gridActiveElements.add(colHeader);

    itemInfoElement.innerHTML = "";
    const h3 = document.createElement("h3");
    h3.innerText = cellFullName;
    itemInfoElement.appendChild(h3);

    renderDescription(itemInfoElement, cell.description);

    // Ignore null/0 but allow ""
    if ((cell.targetGrid !== undefined) && (cell.targetGrid.constructor == String)) {
        const url = new URL(window.location);
        url.searchParams.set("grid", cell.targetGrid);

        try {
            const targetGrid = await this.database.getGrid(cell.targetGrid);
            let targetGridName = await targetGrid.getName();
            if (targetGridName === null) {
                targetGridName = cell.targetGrid;
            }
            const a = openTileGridButton.get(url, cell.targetGrid);
            itemInfoElement.appendChild(a);
        } catch (e) {
            console.log(`Target grid not found.`, e, cell);
        }
    }
    if (firstTileClickEvent) {
        firstTileClickEvent = false;
        // Activate "cell" side panel tab
        const sidePanelTabBar = mdc_tab_bars["side-panel-tab-bar"];
        sidePanelTabBar.mdc.activateTab(sidePanelTabBar.tabIndexes["side-panel-tile-tab"]);
    }
    window.location.hash = encodeURIComponent(cellFullName);
}
function tileDoubleClickEventHandler(event) {
    const tileElement = event.target;
    const cellElement = tileElement.classList.contains("cell") ? tileElement : tileElement.parentElement;
    console.log("");
}

function updateDatabaseInfoView(name, description, version, buildDate, buildSources) {
    let databaseInfoElement = document.getElementById("database-info");
    databaseInfoElement.innerHTML = "";

    // Title
    let h = document.createElement("h3");
    h.innerText = name ? name : "Database";
    databaseInfoElement.appendChild(h);

    // Description
    if (description) {
        renderDescription(databaseInfoElement, description);
    }

    // Generic database info
    let dlBuilder = new HTMLHelpers.DefinitionListBuilder({"className": "database-metadata"});

    if (version)
        dlBuilder.addEntry("Version", version);
    if (buildDate)
        dlBuilder.addEntry("Build date", buildDate.toLocaleString());
    if (buildSources && (buildSources.length > 0)) {
        let sources;
        const createSourceEntry = (source) => {
            if (source.url) {
                let a = document.createElement("a");
                a.innerText = source.text;
                a.href = source.url;
                return [a];
            } else {
                return source.text;
            }
        }
        if(buildSources.length == 1) {
            sources = createSourceEntry(buildSources[0]);
        } else {
            let list = new HTMLHelpers.ListBuilder("ul");
            for(const source of buildSources) {
                list.addEntry(createSourceEntry(source));
            }
            sources = [list.build()];
        }
        dlBuilder.addEntry("Sources", sources);
    }
    if (!dlBuilder.isEmpty()) {
        if (description) {
            let h = document.createElement("h4");
            h.innerText = "Database metadata";
            databaseInfoElement.appendChild(h);
        }
        databaseInfoElement.appendChild(dlBuilder.build());
    }
}


let updateTitleCurrentGrid = "";
let updateTitleDbName = "";
function updateTitles({dbName=undefined, currentGrid=undefined}={}) {
    if (dbName !== undefined) updateTitleDbName = dbName;
    if (currentGrid !== undefined) updateTitleCurrentGrid = currentGrid;

    let title = "";
    if (updateTitleDbName) title = updateTitleDbName;
    if (updateTitleCurrentGrid) {
        if (title)
            title += ": "
        title += updateTitleCurrentGrid;
    }
    if (title) title += " - ";
    title += AppParams.appName;
    document.title = title;

    const headerDbNameElement = document.getElementById("header-db-name");
    headerDbNameElement.innerText = !!(updateTitleDbName) ? updateTitleDbName : AppParams.appName;

    if (updateTitleCurrentGrid) {
        let gridNameElement = headerDbNameElement.nextElementSibling;
        if (!gridNameElement) {
            gridNameElement = document.createElement("span");
            headerDbNameElement.insertAdjacentElement("afterend", gridNameElement);
        }
        gridNameElement.innerText = updateTitleCurrentGrid;

        const url = new URL(window.location);
        url.searchParams.set("grid", "");
        headerDbNameElement.setAttribute("href", url.toString());
    } else {
        const gridNameElement = headerDbNameElement.nextElementSibling;
        if (gridNameElement) {
            gridNameElement.remove();
        }
        headerDbNameElement.removeAttribute("href");
    }
}

async function updateGrid(grid) {
    let [columnHeaders, rowHeaders] = [await grid.getColumnHeaders(), await grid.getRowHeaders()];

    if (columnHeaders === null) {
        const columnsRange = await grid.getColumnsRange();
        columnHeaders = [...columnsRange];
    }
    if (rowHeaders === null)  {
        const rowsRange = await grid.getRowsRange();
        rowHeaders = [...rowsRange];
    }

    const gridElement = document.getElementById("grid-view-grid");
    gridElement.hidden = true;

    gridElement.innerHTML = "";
    gridElement.style.setProperty("--cols", columnHeaders.length);
    gridElement.style.setProperty("--rows", rowHeaders.length);
    gridChildElementsLUT.length == 0;
    gridChildElementsLUT.width  = columnHeaders.length + 1;
    gridChildElementsLUT.height = rowHeaders.length + 1;

    // Create header's corner cell
    let header = document.createElement("div");
    header.classList.add("corner-header");
    gridChildElementsLUT.setElement(0, 0, header);
    gridElement.appendChild(header);

    // Create column headers
    columnHeaders.forEach((name, x) => {
        let header = document.createElement("div");
        header.innerText = name;
        header.classList.add("col-header");
        header.style.setProperty("--x", x.toString());
        gridChildElementsLUT.setColHeader(x, header);
        gridElement.appendChild(header);
    });

    // Create row headers
    rowHeaders.forEach((name, y) => {
        let header = document.createElement("div");
        header.innerText = name;
        header.classList.add("row-header");
        header.style.setProperty("--y", y.toString());
        gridChildElementsLUT.setRowHeader(y, header);
        gridElement.appendChild(header);
    });
}

async function updateGridCells(grid) {
    function isTileElement(element) {return element.classList.contains("tile");};

    const COLORS_NUM = 19;
    const gridElement = document.getElementById("grid-view-grid");
    const [columnsRange, rowsRange] = [await grid.getColumnsRange(), await grid.getRowsRange()];
    const cells = await grid.getCells();
    await cells.initData();
    const selectedCellName = decodeURIComponent(window.location.hash).substring(1);
    let cellToClick = null;
    let id = 0;
    // FIXME: use DocumentFragment to assemble the tree
    gridElement.hidden = true;
    const colorCache = {};
    for (const cell of cells) {
        // FIXME: use <template> to not set everything from scratch
        const fullName = cell.fullName || cell.name;
        const tileElement = document.createElement("div");
        tileElement.setAttribute("data-id", id++);
        tileElement.innerText = cell.name;
        tileElement.title = fullName;
        tileElement.classList.add("tile");
        if ((cell.color !== undefined) && (cell.color !== null)) {
            const colorIndex = parseInt(cell.color);
            if (isFinite(colorIndex)) {
                tileElement.classList.add(`c${cell.color % COLORS_NUM}`);
            } else {
                let bg, fg;
                if (Object.keys(colorCache).includes(cell.color)) {
                    [bg, fg] = colorCache[cell.color];
                } else {
                    bg = findNearestPaletteColor(cell.color);
                    fg = firstColorWithContrast(bg, ["#000", "#fff"], 7);
                    if (fg === undefined) {
                        fg = findMostContrastingColor(bg, ["#000", "#fff"]);
                    }
                    colorCache[cell.color] = [bg, fg];
                }
                tileElement.style.setProperty("--bg", bg)
                tileElement.style.setProperty("--fg", fg)
            }
        }
        tileElement.addEventListener("click", tileClickEventHandler.bind(grid));
        tileElement.addEventListener("dblclick", tileDoubleClickEventHandler.bind(grid));
        if (selectedCellName === fullName)
            cellToClick = tileElement;

        const x = columnsRange.indexOf(cell.col);
        const y = rowsRange.indexOf(cell.row);

        let container = gridElement;
        const cellElementAtXY = gridChildElementsLUT.getCell(x, y);
        if (cellElementAtXY != undefined) {
            if (isTileElement(cellElementAtXY)) {
                // element is a tile
                // create container cell, put it in tile's place, and move the tile inside it
                container = document.createElement("div");
                container.classList.add("cell");
                container.style.setProperty("--x", x.toString());
                container.style.setProperty("--y", y.toString());
                gridChildElementsLUT.setCell(x, y, container);
                cellElementAtXY.classList.remove("cell");
                cellElementAtXY.style.removeProperty("--x");
                cellElementAtXY.style.removeProperty("--y");
                // FIXME: do not insert elements one by one. Bulk-insert all elements when everything is created
                gridElement.replaceChild(container, cellElementAtXY);
                container.appendChild(cellElementAtXY);
            } else {
                // the element is a container cell
                container = cellElementAtXY;
            }
        } else {
            tileElement.style.setProperty("--x", x.toString());
            tileElement.style.setProperty("--y", y.toString());
            tileElement.classList.add("cell");
            gridChildElementsLUT.setCell(x, y, tileElement);
        }

        container.appendChild(tileElement);
    }
    gridElement.hidden = false;
    if (cellToClick) {
        cellToClick.click();
        const gridViewElement = document.getElementById("grid-view");
        const scrollX = cellToClick.offsetLeft - (gridViewElement.offsetWidth - cellToClick.offsetWidth) / 2;
        const scrollY = cellToClick.offsetTop - (gridViewElement.offsetHeight - cellToClick.offsetHeight) / 2;
        gridViewElement.scrollTo(scrollX, scrollY);
    }
}

async function loadData() {
    updateTitles();

    if (!AppParams.databaseFile) {
    let url = new URL(window.location);
        new ErrorScreen({title: AppParams.appName, type: "user", message:
            "Database file not specified. " +
            "Append <code>dbfile=<samp>path/to/db.json</samp></code> parameter to the URL, like:</br>"
            + `<code>${window.location.origin}${window.location.pathname}?dbfile=<samp>path/to/db.json</samp></code>`
        }).show();
        return;
    }

    const errorHandler = (e) => {
        if (e instanceof XHRError) {
            new ErrorScreen({title: AppParams.appName, type: "user", message:
                `Could not load database file: <code>${_.escape(AppParams.databaseFile)}</code></br>` +
                `Error: <strong>${e.message}<strong>`,
            }).show();
        } else {
            new ErrorScreen({title: AppParams.appName, message:
                `Error: <strong>${e.message}<strong>`
            }).show();
        }
        console.error(e);
    }

    try {
        const jsonReader = new JsonReader(AppParams.databaseFile, {readFile: readFileXHR});
        const db = new Database(jsonReader);

        db.getName().then((name)=>updateTitles({dbName: name, currentGrid: AppParams.gridId})).catch(errorHandler);

        Promise.all([
            db.getName(),
            db.getDescription(),
            db.getVersion(),
            db.getBuildDate(),
            db.getBuildSources()
        ])
            .then(([name, description, version, buildDate, buildSources]) =>
                    updateDatabaseInfoView(name, description, version, buildDate, buildSources))
            .catch(errorHandler);

        const gridsList = await db.getGridsList();
        let gridId = AppParams.gridId;
        if (!gridsList.includes(gridId)) {
            console.log(`Invalid grid name: ${gridId}`);
            gridId = Database.DEFAULT_GRID_ID;
        }

        db.getGrid(gridId).then(async (grid)=>{
            grid.getName().then(async (name) => {
                if (name !== null)
                    await updateTitles({currentGrid: name})
            });
            grid.getCells().then((cells)=>cells.initData());
            await updateGrid(grid);
            await updateGridCells(grid);
        }).catch(errorHandler);

    } catch(e) {
        errorHandler(e);
        return;
    }
}

document.addEventListener("DOMContentLoaded", (event) => loadData());
