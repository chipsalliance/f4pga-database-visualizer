import { elementFromHtml } from "../utils/element-from-html";

export function getRectangle(height, width, site_name) {
  return elementFromHtml(`<svg width=${width} height=${height}>
    <rect width=${width} height=${height} 
    style="fill:rgb(0,0,255);stroke-width:10;stroke:rgb(0,0,0)" />
    <text x=70 y=${height/2} style="stroke:rgb(255, 255, 255)"> ${site_name} </text>
  </svg>`);
}

export function getInPin (pin_name) {
  console.log("pin name", pin_name);
  return elementFromHtml(`<svg height="25" width="100">
    <text x=0 y=10>${pin_name}</text>
    <line x1="30" y1="10" x2="100" y2="10" style="stroke:rgb(255,0,0);stroke-width:2" />
  </svg>`);
}

export function getOutPin (pin_name) {
  return elementFromHtml(`<svg height="25" width="100">
    <line x1="0" y1="10" x2="50" y2="10" style="stroke:rgb(255,0,0);stroke-width:2" />
    <text x=60 y=10>${pin_name}</text>
  </svg>`);
}