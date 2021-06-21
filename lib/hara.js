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
    .reverse()[0];

  return {
    url: normalizeUrl(item.request.url),
    bytes: item.response.content.size,
  };
};

const parseLargestCompressed = (data) => {
  const item = data
    .sort((a, b) =>
      typeof a.response._transferSize !== "undefined"
        ? a.response._transferSize - b.response._transferSize
        : a._bytesIn - b._bytesIn
    )
    .reverse()[0];

  if (!item) {
    return null;
  }

  return {
    url: normalizeUrl(item.request.url),
    bytesTransferred:
      typeof item.response._transferSize !== "undefined"
        ? item.response._transferSize
        : item._bytesIn,
  };
};

const parseLongest = (data) => {
  const item = data.sort((a, b) => a.time - b.time).reverse()[0];

  if (!item) {
    return null;
  }

  return {
    url: normalizeUrl(item.request.url),
    time: Math.round(item.time),
    timings: {
      blocked: Math.round(item.timings.blocked),
      wait: Math.round(item.timings.wait),
      receive: Math.round(item.timings.receive),
      connect: Math.round(item.timings.connect),
    },
  };
};

const parsePages = (data) => ({
  noOfPages: data.length,
  medianOnLoad: Math.round(
    percentile(
      data.map((n) => n.pageTimings.onLoad),
      0.5
    )
  ),
  ninetyFifthOnLoad: Math.round(
    percentile(
      data.map((n) => n.pageTimings.onLoad),
      0.95
    )
  ),
  pages: data.map((n) => ({
    url: normalizeUrl(n.title),
    onLoad: Math.round(n.pageTimings.onLoad),
  })),
});

const parseRequests = (data) => {
  if (!(data && data.length)) {
    return { noOfRequests: 0 };
  }

  return {
    noOfRequests: data.length,
    medianTime: percentile(
      data.map((n) => n.time),
      0.5
    ),
    ninetyFifthTime: percentile(
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
    bytesTransferred: sum(
      data.map((n) =>
        typeof n.response._transferSize !== "undefined"
          ? n.response._transferSize
          : n._bytesIn
      )
    ),
    topUrl: parseTop(data.map((n) => normalizeUrl(n.request.url))),
    largest: parseLargest(data),
    largestCompressed: parseLargestCompressed(data),
    longest: parseLongest(data),
  };
};

const parseEntries = (data) => ({
  all: parseRequests(data),
  document: parseRequests(
    data.filter(
      (n) => n._resourceType === "document" || n._request_type === "Document"
    )
  ),
  font: parseRequests(
    data.filter((n) => n._resourceType === "font" || n._request_type === "Font")
  ),
  image: parseRequests(
    data.filter(
      (n) => n._resourceType === "image" || n._request_type === "Image"
    )
  ),
  style: parseRequests(
    data.filter(
      (n) =>
        n._resourceType === "stylesheet" || n._request_type === "Stylesheet"
    )
  ),
  script: parseRequests(
    data.filter(
      (n) => n._resourceType === "script" || n._request_type === "Script"
    )
  ),
  xhr: parseRequests(
    data.filter((n) => n._resourceType === "xhr" || n._request_type === "XHR")
  ),
  other: parseRequests(
    data.filter(
      (n) => n._resourceType === "other" || n._request_type === "Other"
    )
  ),
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
