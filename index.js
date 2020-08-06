const cheerio = require("cheerio");
const got = require("got");
const yaml = require("js-yaml");
const fs = require("fs");

const url =
  "http://www.sii.cl/ayudas/ayudas_por_servicios/1956-codigos-1959.html";

const siiCodes = [];

// Keys for resulting YAML file specified in same order than in SII website
// Types property is an array of probable types in order of priority.
const fields = [
  { key: "code", types: ["integer"] },
  { key: "name", types: ["string"] },
  { key: "taxable", types: ["boolean", "string"] },
  { key: "category", types: ["integer", "string"] },
  { key: "internet", types: ["boolean"] },
];

const dataConverters = {
  boolean: (data) => {
    if (/si?/i.test(data)) {
      return true;
    } else if (/no?/i.test(data)) {
      return false;
    } else {
      return null;
    }
  },
  integer: (data) => {
    int = parseInt(data);
    return isNaN(int) ? null : int;
  },
  string: (data) => data.trim().replace(/( {2,}|[\n\r]+)/g, " "),
};

const applyTypeConverters = ({ data, types }) => {
  if (!types || types.length === 0) {
    console.warn(
      `WARNING: Element without data type detected: "${data}". Proceeding without applying transformations. If possible, assign its data type explicitly to silence this warning.`
    );
    return data;
  }
  let result = null;

  types.forEach((type) => {
    if (!dataConverters[type]) {
      throw new Error(`Data converter not found for data type: "${type}"`);
    }
    if (result !== null && result !== undefined) {
      // If we have successfully applied a data transformation, skip remaining data types
      return;
    } else {
      try {
        result = dataConverters[type](data);
      } catch (error) {
        result = null;
      }
    }
  });

  if (result === null || result === undefined) {
    // None of the transformations worked!
    throw new Error(
      `Could not successfully convert "${data}" with any converter! 
      Tried with: "${types.join(",")}"`
    );
  }
  return result;
};

got(url).then((response) => {
  const $ = cheerio.load(response.body);
  $(".contenido .table-responsive tr").each((index, tr) => {
    // height of row = 20 means it is a row containing our target data
    if (tr.attribs.height == 20) {
      const children = $(tr).find("td");
      // Some rows have height = 20 but are just sub headers. We skip them by
      // checking children count
      if (children.length < 5) return;

      const newCode = {};

      children.each((idx, td) => {
        const field = fields[idx];
        let text = applyTypeConverters({
          data: $(td).text(),
          types: field.types,
        });
        newCode[field.key] = text;
      });
      siiCodes.push(newCode);
    }
  });

  fs.writeFileSync("activity_codes.yaml", yaml.dump(siiCodes));
  console.log('File "activity_codes.yaml" created successfully!');
});
