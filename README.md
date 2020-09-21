# Symbiflow Database Visualizer



## Dependences

* a web browser (Chrome/Chromium is recommended)
* any http server (e.g. `python3 -m http.server`)

To run the app from sources or to create a bundle you'll also need:

* node.js
* npm

## Running, bundling

### One-time initialization

```
npm install
```

### Starting from sources

Run:

```
npm start
```

The app should be available in a web browser at `http://localhost:8080`.

### Bundling

In order to create deployable package which doesn't require node nor npm, run:

```
npm run build
```

The bundled app files should be created in `dist` subdirectory.

### Starting from bundle

Start a http server in directory containing `index.html`, e.g.:

```
python3 -m http.server 8080
```

The app should be available in a web browser at `http://localhost:8080`.

Optionally, you can upload bundled app to a remote server.

## Generating data files

The app needs a data file in order to show something useful.

### Generating data files from prjxray's `tilegrid.json`

```
cd utils/archdefs2sdbv/
mkdir data
./tilegrid-to-sdbv.py \
    --input $PRJXRAYDB/artix7/xc7a100tcsg324-1/tilegrid.json \
    --output-dir ./data/ \
    --output-file-name artix7.json
```

| Argument                       | Description                                                   |
|--------------------------------|---------------------------------------------------------------|
| `--input PATH_TO_TILEGRID`     | specifies input file.                                         |
| `--output-dir DIR`             | specifies where to save data files. The directory must exist. |
| `--output-file-name FILE_NAME` | specifies main data file name.                                |

## Using data files with the app

* Copy the directory with generated files to app bundle top directory. If you want to use the data with app started from sources (i.e. with `npm start`) copy it to repository's top directory.
* Open in a browser:

  ```
  http://localhost:8080/&dbfile=./data/artix7.json
  ```

  where `./data/artix7.json` is a path to main data file.
