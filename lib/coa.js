"use strict";

const FS = require("fs");
const PATH = require("path");
const { parse } = require("./hara.js");
const PKG = require("../package.json");
const { parseAsCsv } = require("./csv.js");

const OUTPUT_FILE = ".json";
const regHARFile = /\.har$/i;

/**
 * Synchronously check if path is a directory. Tolerant to errors like ENOENT.
 * @param {string} path
 */
function checkIsDir(path) {
  try {
    return FS.lstatSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

module.exports = function makeProgram(program) {
  program
    .name(PKG.name)
    .description(PKG.description, {
      INPUT: "Alias to --input",
    })
    .version(PKG.version, "-v, --version")
    .arguments("[INPUT...]")
    .option("-i, --input <INPUT...>", 'Input files, "-" for STDIN')
    .option(
      "-f, --folder <FOLDER>",
      "Input folder, parse and rewrite all *.har files"
    )
    .option(
      "-o, --output <OUTPUT...>",
      'Output file or folder (by default the same as the input), "-" for STDOUT'
    )
    .option(
      "-c, --csv",
      'Output data in CSV format (by default uses the same as the input), "-" for STDOUT'
    )
    .option(
      "-r, --recursive",
      "Use with '--folder'. Parses *.har files in folders recursively."
    )
    .option(
      "-q, --quiet",
      "Only output error messages, not regular status messages"
    )
    .action(action);
};

async function action(args, opts, command) {
  var input = opts.input || args;
  var output = opts.output;
  var config = {};

  if (opts.in === null) {
    console.error("error: option '--in' must be a HAR file");
    process.exit(1);
  }

  // w/o anything
  if (
    (input.length === 0 || input[0] === "-") &&
    !opts.stdin &&
    !opts.folder &&
    process.stdin.isTTY === true
  ) {
    return command.help();
  }

  if (
    typeof process == "object" &&
    process.versions &&
    process.versions.node &&
    PKG &&
    PKG.engines.node
  ) {
    var nodeVersion = String(PKG.engines.node).match(/\d*(\.\d+)*/)[0];
    if (parseFloat(process.versions.node) < parseFloat(nodeVersion)) {
      throw Error(
        `${PKG.name} requires Node.js version ${nodeVersion} or higher.`
      );
    }
  }

  // -- csv
  if (opts.csv) {
    config.csv = opts.csv;
  }

  // --quiet
  if (opts.quiet) {
    config.quiet = opts.quiet;
  }

  // --recursive
  if (opts.recursive) {
    config.recursive = opts.recursive;
  }

  // --exclude
  config.exclude = opts.exclude
    ? opts.exclude.map((pattern) => RegExp(pattern))
    : [];

  // --output
  if (output) {
    if (input.length && input[0] != "-") {
      if (output.length == 1 && checkIsDir(output[0])) {
        var dir = output[0];
        for (var i = 0; i < input.length; i++) {
          output[i] = checkIsDir(input[i])
            ? input[i]
            : PATH.resolve(dir, PATH.basename(input[i]));
        }
      } else if (output.length < input.length) {
        output = output.concat(input.slice(output.length));
      }
    }
  } else if (input.length) {
    output = input.map((n) =>
      n.replace(regHARFile, config.csv ? ".csv" : OUTPUT_FILE)
    );
  }

  // --folder
  if (opts.folder) {
    var ouputFolder = (output && output[0]) || opts.folder;
    await parseFolder(config, opts.folder, ouputFolder);
  }

  // --input
  if (input.length !== 0) {
    // STDIN
    if (input[0] === "-") {
      return new Promise((resolve, reject) => {
        var data = "",
          file = output[0];

        process.stdin
          .on("data", (chunk) => (data += chunk))
          .once("end", () =>
            processHARData(config, { input: "string" }, data, file).then(
              resolve,
              reject
            )
          );
      });
      // file
    } else {
      await Promise.all(
        input.map((file, n) => parseFile(config, file, output[n]))
      );
    }
  }
}

/**
 * Parse HAR files in a directory.
 * @param {Object} config options
 * @param {string} dir input directory
 * @param {string} output output directory
 * @return {Promise}
 */
async function parseFolder(config, dir, output) {
  if (!config.quiet) {
    console.log(`Processing directory '${dir}':\n`);
  }
  const files = await FS.promises.readdir(dir);
  return await processDirectory(config, dir, files, output);
}

/**
 * Process given files, take only HAR.
 * @param {Object} config options
 * @param {string} dir input directory
 * @param {Array} files list of file names in the directory
 * @param {string} output output directory
 * @return {Promise}
 */
function processDirectory(config, dir, files, output) {
  // take only *.har files, recursively if necessary
  var harFilesDescriptions = getFilesDescriptions(config, dir, files, output);

  return harFilesDescriptions.length
    ? Promise.all(
        harFilesDescriptions.map((fileDescription) =>
          parseFile(
            config,
            fileDescription.inputPath,
            fileDescription.outputPath
          )
        )
      )
    : Promise.reject(
        new Error(`No HAR files have been found in '${dir}' directory.`)
      );
}

/**
 * Get har files descriptions
 * @param {Object} config options
 * @param {string} dir input directory
 * @param {Array} files list of file names in the directory
 * @param {string} output output directory
 * @return {Array}
 */
function getFilesDescriptions(config, dir, files, output) {
  const filesInThisFolder = files
    .filter(
      (name) =>
        regHARFile.test(name) &&
        !config.exclude.some((regExclude) => regExclude.test(name))
    )
    .map((name) => ({
      inputPath: PATH.resolve(dir, name),
      outputPath: PATH.resolve(
        output,
        name.replace(regHARFile, config.csv ? ".csv" : OUTPUT_FILE)
      ),
    }));

  return config.recursive
    ? [].concat(
        filesInThisFolder,
        files
          .filter((name) => checkIsDir(PATH.resolve(dir, name)))
          .map((subFolderName) => {
            const subFolderPath = PATH.resolve(dir, subFolderName);
            const subFolderFiles = FS.readdirSync(subFolderPath);
            const subFolderOutput = PATH.resolve(output, subFolderName);
            return getFilesDescriptions(
              config,
              subFolderPath,
              subFolderFiles,
              subFolderOutput
            );
          })
          .reduce((a, b) => [].concat(a, b), [])
      )
    : filesInThisFolder;
}

/**
 * Read HAR file and pass to processing.
 * @param {Object} config options
 * @param {string} file
 * @param {string} output
 * @return {Promise}
 */
function parseFile(config, file, output) {
  return FS.promises.readFile(file, "utf8").then(
    (data) =>
      processHARData(config, { input: "file", path: file }, data, output, file),
    (error) => checkParseFileError(config, file, output, error)
  );
}

/**
 * Parse HAR data.
 * @param {Object} config options
 * @param {string} data HAR content to parse
 * @param {string} output where to write parsed file
 * @param {string} [input] input file name (being used if output is a directory)
 * @return {Promise}
 */
function processHARData(config, info, data, output, input) {
  var startTime = Date.now();

  const result = parse(data, { ...config, ...info });
  if (result.error) {
    let message = result.error;
    if (result.path != null) {
      message += `File: ${result.path}\n`;
    }
    throw Error(message);
  }
  var processingTime = Date.now() - startTime;

  return writeOutput(input, output, result.data).then(
    function () {
      if (!config.quiet && output != "-") {
        if (input) {
          console.log(`${PATH.basename(input)}:`);
        }
        printTimeInfo(processingTime);
      }
    },
    (error) =>
      Promise.reject(
        new Error(
          error.code === "ENOTDIR"
            ? `Error: output '${output}' is not a directory.`
            : error
        )
      )
  );
}

/**
 * Write result of parsing.
 * @param {string} input
 * @param {string} output output file name. '-' for stdout
 * @param {string} data data to write
 * @return {Promise}
 */
async function writeOutput(input, output, data) {
  if (output == "-") {
    return Promise.resolve();
  }

  let formattedData = data;
  if (/\.csv$/.test(output)) {
    formattedData = await parseAsCsv(JSON.parse(formattedData));
  }

  FS.mkdirSync(PATH.dirname(output), { recursive: true });

  try {
    return FS.promises.writeFile(output, formattedData, "utf8");
  } catch (error) {
    return await checkWriteFileError(input, output, formattedData, error);
  }
}

/**
 * Write a time taken by parsing.
 * @param {number} time time in milliseconds.
 */
function printTimeInfo(time) {
  console.log(`Done in ${time} ms!\n`);
}

/**
 * Check for errors, if it's a dir parse the dir.
 * @param {Object} config
 * @param {string} input
 * @param {string} output
 * @param {Error} error
 * @return {Promise}
 */
function checkParseFileError(config, input, output, error) {
  if (error.code == "EISDIR") {
    return parseFolder(config, input, output);
  } else if (error.code == "ENOENT") {
    return Promise.reject(
      new Error(`Error: no such file or directory '${error.path}'.`)
    );
  }
  return Promise.reject(error);
}

/**
 * Check for saving file error. If the output is a dir, then write file there.
 * @param {string} input
 * @param {string} output
 * @param {string} data
 * @param {Error} error
 * @return {Promise}
 */
function checkWriteFileError(input, output, data, error) {
  if (error.code == "EISDIR" && input) {
    return FS.promises.writeFile(
      PATH.resolve(output, PATH.basename(input)),
      data,
      "utf8"
    );
  } else {
    return Promise.reject(error);
  }
}

module.exports.checkIsDir = checkIsDir;
