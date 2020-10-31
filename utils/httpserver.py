#!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler, HTTPStatus
from functools import partial
from pathlib import Path
from urllib.parse import quote

from os import getcwd
from argparse import ArgumentParser

import json


class RequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")
        return super().end_headers()

    def list_directory(self, path):
        self.send_error(HTTPStatus.FORBIDDEN)
        return None


def run(bind_addr:str, port:int, directory:Path):
    request_handler_class = partial(RequestHandler, directory=directory)
    server = HTTPServer((bind_addr, port), request_handler_class)
    print("\033[1;33;91m** WARNING **\033[0m")
    print(f"All files in \033[1m{directory}\033[0m directory can be read by any application running locally, including web applications.\n")
    print("Press CTRL+C to exit\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return


def print_urls(bind_addr:str, port:int, directory:Path):
    print("\033[1mFound data files:\033[0m\n")
    for file in directory.glob("**/*.json"):
        if str(file).endswith(".data.json"):
            continue

        with file.open("r") as f:
            df = json.load(f)

        # Basic check for data file format
        if "grids" not in df:
            continue

        file = file.relative_to(directory)
        name = f"\033[1;37;97m{df['name']}\033[0m ({file})" if "name" in df else str(file)
        print("{name}: \033[1;34mhttp://{host}:{port}/{url_addr}\033[0m".format(
            name=name,
            host=bind_addr,
            port=port,
            url_addr=quote(str(file))
        ))


def main():
    parser = ArgumentParser()
    parser.add_argument("--bind", "-b", type=str, default="localhost", help="Server bind address")
    parser.add_argument("--port", "-p", type=int, default=8000, help="Server port")
    parser.add_argument("directory", type=Path, default=getcwd(), help="Directory with files to serve")

    args = parser.parse_args()

    print_urls(args.bind, args.port, args.directory)
    print("")
    run(args.bind, args.port, args.directory)

if __name__ == "__main__":
    main()
