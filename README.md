# SymbiFlow Database Visualizer

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

The bundled app files should be created in `dist/production` subdirectory.

### Starting from bundle

Start a http server in directory containing `index.html`, e.g.:

```
python3 -m http.server 8080
```

The app should be available in a web browser at `http://localhost:8080`.

Optionally, you can upload bundled app to a remote server.

## Generating data files

The app needs a data file in order to show something useful.

### Generating data files from prjxray-db

Following line will generate `artix7.json` data file from files in `$PRJXRAYDB_DIR/artix7/xc7a100tcsg324-1` directory:
```
./utils/datafilegen/prjxraydbconverter \
    $PRJXRAYDB_DIR/artix7/xc7a100tcsg324-1
    ./dist/production/data/artix7.json
```

## Using data files with the app

### Remote data files

Data file can be loaded from any HTTP server as long as the server's [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing) headers allow it. To do that just type a JSON file URL in the app.

### Local data files with the app started from a local server

* Copy the directory with generated files to app bundle top directory. If you want to use the data with app started from sources (i.e. with `npm start`) copy it to repository's top directory.
* Open in a browser:

  ```
  http://localhost:8080/?dbfile=./data/artix7.json
  ```

  where `./data/artix7.json` is a path to main data file.

### Local data files with the app started from remote server

* Run following command in a shell:

  ```
  ./utils/httpserver.py ./examples
  ```

  where `./examples` is a path to directory with .json files. The script will print a list of found data files and their URLs.

* Copy a data file URL and paste it in the app

