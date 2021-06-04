"use strict";

const parse = (input, config) => {
  if (config == null) {
    config = {};
  }
  if (typeof config !== "object") {
    throw Error("Config should be an object");
  }

  return {};
};

exports.parse = parse;
