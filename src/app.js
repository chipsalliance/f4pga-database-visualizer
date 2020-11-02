import {escape} from "lodash";
import {MDCTabBar} from '@material/tab-bar';
import {MDCRipple} from "@material/ripple";

import {Database} from "./db/db";
import * as HTMLHelpers from "./htmlhelpers";
import {readFileXHR, XHRError} from "./datasources/read-file-xhr";
import {JsonReader} from "./datasources/json-reader";

import AppParams from "./app-params";
import AppConfig from "./app-config";
import ErrorScreen from "./views/error-screen";

import "./styles.scss";
import DataFilesListScreen from "./views/data-files-list-screen";
import {elementFromHtml} from "./utils/element-from-html";

import {GridModel, GridView} from "./components/grid-view/grid-view";


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
            } else if (entry.value instanceof Object) {
                let subDlBuilder = new HTMLHelpers.DefinitionListBuilder();
                Object.entries(entry.value).forEach(([k, v])=>subDlBuilder.addEntry(k, v.toString()));
                value = [subDlBuilder.build()];
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
                if (entry.startsWith("# ")) {
                    let h = document.createElement("h4");
                    h.innerText = entry.substring(2).trim();
                    containerNode.appendChild(h);
                } else {
                    let p = document.createElement("p");
                    p.innerText = entry.trim();
                    containerNode.appendChild(p);
                }
            } else {
                console.warn("Unknown element in Description:", entry);
            }
        }
    }
    if (dlBuilder) {
        containerNode.appendChild(dlBuilder.build());
    }
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

function updateDatabaseInfoView(name, description, version, buildDate, buildSources, gridsList) {
    let databaseInfoElement = document.getElementById("database-info");
    databaseInfoElement.innerHTML = "";

    let h;

    // Title
    if (name) {
        h = document.createElement("h3");
        h.innerText = name;
        databaseInfoElement.appendChild(h);
    }

    // Description
    if (description) {
        renderDescription(databaseInfoElement, description);
    }

    // Available grids
    if (gridsList.length > 1) {
        h = document.createElement("h3");
        h.innerText = "Available grids";
        databaseInfoElement.appendChild(h);

        let list = new HTMLHelpers.ListBuilder("ul");
        const url = new URL(window.location);
        url.hash = "";
        for(const gridId of gridsList) {
            const isCurrentGrid = (AppParams.gridId === gridId) || (!gridsList.includes(Database.DEFAULT_GRID_ID) && (AppParams.gridId === Database.DEFAULT_GRID_ID) && (gridsList[0] === gridId));
            const el = document.createElement(isCurrentGrid ? "strong" : "a");
            if (!isCurrentGrid) {
                url.searchParams.set("grid", encodeURIComponent(gridId));
                el.href = url.href;
            }
            if (gridId)
                el.innerText = gridId;
            else
                el.innerHTML = `<em>[main grid]</em>`;

            list.addEntry(el);
        }
        databaseInfoElement.appendChild(list.build());
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
        if (description || (gridsList.length > 1)) {
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

class DataFileGridModel extends GridModel {
    constructor(columnHeaders, rowHeaders, columnsRange, rowsRange, cells) {
        super();
        this._columnHeaders = columnHeaders;
        this._rowHeaders = rowHeaders;
        this._columnsRange = columnsRange;
        this._rowsRange = rowsRange;
        this._cells = cells;
    }

    get columnCount() { return this._columnsRange.length; }
    get rowCount() { return this._rowsRange.length; }

    get columnHeaders() {
        return this._columnHeaders || [...this._columnsRange];
    }
    get rowHeaders() {
        return this._rowHeaders || [...this._rowsRange];
    }

    *iterCells() {
        let id = 0;
        for (const cell of this._cells) {
            const data = {
                column: this._columnsRange.indexOf(cell.col),
                row: this._rowsRange.indexOf(cell.row),
                width: cell.width || 1,
                height: cell.height || 1,
                text: cell.name,
                title: cell.fullName || cell.name,
                color: null,
                dataId: id++,
            };
            if ((cell.color !== undefined) && (cell.color !== null)) {
                const colorIndex = parseInt(cell.color);
                data.color = isFinite(colorIndex) ? colorIndex : cell.color;
            }

            yield data;
        }
    }
};

let gridView = null;

let firstActiveCellChange = true;
async function activeCellChanged(dataId, column, row) {
    const itemInfoElement = document.getElementById("item-info");
    if (dataId === null) {
        itemInfoElement.innerText = "Select a tile to show details.";
        return
    }

    const cells = await this.getCells();
    const cell = await cells.getById(dataId);
    const cellFullName = cell.fullName || cell.name;

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
    if (firstActiveCellChange) {
        firstActiveCellChange = false;
        // Activate "cell" side panel tab
        const sidePanelTabBar = mdc_tab_bars["side-panel-tab-bar"];
        sidePanelTabBar.mdc.activateTab(sidePanelTabBar.tabIndexes["side-panel-tile-tab"]);
    }
    history.replaceState(undefined, undefined, "#" + encodeURIComponent(cellFullName))
}

async function updateGridView(grid) {
    const [columnsRange, rowsRange] = [await grid.getColumnsRange(), await grid.getRowsRange()];
    const [columnHeaders, rowHeaders] = [await grid.getColumnHeaders(), await grid.getRowHeaders()];
    const cells = await grid.getCells();
    await cells.initData();

    gridView.update({onActiveCellChanged: activeCellChanged.bind(grid)});

    const model = new DataFileGridModel(columnHeaders, rowHeaders, columnsRange, rowsRange, cells);
    gridView.update({model: model});

    const selectedCellName = decodeURIComponent(window.location.hash).substring(1);
    for (const cell of cells) {
        const fullName = cell.fullName || cell.name;
        if (selectedCellName === fullName) {
            const column = columnsRange.indexOf(cell.col);
            const row = rowsRange.indexOf(cell.row);
            gridView.setActiveCell(column, row, true);
            break;
        }
    }
}

async function loadData() {
    const configReader = new JsonReader("./sdbv.config.json", {readFile: readFileXHR});
    AppConfig.init(configReader);

    updateTitles();

    if (AppParams.databaseFile === null) {
        await AppConfig.init();
        const filesListScreen = new DataFilesListScreen({
            title: AppParams.appName,
            dataFilesList: AppConfig.dataFilesList
        });
        const url = await filesListScreen.show();
        const params = new URLSearchParams(window.location.search);
        // TODO: handle through AppParams
        params.set("dbfile", url);
        window.location.search = params.toString();
    }

    const errorHandler = (e) => {
        if (e instanceof XHRError) {
            new ErrorScreen({title: AppParams.appName, type: "user", message:
                `Could not load database file: <code>${escape(AppParams.databaseFile)}</code></br>` +
                `Error: <strong>${e.message}<strong>`,
            }).show();
        } else {
            new ErrorScreen({title: AppParams.appName, message:
                `Error: <strong>${e.message}<strong>`
            }).show();
        }
        console.error(e);
    }

    gridView = new GridView();
    const gridViewElement = document.getElementById("grid-view");
    gridViewElement.replaceWith(gridView.build());

    try {
        const dbReader = new JsonReader(AppParams.databaseFile, {readFile: readFileXHR});
        const db = new Database(dbReader);

        db.getName().then((name)=>updateTitles({dbName: name, currentGrid: AppParams.gridId})).catch(errorHandler);

        Promise.all([
            db.getName(),
            db.getDescription(),
            db.getVersion(),
            db.getBuildDate(),
            db.getBuildSources(),
            db.getGridsList(),
        ])
            .then(([name, description, version, buildDate, buildSources, gridsList]) =>
                    updateDatabaseInfoView(name, description, version, buildDate, buildSources, gridsList))
            .catch(errorHandler);

        const gridsList = await db.getGridsList();
        let gridId = AppParams.gridId;
        if (!gridId) {
            gridId = Database.DEFAULT_GRID_ID;
        } else if (!gridsList.includes(gridId)) {
            console.log(`Invalid grid name: ${gridId}`);
            gridId = Database.DEFAULT_GRID_ID;
        }
        if (!gridsList.includes(gridId)) {
            gridId = gridsList[0];
        }

        db.getGrid(gridId).then(async (grid)=>{
            grid.getName().then(async (name) => {
                if (name !== null)
                    await updateTitles({currentGrid: name})
            });
            grid.getCells().then((cells)=>cells.initData());
            await updateGridView(grid);
        }).catch(errorHandler);

    } catch(e) {
        errorHandler(e);
        return;
    }
}

document.addEventListener("DOMContentLoaded", (event) => loadData());
