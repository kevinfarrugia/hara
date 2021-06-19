"use strict";

const { normalizeUrl, mode, percentile, sum } = require("./util");

const parseTop = (data) => {
  const topUrl = mode(data);
  return {
    url: topUrl,
    noOfOccurrences: data.filter((n) => n === topUrl).length,
  };
};

const parseLargest = (data) => {
  const item = data
    .sort((a, b) => a.response.content.size - b.response.content.size)
    .pop();

  return {
    url: normalizeUrl(item.request.url),
    bytes: item.response.content.size,
  };
};

const parseLargestCompressed = (data) => {
  const item = data
    .sort((a, b) => a.response._transferSize - b.response._transferSize)
    .pop();

  return {
    url: normalizeUrl(item.request.url),
    bytesTransferred: item.response._transferSize,
  };
};

const parseLongest = (data) => {
  const item = data.sort((a, b) => a.response.time - b.response.time).pop();

  return {
    url: normalizeUrl(item.request.url),
    time: Math.round(item.time),
    timings: {
      blocked: Math.round(item.timings.blocked),
      wait: Math.round(item.timings.wait),
      receive: Math.round(item.timings.receive),
    },
  };
};

const parsePages = (data) => ({
  noOfPages: data.length,
  medianOnLoad: Math.round(percentile(
    data.map((n) => n.pageTimings.onLoad),
    0.5
  )),
  ninetyFifthPercentileOnLoad: Math.round(percentile(
    data.map((n) => n.pageTimings.onLoad),
    0.95
  )),
  pages: data.map((n) => ({
    url: normalizeUrl(n.title),
    onLoad: Math.round(n.pageTimings.onLoad),
  })),
});

const parseRequests = (data) => ({
  noOfRequests: data.length,
  medianTime: percentile(
    data.map((n) => n.time),
    0.5
  ),
  ninetyFifthPercentileTime: percentile(
    data.map((n) => n.time),
    0.95
  ),
  medianTimings: {
    blocked: percentile(
      data.map((n) => n.timings.blocked),
      0.5
    ),
    wait: percentile(
      data.map((n) => n.timings.wait),
      0.5
    ),
    receive: percentile(
      data.map((n) => n.timings.receive),
      0.5
    ),
  },
  ninetyFifthTimings: {
    blocked: percentile(
      data.map((n) => n.timings.blocked),
      0.95
    ),
    wait: percentile(
      data.map((n) => n.timings.wait),
      0.95
    ),
    receive: percentile(
      data.map((n) => n.timings.receive),
      0.95
    ),
  },
  bytesTransferred: sum(data.map((n) => n.response._transferSize)),
  topUrl: parseTop(data.map((n) => normalizeUrl(n.request.url))),
  largest: parseLargest(data),
  largestCompressed: parseLargestCompressed(data),
  longest: parseLongest(data),
});

const parseEntries = (data) => ({
  all: parseRequests(data),
  document: parseRequests(data.filter((n) => n._resourceType === "document")),
  font: parseRequests(data.filter((n) => n._resourceType === "font")),
  image: parseRequests(data.filter((n) => n._resourceType === "image")),
  style: parseRequests(data.filter((n) => n._resourceType === "stylesheet")),
  script: parseRequests(data.filter((n) => n._resourceType === "script")),
  xhr: parseRequests(data.filter((n) => n._resourceType === "xhr")),
  other: parseRequests(data.filter((n) => n._resourceType === "other")),
});

const parse = (input, config) => {
  if (config == null) {
    config = {};
  }
  if (typeof config !== "object") {
    throw Error("Config should be an object");
  }

  const data = JSON.parse(input);

  const response = {
    pages: parsePages(data.log.pages),
    requests: parseEntries(data.log.entries),
  };

  return { data: JSON.stringify(response, null, 2) };
};

exports.parse = parse;
