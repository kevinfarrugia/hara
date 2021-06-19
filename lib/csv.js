"use strict";

const stringify = require("csv-stringify");

const HEADINGS = [
  "Resource Type",
  "Number of Requests",
  "Time (Median)",
  "Time (95th)",
  "Transfer Size (bytes)",
];

const getCsvRequestsData = (data) => {
  return Object.keys(data).map((key) => [
    key,
    data[key]["noOfRequests"],
    data[key]["medianTime"],
    data[key]["ninetyFifthPercentileTime"],
    data[key]["bytesTransferred"],
  ]);
};

const parseAsCsv = (data) => {
  return new Promise((resolve, reject) => {
    stringify(
      [HEADINGS, ...getCsvRequestsData(data.requests)],
      (err, output) => {
        if (err) {
          reject(err);
        }
        resolve(output);
      }
    );
  });
};

exports.parseAsCsv = parseAsCsv;
